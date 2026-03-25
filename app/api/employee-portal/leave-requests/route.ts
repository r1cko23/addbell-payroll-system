import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";

type CreateLeavePayload = {
  employee_id: string;
  leave_type: "SIL" | "LWOP" | "Maternity Leave" | "Paternity Leave";
  start_date: string;
  end_date: string;
  total_days: number;
  selected_dates?: string[] | null;
  half_day_dates?: string[] | null;
  reason?: string | null;
  document?: {
    file_name: string;
    file_type: string;
    file_size: number;
    file_base64: string;
  } | null;
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
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
    const { data: requests, error } = await admin
      .from("leave_requests")
      .select(
        `
        id,
        leave_type,
        start_date,
        end_date,
        selected_dates,
        half_day_dates,
        total_days,
        reason,
        status,
        rejection_reason,
        created_at
      `
      )
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = requests || [];
    const requestIds = rows.map((r) => r.id);
    let docsByRequest: Record<string, any[]> = {};

    if (requestIds.length > 0) {
      const { data: docs, error: docsError } = await admin
        .from("leave_request_documents")
        .select("id, leave_request_id, file_name, file_type, file_size")
        .in("leave_request_id", requestIds);

      if (!docsError && docs) {
        docsByRequest = docs.reduce((acc: Record<string, any[]>, doc: any) => {
          if (!acc[doc.leave_request_id]) acc[doc.leave_request_id] = [];
          acc[doc.leave_request_id].push(doc);
          return acc;
        }, {});
      } else if (
        docsError &&
        !isSchemaMissingTableOrRelationError(docsError)
      ) {
        console.error("leave_request_documents load:", docsError);
      }
    }

    const payload = rows.map((r: any) => ({
      ...r,
      leave_request_documents: docsByRequest[r.id] || [],
    }));

    return NextResponse.json({ requests: payload });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as CreateLeavePayload;
    if (
      !body?.employee_id ||
      !body?.leave_type ||
      !body?.start_date ||
      !body?.end_date ||
      !body?.total_days
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: inserted, error } = await admin
      .from("leave_requests")
      .insert({
        employee_id: body.employee_id,
        leave_type: body.leave_type,
        start_date: body.start_date,
        end_date: body.end_date,
        total_days: body.total_days,
        selected_dates: body.selected_dates || null,
        half_day_dates: body.half_day_dates || [],
        reason: body.reason || null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return NextResponse.json(
        { error: error?.message || "Failed to create leave request" },
        { status: 500 }
      );
    }

    if (body.document?.file_base64) {
      // Try with document_type first (legacy schema), then retry without it.
      const docType =
        body.leave_type === "SIL" ? "SIL" : "supporting";
      const withType = await admin.from("leave_request_documents").insert({
        leave_request_id: inserted.id,
        employee_id: body.employee_id,
        document_type: docType,
        file_name: body.document.file_name,
        file_type: body.document.file_type,
        file_size: body.document.file_size,
        file_base64: body.document.file_base64,
      });

      if (withType.error) {
        const retry = await admin.from("leave_request_documents").insert({
          leave_request_id: inserted.id,
          employee_id: body.employee_id,
          file_name: body.document.file_name,
          file_type: body.document.file_type,
          file_size: body.document.file_size,
          file_base64: body.document.file_base64,
        });

        if (retry.error) {
          if (isSchemaMissingTableOrRelationError(retry.error)) {
            return NextResponse.json({
              id: inserted.id,
              warning:
                "Leave request saved; document storage is not available. Apply database migrations to enable attachments.",
            });
          }
          return NextResponse.json({
            id: inserted.id,
            warning: `Leave request created but document upload failed: ${retry.error.message}`,
          });
        }
      }
    }

    return NextResponse.json({ id: inserted.id });
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
    };
    if (!body?.request_id || !body?.employee_id) {
      return NextResponse.json(
        { error: "request_id and employee_id are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("leave_requests")
      .update({ status: "cancelled" })
      .eq("id", body.request_id)
      .eq("employee_id", body.employee_id)
      .in("status", ["pending", "approved_by_manager", "approved_by_hr"])
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

