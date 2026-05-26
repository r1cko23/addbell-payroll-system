import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import {
  buildUsedOtPairKeys,
  validateBundyOtSessionPair,
} from "@/lib/validate-bundy-ot-session";
import type { TimeEntryPunch } from "@/lib/timeEntries";
import { creditOvertimeHours, OT_MIN_HOURS } from "@/utils/overtime";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadApproverNameMap(
  admin: any,
  approverIds: Array<string | null | undefined>
) {
  const uniqueIds = Array.from(
    new Set(approverIds.filter((id): id is string => Boolean(id)))
  );
  if (uniqueIds.length === 0) return {} as Record<string, string>;

  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email")
    .in("id", uniqueIds);

  if (error || !data) {
    console.error("overtime approver profile load:", error);
    return {} as Record<string, string>;
  }

  return (data as Array<{ id: string; full_name: string | null; email: string | null }>).reduce(
    (acc, row) => {
      acc[row.id] = row.full_name || row.email || row.id;
      return acc;
    },
    {} as Record<string, string>
  );
}

function normalizeBase64(raw: string): string {
  const idx = raw.indexOf("base64,");
  return (idx >= 0 ? raw.slice(idx + 7) : raw).trim();
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("overtime_requests")
      .select(
        "id, employee_id, ot_date, end_date, start_time, end_time, total_hours, reason, status, project_manager_id, account_manager_id, project_manager_approved_at, approved_by, hr_approved_by, approved_at, created_at, bundy_in_punch_id, bundy_out_punch_id"
      )
      .eq("employee_id", employeeId)
      .order("ot_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: any[] = data || [];
    const requestIds = rows.map((r) => r.id);
    const docsByRequest: Record<
      string,
      { id: string; overtime_request_id: string; file_name: string }[]
    > = {};

    if (requestIds.length > 0) {
      const { data: docs, error: docsError } = await admin
        .from("overtime_documents")
        .select("id, overtime_request_id, file_name")
        .in("overtime_request_id", requestIds);

      if (!docsError && docs) {
        for (const d of docs as {
          id: string;
          overtime_request_id: string;
          file_name: string;
        }[]) {
          const rid = d.overtime_request_id;
          if (!docsByRequest[rid]) docsByRequest[rid] = [];
          docsByRequest[rid].push(d);
        }
      } else if (
        docsError &&
        !isSchemaMissingTableOrRelationError(docsError)
      ) {
        console.error("overtime_documents load:", docsError);
      }
    }

    const approverNameMap = await loadApproverNameMap(
      admin as any,
      rows.flatMap((r) => [
        r.project_manager_id,
        r.account_manager_id,
        r.approved_by,
        r.hr_approved_by,
      ])
    );

    const punchIds = new Set<string>();
    rows.forEach((r) => {
      if (r.bundy_in_punch_id) punchIds.add(r.bundy_in_punch_id);
      if (r.bundy_out_punch_id) punchIds.add(r.bundy_out_punch_id);
    });
    const punchById: Record<
      string,
      { id: string; punched_at: string; lat: number | null; lng: number | null; punch_type: string }
    > = {};
    if (punchIds.size > 0) {
      const { data: punchRows } = await admin
        .from("time_entries")
        .select("id, punched_at, lat, lng, punch_type")
        .in("id", Array.from(punchIds));
      (punchRows || []).forEach((p: any) => {
        punchById[p.id] = p;
      });
    }

    const requests = rows.map((r: any) => {
      const inP = r.bundy_in_punch_id ? punchById[r.bundy_in_punch_id] : null;
      const outP = r.bundy_out_punch_id ? punchById[r.bundy_out_punch_id] : null;
      return {
        ...r,
        overtime_documents: docsByRequest[r.id] || [],
        bundy_session:
          inP && outP
            ? {
                clock_in_time: inP.punched_at,
                clock_out_time: outP.punched_at,
                clock_in_lat: inP.lat,
                clock_in_lng: inP.lng,
                clock_out_lat: outP.lat,
                clock_out_lng: outP.lng,
              }
            : null,
        manager_approval_name:
          (r.project_manager_id && approverNameMap[r.project_manager_id]) ||
          (r.account_manager_id && approverNameMap[r.account_manager_id]) ||
          null,
        final_approval_name:
          (r.hr_approved_by && approverNameMap[r.hr_approved_by]) ||
          (r.approved_by && approverNameMap[r.approved_by]) ||
          null,
      };
    });

    return NextResponse.json({ requests });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      employee_id: string;
      ot_date?: string;
      end_date?: string | null;
      start_time?: string;
      end_time?: string;
      total_hours?: number;
      reason?: string | null;
      bundy_in_punch_id?: string | null;
      bundy_out_punch_id?: string | null;
      document?: {
        file_name: string;
        file_type: string;
        file_size: number;
        file_base64: string;
      } | null;
    };

    if (!body?.employee_id) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: empRow } = await admin
      .from("employees")
      .select("requires_ot_punch")
      .eq("id", body.employee_id)
      .maybeSingle();

    const requiresBundyLink = empRow?.requires_ot_punch === true;

    let otDate = body.ot_date || "";
    let endDate = body.end_date || null;
    let startTime = body.start_time || "";
    let endTime = body.end_time || "";
    let creditedHours = 0;
    let bundyInId: string | null = body.bundy_in_punch_id || null;
    let bundyOutId: string | null = body.bundy_out_punch_id || null;

    if (requiresBundyLink && (!bundyInId || !bundyOutId)) {
      return NextResponse.json(
        {
          error:
            "Select a completed Time In / Time Out pair from Bundy clock for this OT filing.",
        },
        { status: 400 }
      );
    }

    if (!otDate || !startTime || !endTime || body.total_hours == null) {
      return NextResponse.json(
        {
          error:
            "OT date, start time, end time, and claimed hours are required.",
        },
        { status: 400 }
      );
    }

    creditedHours = creditOvertimeHours(body.total_hours);

    if (bundyInId && bundyOutId) {
      const { data: punches } = await admin
        .from("time_entries")
        .select("id, employee_id, punch_type, punched_at, lat, lng")
        .eq("employee_id", body.employee_id)
        .order("punched_at", { ascending: true })
        .limit(200);

      const { data: otRows } = await admin
        .from("overtime_requests")
        .select("bundy_in_punch_id, bundy_out_punch_id, status")
        .eq("employee_id", body.employee_id)
        .not("bundy_in_punch_id", "is", null);

      const validated = validateBundyOtSessionPair({
        punches: (punches || []) as TimeEntryPunch[],
        inPunchId: bundyInId,
        outPunchId: bundyOutId,
        usedPairKeys: buildUsedOtPairKeys(otRows || []),
      });

      if ("error" in validated) {
        return NextResponse.json({ error: validated.error }, { status: 400 });
      }
    }

    if (creditedHours < OT_MIN_HOURS) {
      return NextResponse.json(
        { error: `Minimum OT credit is ${OT_MIN_HOURS} hour.` },
        { status: 400 }
      );
    }

    const { data, error } = await admin
      .from("overtime_requests")
      .insert({
        employee_id: body.employee_id,
        ot_date: otDate,
        end_date: endDate,
        start_time: startTime,
        end_time: endTime,
        total_hours: creditedHours,
        reason: body.reason || null,
        status: "pending",
        bundy_in_punch_id: bundyInId,
        bundy_out_punch_id: bundyOutId,
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to create overtime request" },
        { status: 500 }
      );
    }

    if (body.document?.file_base64) {
      const b64 = normalizeBase64(body.document.file_base64);
      if (b64.length > 0) {
        const ins = await admin.from("overtime_documents").insert({
          overtime_request_id: data.id,
          employee_id: body.employee_id,
          file_name: body.document.file_name || "attachment",
          file_type: body.document.file_type || null,
          file_size: body.document.file_size ?? null,
          file_base64: b64,
        });

        if (ins.error) {
          if (isSchemaMissingTableOrRelationError(ins.error)) {
            return NextResponse.json({
              id: data.id,
              warning:
                "Overtime request saved; document table is not available. Apply database migrations to enable attachments.",
            });
          }
          return NextResponse.json({
            id: data.id,
            warning: `Overtime request created but document upload failed: ${ins.error.message}`,
          });
        }
      }
    }

    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      request_id: string;
      employee_id: string;
      document?: {
        file_name: string;
        file_type: string;
        file_size: number;
        file_base64: string;
      } | null;
    };
    if (!body?.request_id || !body?.employee_id) {
      return NextResponse.json(
        { error: "request_id and employee_id are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    // Replace supporting document (pending requests only)
    if (body.document?.file_base64) {
      const b64 = normalizeBase64(body.document.file_base64);
      if (b64.length === 0) {
        return NextResponse.json(
          { error: "Invalid document payload" },
          { status: 400 }
        );
      }

      const { data: reqRow, error: reqErr } = await admin
        .from("overtime_requests")
        .select("id, status")
        .eq("id", body.request_id)
        .eq("employee_id", body.employee_id)
        .maybeSingle();

      if (reqErr) {
        return NextResponse.json({ error: reqErr.message }, { status: 500 });
      }
      if (!reqRow || reqRow.status !== "pending") {
        return NextResponse.json(
          { error: "Request not found or document can only be changed while pending" },
          { status: 404 }
        );
      }

      const del = await admin
        .from("overtime_documents")
        .delete()
        .eq("overtime_request_id", body.request_id);

      if (del.error && !isSchemaMissingTableOrRelationError(del.error)) {
        return NextResponse.json({ error: del.error.message }, { status: 500 });
      }

      const ins = await admin.from("overtime_documents").insert({
        overtime_request_id: body.request_id,
        employee_id: body.employee_id,
        file_name: body.document.file_name || "attachment",
        file_type: body.document.file_type || null,
        file_size: body.document.file_size ?? null,
        file_base64: b64,
      });

      if (ins.error) {
        if (isSchemaMissingTableOrRelationError(ins.error)) {
          return NextResponse.json({
            warning:
              "Document table is not available. Apply database migrations to enable attachments.",
          });
        }
        return NextResponse.json({ error: ins.error.message }, { status: 500 });
      }

      return NextResponse.json({ id: body.request_id, documentUpdated: true });
    }

    // Cancel by deleting pending request
    const { data, error } = await admin
      .from("overtime_requests")
      .delete()
      .eq("id", body.request_id)
      .eq("employee_id", body.employee_id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json(
        { error: "Request not found or cannot be cancelled" },
        { status: 404 }
      );
    }

    return NextResponse.json({ id: data.id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
