import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
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
        "id, employee_id, ot_date, end_date, start_time, end_time, total_hours, reason, status, created_at"
      )
      .eq("employee_id", employeeId)
      .order("ot_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data || [];
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

    const requests = rows.map((r) => ({
      ...r,
      overtime_documents: docsByRequest[r.id] || [],
    }));

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
      ot_date: string;
      end_date?: string | null;
      start_time: string;
      end_time: string;
      total_hours: number;
      reason?: string | null;
      document?: {
        file_name: string;
        file_type: string;
        file_size: number;
        file_base64: string;
      } | null;
    };

    if (
      !body?.employee_id ||
      !body?.ot_date ||
      !body?.start_time ||
      !body?.end_time ||
      !body?.total_hours
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("overtime_requests")
      .insert({
        employee_id: body.employee_id,
        ot_date: body.ot_date,
        end_date: body.end_date || null,
        start_time: body.start_time,
        end_time: body.end_time,
        total_hours: body.total_hours,
        reason: body.reason || null,
        status: "pending",
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
