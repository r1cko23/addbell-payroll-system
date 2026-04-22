import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

type PunchType = "in" | "out";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      employee_id?: string;
      ot_request_id?: string;
      punch_type?: PunchType;
      lat?: number;
      lng?: number;
      device_info?: string | null;
    };

    if (
      !body?.employee_id ||
      !body?.ot_request_id ||
      !body?.punch_type ||
      (body.punch_type !== "in" && body.punch_type !== "out")
    ) {
      return NextResponse.json(
        {
          error:
            "employee_id, ot_request_id, and punch_type (in/out) are required",
        },
        { status: 400 }
      );
    }

    if (typeof body.lat !== "number" || typeof body.lng !== "number") {
      return NextResponse.json(
        { error: "lat and lng are required for OT punch location tracking" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: employee, error: employeeError } = await admin
      .from("employees")
      .select("id, requires_ot_punch")
      .eq("id", body.employee_id)
      .maybeSingle();

    if (employeeError || !employee) {
      return NextResponse.json(
        { error: employeeError?.message || "Employee not found" },
        { status: 404 }
      );
    }

    if (!employee.requires_ot_punch) {
      return NextResponse.json(
        { error: "Employee is not enabled for OT punch workflow" },
        { status: 403 }
      );
    }

    const { data: requestRow, error: requestError } = await admin
      .from("overtime_requests")
      .select("id, employee_id, status")
      .eq("id", body.ot_request_id)
      .eq("employee_id", body.employee_id)
      .maybeSingle();

    if (requestError || !requestRow) {
      return NextResponse.json(
        { error: requestError?.message || "OT request not found" },
        { status: 404 }
      );
    }

    if (requestRow.status !== "pending") {
      return NextResponse.json(
        { error: "OT punches are only allowed while request is pending" },
        { status: 400 }
      );
    }

    const { data: latestPunchRows, error: latestPunchError } = await admin
      .from("ot_time_entries")
      .select("id, punch_type, punched_at")
      .eq("employee_id", body.employee_id)
      .eq("ot_request_id", body.ot_request_id)
      .order("punched_at", { ascending: false })
      .limit(1);

    if (latestPunchError) {
      return NextResponse.json(
        { error: latestPunchError.message },
        { status: 500 }
      );
    }

    const latestPunch = latestPunchRows?.[0] as
      | { id: string; punch_type: PunchType; punched_at: string }
      | undefined;

    if (body.punch_type === "in" && latestPunch?.punch_type === "in") {
      return NextResponse.json(
        { error: "Existing OT time-in is still open. Please OT time-out first." },
        { status: 400 }
      );
    }
    if (body.punch_type === "out" && latestPunch?.punch_type !== "in") {
      return NextResponse.json(
        { error: "No open OT time-in found for this request." },
        { status: 400 }
      );
    }

    const { data: locationCheck, error: locationCheckError } = await admin.rpc(
      "is_employee_location_allowed",
      {
        p_employee_uuid: body.employee_id,
        p_latitude: body.lat,
        p_longitude: body.lng,
      } as any
    );

    if (locationCheckError) {
      return NextResponse.json(
        { error: "Failed to validate punch location" },
        { status: 500 }
      );
    }
    const allowedResult = (locationCheck as Array<{ is_allowed: boolean }>)[0];
    if (!allowedResult?.is_allowed) {
      return NextResponse.json(
        { error: "Location is not allowed for OT punch." },
        { status: 403 }
      );
    }

    const { data: serverTimeData, error: timeError } = await admin.rpc(
      "get_server_time"
    );
    if (timeError || serverTimeData == null) {
      return NextResponse.json(
        { error: timeError?.message || "Could not get server time" },
        { status: 500 }
      );
    }
    const punchedAt = new Date(serverTimeData as string).toISOString();

    const { data: insertData, error: insertError } = await admin
      .from("ot_time_entries")
      .insert({
        employee_id: body.employee_id,
        ot_request_id: body.ot_request_id,
        punch_type: body.punch_type,
        punched_at: punchedAt,
        lat: body.lat,
        lng: body.lng,
        source: "web",
        device_info: body.device_info ?? null,
      })
      .select("id, punched_at")
      .single();

    if (insertError || !insertData) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to save OT punch" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: insertData.id,
      punched_at: insertData.punched_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
