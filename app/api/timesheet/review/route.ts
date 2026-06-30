import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import {
  resolveTimesheetReviewStatus,
  summarizeTimesheetReadiness,
} from "@/lib/ph-payroll/timesheet-review";
import { fetchSessionsInRange } from "@/lib/timeEntries";

export { dynamic } from "@/lib/api-route-segment";

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const period_start = searchParams.get("period_start");
    const period_end = searchParams.get("period_end");

    if (!period_start || !period_end) {
      return NextResponse.json(
        { error: "period_start and period_end are required" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    const { data: employees, error: empErr } = await supabase
      .from("employees")
      .select("id, employee_id, full_name, last_name, first_name, employment_status")
      .eq("is_active", true)
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false });

    if (empErr) throw empErr;

    const { data: attendanceRows, error: attErr } = await supabase
      .from("weekly_attendance")
      .select(
        "id, employee_id, status, total_regular_hours, total_overtime_hours, total_night_diff_hours, gross_pay, finalized_at, updated_at"
      )
      .eq("period_start", period_start)
      .eq("period_end", period_end);

    if (attErr) throw attErr;

    const attendanceByEmployee = new Map(
      (attendanceRows || []).map((row) => [row.employee_id, row])
    );

    const periodStartISO = `${period_start}T00:00:00`;
    const periodEndISO = `${period_end}T23:59:59`;
    const sessions = await fetchSessionsInRange(
      supabase,
      periodStartISO,
      periodEndISO
    );

    const sessionCountByEmployee = new Map<string, number>();
    for (const session of sessions) {
      const employeeId = String(session.employee_id || "");
      if (!employeeId) continue;
      sessionCountByEmployee.set(
        employeeId,
        (sessionCountByEmployee.get(employeeId) || 0) + 1
      );
    }

    const rows = (employees || []).map((employee) => {
      const attendance = attendanceByEmployee.get(employee.id);
      const reviewStatus = resolveTimesheetReviewStatus(attendance);
      return {
        employee_id: employee.id,
        employee_code: employee.employee_id,
        full_name: employee.full_name,
        review_status: reviewStatus,
        weekly_attendance_id: attendance?.id ?? null,
        total_regular_hours: Number(attendance?.total_regular_hours || 0),
        total_overtime_hours: Number(attendance?.total_overtime_hours || 0),
        total_night_diff_hours: Number(attendance?.total_night_diff_hours || 0),
        gross_pay: Number(attendance?.gross_pay || 0),
        finalized_at: attendance?.finalized_at ?? null,
        session_count: sessionCountByEmployee.get(employee.id) || 0,
      };
    });

    const summary = summarizeTimesheetReadiness(
      rows.map((r) => r.review_status)
    );

    return NextResponse.json({
      period_start,
      period_end,
      summary,
      rows,
    });
  } catch (error: any) {
    console.error("timesheet review error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load timesheet review" },
      { status: 500 }
    );
  }
}
