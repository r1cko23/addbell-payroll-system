import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import {
  validatePayrollEntry,
  type PayrollEntryEmployeeInput,
} from "@/lib/ph-payroll/payroll-entry-validation";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
import { fetchSessionsInRange } from "@/lib/timeEntries";

const normalizeValue = (value: unknown) => String(value || "").trim().toLowerCase();

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function manilaDateKeyFromIso(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}`;
}

function incrementMap(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payrollRunId = request.nextUrl.searchParams.get("payroll_run_id");
    if (!payrollRunId) {
      return NextResponse.json(
        { error: "payroll_run_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, selected_employee_ids")
      .eq("id", payrollRunId)
      .single();

    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const cutoffStart = String(run.cutoff_start);
    const cutoffEnd = String(run.cutoff_end);
    const periodStart = new Date(`${cutoffStart}T12:00:00+08:00`);
    const periodEnd = new Date(`${cutoffEnd}T12:00:00+08:00`);

    let empQuery = admin
      .from("employees")
      .select(
        "id, employee_id, full_name, position, job_level, employment_type, salary_basis, base_rate, hire_date, employment_status"
      )
      .eq("is_active", true);

    const scopeIds = Array.isArray(run.selected_employee_ids)
      ? run.selected_employee_ids.map(String)
      : null;

    if (scopeIds?.length) {
      empQuery = empQuery.in("id", scopeIds);
    }

    const { data: employees, error: empErr } = await empQuery;
    if (empErr) throw empErr;

    const employeeList = ((employees || []) as PayrollEntryEmployeeInput[]).filter(
      (emp) => scopeIds?.length || normalizeValue(emp.employment_status) === "active"
    );
    const employeeIds = employeeList.map((e) => e.id);
    const emptyId = "00000000-0000-0000-0000-000000000000";
    const idFilter = employeeIds.length ? employeeIds : [emptyId];

    const [
      { data: payslips },
      { data: weeklyAttendance },
      { data: pendingLeave },
      { data: pendingOt },
      { data: pendingFtl },
    ] = await Promise.all([
      admin
        .from("payslips")
        .select("id, employee_id, status, gross_pay, net_pay")
        .eq("payroll_run_id", payrollRunId)
        .in("employee_id", idFilter),
      admin
        .from("weekly_attendance")
        .select("id, employee_id, status")
        .eq("period_start", cutoffStart)
        .eq("period_end", cutoffEnd)
        .in("employee_id", idFilter),
      admin
        .from("leave_requests")
        .select("employee_id")
        .in("employee_id", idFilter)
        .lte("start_date", cutoffEnd)
        .gte("end_date", cutoffStart)
        .in("status", ["pending", "approved_by_pm", "approved_by_manager"]),
      admin
        .from("overtime_requests")
        .select("employee_id")
        .in("employee_id", idFilter)
        .gte("ot_date", cutoffStart)
        .lte("ot_date", cutoffEnd)
        .eq("status", "pending"),
      admin
        .from("failure_to_log")
        .select("employee_id")
        .in("employee_id", idFilter)
        .gte("missed_date", cutoffStart)
        .lte("missed_date", cutoffEnd)
        .eq("status", "pending"),
    ]);

    const holidays = (
      await fetchHolidaysRange(admin as any, { start: cutoffStart, end: cutoffEnd })
    ).map((h) => ({ holiday_date: h.date }));

    const sessions = await fetchSessionsInRange(
      admin,
      `${cutoffStart}T00:00:00`,
      `${cutoffEnd}T23:59:59`
    );

    const clockCounts = new Map<string, number>();
    const clockDatesByEmployee = new Map<string, Set<string>>();

    for (const session of sessions) {
      const empId = String(session.employee_id || "");
      if (!empId || !employeeIds.includes(empId)) continue;
      incrementMap(clockCounts, empId);
      if (session.clock_in_time) {
        const dateStr = manilaDateKeyFromIso(session.clock_in_time);
        if (!clockDatesByEmployee.has(empId)) {
          clockDatesByEmployee.set(empId, new Set());
        }
        clockDatesByEmployee.get(empId)!.add(dateStr);
      }
    }

    const payslipMap = new Map(
      (payslips || []).map((p: any) => [
        p.employee_id,
        {
          id: p.id,
          status: p.status,
          gross_pay: Number(p.gross_pay || 0),
          net_pay: Number(p.net_pay || 0),
        },
      ])
    );

    const timesheetMap = new Map(
      (weeklyAttendance || []).map((t: any) => [
        t.employee_id,
        { id: t.id, status: t.status },
      ])
    );

    const pendingLeaveByEmployee = new Map<string, number>();
    const pendingOtByEmployee = new Map<string, number>();
    const pendingFtlByEmployee = new Map<string, number>();

    (pendingLeave || []).forEach((r: any) =>
      incrementMap(pendingLeaveByEmployee, r.employee_id)
    );
    (pendingOt || []).forEach((r: any) =>
      incrementMap(pendingOtByEmployee, r.employee_id)
    );
    (pendingFtl || []).forEach((r: any) =>
      incrementMap(pendingFtlByEmployee, r.employee_id)
    );

    const summary = validatePayrollEntry({
      periodStart,
      periodEnd,
      periodStartStr: cutoffStart,
      periodEndStr: cutoffEnd,
      employees: employeeList,
      clockCounts,
      clockDatesByEmployee,
      timesheets: timesheetMap,
      payslips: payslipMap,
      holidays,
      pendingLeaveByEmployee,
      pendingOtByEmployee,
      pendingFtlByEmployee,
    });

    return NextResponse.json({
      payroll_run_id: payrollRunId,
      ...summary,
    });
  } catch (error: any) {
    console.error("payroll-runs validate error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to validate payroll run" },
      { status: 500 }
    );
  }
}
