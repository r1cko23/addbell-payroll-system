import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyEmployeeRecordEditAccess } from "@/lib/api-helpers";

type PunchInput = {
  employee_code: string;
  punched_at: string;
  punch_type: "in" | "out";
  device_serial?: string | null;
  device_name?: string | null;
  source_row_number?: number;
};

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function punchKey(employeeId: string, punchedAt: string, punchType: string) {
  return `${employeeId}|${new Date(punchedAt).toISOString()}|${punchType}`;
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyEmployeeRecordEditAccess();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as {
      punches?: PunchInput[];
      office_location_id?: string | null;
      default_device_name?: string | null;
    };

    const punches = Array.isArray(body.punches) ? body.punches : null;
    const officeLocationId = body.office_location_id?.trim() || null;
    const defaultDeviceName = body.default_device_name?.trim() || null;

    if (!punches || punches.length === 0) {
      return NextResponse.json(
        { error: "Missing punches array" },
        { status: 400 }
      );
    }

    if (punches.length > 5000) {
      return NextResponse.json(
        { error: "Import is limited to 5000 punches per upload" },
        { status: 400 }
      );
    }

    const admin = adminClient();
    const employeeCodes = [...new Set(
      punches
        .map((punch) => String(punch.employee_code || "").trim())
        .filter(Boolean)
    )];

    const { data: employees, error: employeesError } = await admin
      .from("employees")
      .select("id, employee_code")
      .in("employee_code", employeeCodes)
      .eq("employment_status", "active");

    if (employeesError) {
      console.error(employeesError);
      return NextResponse.json(
        { error: "Failed to resolve employee codes" },
        { status: 500 }
      );
    }

    const employeeMap = new Map(
      (employees ?? []).map((employee: { id: string; employee_code: string }) => [
        String(employee.employee_code),
        employee.id,
      ])
    );

    const unresolved: Array<{ row: number; employee_code: string; reason: string }> = [];
    const normalizedPunches: Array<{
      employee_id: string;
      employee_code: string;
      punched_at: string;
      punch_type: "in" | "out";
      device_serial: string | null;
      device_name: string | null;
      source_row_number: number;
    }> = [];

    punches.forEach((punch, index) => {
      const sourceRowNumber = Number(punch.source_row_number || index + 1);
      const employeeCode = String(punch.employee_code || "").trim();
      const employeeId = employeeMap.get(employeeCode);
      const punchType = punch.punch_type;
      const punchedAt = new Date(String(punch.punched_at || ""));

      if (!employeeId) {
        unresolved.push({
          row: sourceRowNumber,
          employee_code: employeeCode,
          reason: "Employee not found or inactive",
        });
        return;
      }

      if (punchType !== "in" && punchType !== "out") {
        unresolved.push({
          row: sourceRowNumber,
          employee_code: employeeCode,
          reason: "Invalid punch type",
        });
        return;
      }

      if (Number.isNaN(punchedAt.getTime())) {
        unresolved.push({
          row: sourceRowNumber,
          employee_code: employeeCode,
          reason: "Invalid punch timestamp",
        });
        return;
      }

      normalizedPunches.push({
        employee_id: employeeId,
        employee_code: employeeCode,
        punched_at: punchedAt.toISOString(),
        punch_type: punchType,
        device_serial: punch.device_serial?.trim() || null,
        device_name: punch.device_name?.trim() || null,
        source_row_number: sourceRowNumber,
      });
    });

    if (normalizedPunches.length === 0) {
      return NextResponse.json({
        ok: true,
        inserted: 0,
        skipped: 0,
        unresolved,
      });
    }

    const employeeIds = [...new Set(normalizedPunches.map((punch) => punch.employee_id))];
    const minTimestamp = normalizedPunches
      .map((punch) => punch.punched_at)
      .sort()[0];
    const maxTimestamp = normalizedPunches
      .map((punch) => punch.punched_at)
      .sort()
      .slice(-1)[0];

    const existingKeys = new Set<string>();
    for (const employeeIdChunk of chunkArray(employeeIds, 200)) {
      const { data: existingRows, error: existingError } = await admin
        .from("time_entries")
        .select("employee_id, punched_at, punch_type")
        .in("employee_id", employeeIdChunk)
        .eq("source", "biometric")
        .gte("punched_at", minTimestamp)
        .lte("punched_at", maxTimestamp);

      if (existingError) {
        console.error(existingError);
        return NextResponse.json(
          { error: "Failed to check existing biometric punches" },
          { status: 500 }
        );
      }

      for (const row of existingRows ?? []) {
        existingKeys.add(
          punchKey(
            String(row.employee_id),
            String(row.punched_at),
            String(row.punch_type)
          )
        );
      }
    }

    const rowsToInsert: Array<{
      employee_id: string;
      punch_type: "in" | "out";
      punched_at: string;
      source: string;
      device_serial: string | null;
      office_location_id: string | null;
      device_info: string;
    }> = [];

    const seenUploadKeys = new Set<string>();
    let skipped = 0;

    for (const punch of normalizedPunches) {
      const key = punchKey(punch.employee_id, punch.punched_at, punch.punch_type);
      if (existingKeys.has(key) || seenUploadKeys.has(key)) {
        skipped += 1;
        continue;
      }

      seenUploadKeys.add(key);
      rowsToInsert.push({
        employee_id: punch.employee_id,
        punch_type: punch.punch_type,
        punched_at: punch.punched_at,
        source: "biometric",
        device_serial: punch.device_serial,
        office_location_id: officeLocationId,
        device_info:
          [punch.device_name || defaultDeviceName, punch.device_serial, "AttLog import"]
            .filter(Boolean)
            .join(" | ") || "AttLog import",
      });
    }

    for (const chunk of chunkArray(rowsToInsert, 500)) {
      const { error: insertError } = await admin
        .from("time_entries")
        .insert(chunk);

      if (insertError) {
        console.error(insertError);
        return NextResponse.json(
          { error: `Failed to import punches: ${insertError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      ok: true,
      inserted: rowsToInsert.length,
      skipped,
      unresolved,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected import error",
      },
      { status: 500 }
    );
  }
}
