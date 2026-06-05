import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";

type FinalizeAction = "finalize" | "reopen";

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const period_start = String(body?.period_start || "");
    const period_end = String(body?.period_end || "");
    const action = String(body?.action || "finalize") as FinalizeAction;
    const employee_ids = Array.isArray(body?.employee_ids)
      ? (body.employee_ids as string[]).filter(Boolean)
      : [];

    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "period_start and period_end are required" },
        { status: 400 }
      );
    }

    if (employee_ids.length === 0) {
      return NextResponse.json(
        { error: "employee_ids is required" },
        { status: 400 }
      );
    }

    if (action !== "finalize" && action !== "reopen") {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const supabase = createServerComponentClient({ cookies });
    const now = new Date().toISOString();

    const { data: rows, error: fetchErr } = await supabase
      .from("weekly_attendance")
      .select("id, employee_id, status")
      .eq("period_start", period_start)
      .eq("period_end", period_end)
      .in("employee_id", employee_ids);

    if (fetchErr) throw fetchErr;

    const foundIds = new Set((rows || []).map((r) => r.employee_id));
    const missing = employee_ids.filter((id) => !foundIds.has(id));

    if (action === "finalize" && missing.length > 0) {
      return NextResponse.json(
        {
          error:
            "Cannot finalize employees without a timesheet. Auto-generate first.",
          missing_employee_ids: missing,
        },
        { status: 400 }
      );
    }

    const targetIds = (rows || []).map((r) => r.id);
    if (targetIds.length === 0) {
      return NextResponse.json(
        { error: "No matching timesheet records" },
        { status: 404 }
      );
    }

    const patch =
      action === "finalize"
        ? {
            status: "finalized",
            finalized_at: now,
            finalized_by: authUser.userId,
            updated_at: now,
          }
        : {
            status: "draft",
            finalized_at: null,
            finalized_by: null,
            updated_at: now,
          };

    const { error: updateErr } = await (supabase.from("weekly_attendance") as any)
      .update(patch)
      .in("id", targetIds);

    if (updateErr) throw updateErr;

    return NextResponse.json({
      success: true,
      action,
      period_start,
      period_end,
      updated: targetIds.length,
      skipped_missing: missing,
    });
  } catch (error: any) {
    console.error("timesheet finalize error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update timesheet status" },
      { status: 500 }
    );
  }
}
