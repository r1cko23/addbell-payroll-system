import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import {
  fetchProjectTimeSessionsForEmployee,
  fetchSessionsForEmployee,
} from "@/lib/timeEntries";

type EmployeeRow = {
  id: string;
  employment_status?: string | null;
  salary_basis?: string | null;
  base_rate?: number | null;
  employment_type?: string | null;
  position?: string | null;
};

function ratePerHourFromEmployee(e: EmployeeRow) {
  // Match the Payslips page's mapping logic:
  // - monthly_rate = (salary_basis === "monthly") ? base_rate : base_rate * 26
  // - per_day      = (salary_basis === "daily")  ? base_rate : monthly_rate / 26
  // - rate_per_hour = per_day / 8
  const basis = String(e.salary_basis || "").toLowerCase();
  const baseRate = Number(e.base_rate ?? 0);
  if (!baseRate || Number.isNaN(baseRate)) return 0;

  const monthlyRate = basis === "monthly" ? baseRate : baseRate * 26;
  const perDay = basis === "daily" ? baseRate : monthlyRate / 26;
  const perHour = perDay / 8;
  return perHour > 0 && Number.isFinite(perHour) ? perHour : 0;
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const body = await req.json();
    const payroll_run_id = body?.payroll_run_id as string | undefined;
    if (!payroll_run_id) {
      return NextResponse.json(
        { error: "payroll_run_id is required" },
        { status: 400 }
      );
    }

    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end, selected_employee_ids")
      .eq("id", payroll_run_id)
      .single();
    if (runErr) throw runErr;
    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const cutoffStart = String(run.cutoff_start);
    const cutoffEnd = String(run.cutoff_end);

    let employeeIdsScope: string[] | null = null;
    if (Array.isArray(run.selected_employee_ids) && run.selected_employee_ids.length > 0) {
      employeeIdsScope = run.selected_employee_ids.map((x: any) => String(x));
    }

    let empQuery = supabase
      .from("employees")
      .select("id, employment_status, salary_basis, base_rate, employment_type, position")
      .eq("employment_status", "active");

    if (employeeIdsScope) {
      empQuery = empQuery.in("id", employeeIdsScope);
    }

    const { data: employees, error: empErr } = await empQuery;
    if (empErr) throw empErr;
    const emps = (employees || []) as EmployeeRow[];
    if (emps.length === 0) {
      return NextResponse.json({ error: "No employees in scope" }, { status: 404 });
    }

    const employeeIds = emps.map((e) => e.id);

    // Load holidays for the cutoff (best-effort; continue without holidays if schema differs)
    let holidays: any[] = [];
    try {
      const { data: holidaysData } = await supabase
        .from("holidays")
        .select("holiday_date, is_regular")
        .gte("holiday_date", cutoffStart)
        .lte("holiday_date", cutoffEnd);

      const { normalizeHolidays } = await import("@/utils/holidays");
      const normalized = normalizeHolidays(
        (holidaysData || []).map((h: any) => ({
          date: h.holiday_date,
          name: "",
          type: h.is_regular ? "regular" : "non-working",
        }))
      );
      holidays = normalized.map((h: any) => ({
        holiday_date: h.date,
        holiday_type: h.type,
      }));
    } catch {
      holidays = [];
    }

    const getDateInManila = (iso: string) => {
      const d = new Date(iso);
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(d);
      return `${parts.find((p) => p.type === "year")!.value}-${
        parts.find((p) => p.type === "month")!.value
      }-${parts.find((p) => p.type === "day")!.value}`;
    };

    // Replace existing payslips for this run (draft regen)
    await supabase.from("payslips").delete().eq("payroll_run_id", payroll_run_id);

    const inserts: any[] = [];
    const skipped: any[] = [];

    for (const e of emps) {
      // Match Payslips page behavior: fetch both main + project sessions, bucketed by Manila date.
      // Use a slightly wider range to avoid timezone edge misses.
      const startWide = new Date(`${cutoffStart}T00:00:00`);
      startWide.setDate(startWide.getDate() - 1);
      const endWide = new Date(`${cutoffEnd}T23:59:59`);
      endWide.setDate(endWide.getDate() + 1);

      const [mainSessions, projectSessions] = await Promise.all([
        fetchSessionsForEmployee(
          supabase,
          e.id,
          startWide.toISOString(),
          endWide.toISOString(),
          getDateInManila
        ),
        fetchProjectTimeSessionsForEmployee(
          supabase,
          e.id,
          startWide.toISOString(),
          endWide.toISOString(),
          getDateInManila
        ),
      ]);

      const employeeSessions = [...(mainSessions || []), ...(projectSessions || [])].filter(
        (s: any) => {
          const clockIn = s?.clock_in_time || s?.clockInTime || s?.clock_in || s?.time_in;
          const iso = String(clockIn || "");
          if (!iso) return false;
          const dateStr = getDateInManila(iso);
          return dateStr >= cutoffStart && dateStr <= cutoffEnd;
        }
      );

      if (employeeSessions.length === 0) {
        skipped.push({ employee_id: e.id, reason: "No time entries in cutoff" });
        continue;
      }

      const periodStartDate = new Date(`${cutoffStart}T00:00:00`);
      const periodEndDate = new Date(`${cutoffEnd}T00:00:00`);

      const isClientBased = e.employment_type === "client-based" || false;
      const isClientBasedAccountSupervisor =
        isClientBased &&
        (String(e.position || "").toUpperCase().includes("ACCOUNT SUPERVISOR") ||
          false);

      const timesheetData = generateTimesheetFromClockEntries(
        employeeSessions as any,
        periodStartDate,
        periodEndDate,
        holidays,
        undefined,
        true,
        true,
        isClientBasedAccountSupervisor,
        undefined,
        undefined,
        isClientBased
      );

      if (!Array.isArray(timesheetData.attendance_data) || timesheetData.attendance_data.length === 0) {
        skipped.push({ employee_id: e.id, reason: "No attendance derived from time entries" });
        continue;
      }

      const ratePerHour = ratePerHourFromEmployee(e);
      const payrollResult =
        ratePerHour > 0
          ? calculateWeeklyPayroll(timesheetData.attendance_data, ratePerHour)
          : null;

      const grossPay = payrollResult?.grossPay ?? 0;
      const deductionsBreakdown = {
        // Draft: keep deductions editable; compute later if needed.
      };

      inserts.push({
        payroll_run_id,
        employee_id: e.id,
        period_start: cutoffStart,
        period_end: cutoffEnd,
        earnings_breakdown: {
          attendance_data: timesheetData.attendance_data,
          payroll_result: payrollResult,
        },
        gross_pay: Math.round(Number(grossPay || 0) * 100) / 100,
        deductions_breakdown: deductionsBreakdown,
        total_deductions: 0,
        net_pay: Math.round(Number(grossPay || 0) * 100) / 100,
        status: "draft",
      });
    }

    if (inserts.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No payslips were generated. Ensure time entries exist for this cutoff.",
          skipped,
        },
        { status: 400 }
      );
    }

    const { error: insertErr } = await supabase.from("payslips").insert(inserts as any);
    if (insertErr) throw insertErr;

    return NextResponse.json({
      success: true,
      payroll_run_id,
      generated: inserts.length,
      skipped: skipped.length > 0 ? skipped : undefined,
    });
  } catch (error: any) {
    console.error("Error generating payroll run payslips:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to generate payslips" },
      { status: 500 }
    );
  }
}

