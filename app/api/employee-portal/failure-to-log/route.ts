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
    console.error("failure-to-log approver profile load:", error);
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
      .from("failure_to_log")
      .select("*")
      .eq("employee_id", employeeId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows: any[] = data || [];
    const approverNameMap = await loadApproverNameMap(
      admin as any,
      rows.flatMap((r) => [r.account_manager_id, r.approved_by])
    );

    return NextResponse.json({
      requests: rows.map((r: any) => ({
        ...r,
        manager_approval_name: r.account_manager_id
          ? approverNameMap[r.account_manager_id] || null
          : null,
        final_approval_name: r.approved_by
          ? approverNameMap[r.approved_by] || null
          : null,
      })),
    });
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
      time_entry_id?: string | null;
      missed_date?: string | null;
      actual_clock_in_time?: string | null;
      actual_clock_out_time?: string | null;
      entry_type: "in" | "out" | "both";
      reason: string;
    };

    if (!body?.employee_id || !body?.entry_type || !body?.reason?.trim()) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (body.entry_type === "out") {
      return NextResponse.json(
        {
          error:
            "Time-out-only failure to log is no longer accepted. Open sessions auto-close 23 hours after time in. File time in and out instead.",
        },
        { status: 400 }
      );
    }

    if (body.entry_type === "both") {
      if (!body.actual_clock_in_time || !body.actual_clock_out_time) {
        return NextResponse.json(
          { error: "Time in and time out are required" },
          { status: 400 }
        );
      }
      if (
        new Date(body.actual_clock_out_time).getTime() <=
        new Date(body.actual_clock_in_time).getTime()
      ) {
        return NextResponse.json(
          { error: "Time out must be after time in" },
          { status: 400 }
        );
      }
    }

    if (body.missed_date && body.actual_clock_out_time) {
      const outDate = body.actual_clock_out_time.split("T")[0];
      if (outDate < body.missed_date) {
        return NextResponse.json(
          { error: "Time out date cannot be before date" },
          { status: 400 }
        );
      }
    }

    const admin = getAdminClient();

    const { data, error } = await admin
      .from("failure_to_log")
      .insert({
        employee_id: body.employee_id,
        time_entry_id: body.time_entry_id || null,
        missed_date: body.missed_date || null,
        actual_clock_in_time: body.actual_clock_in_time || null,
        actual_clock_out_time: body.actual_clock_out_time || null,
        entry_type: body.entry_type,
        reason: body.reason.trim(),
        status: "pending",
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message || "Failed to create failure-to-log request" },
        { status: 500 }
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
      .from("failure_to_log")
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

