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
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  calculatePagIBIG,
  calculatePhilHealth,
  calculateSSS,
  calculateSemiMonthlyWithholdingTax,
} from "@/utils/ph-deductions";
import {
  countWeeklyPaysInSemiMonth,
  isFourthStatutoryWeeklyPay,
  isLastWeeklyPayOfSemiMonth,
  semiMonthlyPeriodIndex,
} from "@/lib/weekly-statutory-deductions";
import {
  applyStatutoryProration,
  fetchDistinctWorkDaysMonthToDate,
  statutoryProrationFactorFromDays,
  STATUTORY_PRORATION_REFERENCE_DAYS,
} from "@/lib/statutory-proration";

type EmployeeRow = {
  id: string;
  employment_status?: string | null;
  salary_basis?: string | null;
  base_rate?: number | null;
  employment_type?: string | null;
  position?: string | null;
  transferred_from_employee_id?: string | null;
};

function calculateApprovedOtNightDiffHours(
  startTimeRaw: string | null | undefined,
  endTimeRaw: string | null | undefined,
  otDateRaw: string | null | undefined,
  endDateRaw: string | null | undefined,
  totalHoursRaw: number | null | undefined
): number {
  if (!startTimeRaw || !endTimeRaw) return 0;
  const startTime = startTimeRaw.includes("T")
    ? startTimeRaw.split("T")[1]?.substring(0, 8) || startTimeRaw
    : startTimeRaw.substring(0, 8);
  const endTime = endTimeRaw.includes("T")
    ? endTimeRaw.split("T")[1]?.substring(0, 8) || endTimeRaw
    : endTimeRaw.substring(0, 8);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if (![sh, sm, eh, em].every(Number.isFinite)) return 0;

  const otDate = String(otDateRaw || "").split("T")[0];
  const endDate = String(endDateRaw || otDate).split("T")[0];
  const spansMidnight = Boolean(otDate && endDate && endDate !== otDate);
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  const nightStartMin = 22 * 60;
  const nightEndMin = 6 * 60;
  let nd = 0;

  if (spansMidnight) {
    const ndStart = Math.max(startMin, nightStartMin);
    const hoursToMidnight = (24 * 60 - ndStart) / 60;
    const hoursFromMidnight = Math.min(endMin, nightEndMin) / 60;
    nd = hoursToMidnight + hoursFromMidnight;
  } else if (startMin >= nightStartMin) {
    nd = (endMin - startMin) / 60;
  } else if (endMin >= nightStartMin) {
    nd = (endMin - nightStartMin) / 60;
  }

  const totalHours = Number(totalHoursRaw || 0);
  const capped = Math.min(Math.max(0, nd), totalHours > 0 ? totalHours : nd);
  return Math.round(capped * 100) / 100;
}

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
      .select(
        "id, employment_status, salary_basis, base_rate, employment_type, position, transferred_from_employee_id"
      )
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

    // Preload approved Failure-to-Log rows for this cutoff and pair IN+OUT by employee/date.
    const approvedFtlByEmployeeDate = new Map<
      string,
      { inTime: string | null; outTime: string | null; sourceId: string }
    >();
    const { data: approvedFtlRows } = await supabase
      .from("failure_to_log")
      .select(
        "id, employee_id, missed_date, actual_clock_in_time, actual_clock_out_time, entry_type, status"
      )
      .in("employee_id", employeeIds)
      .gte("missed_date", cutoffStart)
      .lte("missed_date", cutoffEnd)
      .eq("status", "approved");

    (approvedFtlRows || []).forEach((row: any) => {
      if (!row.employee_id || !row.missed_date) return;
      const dateKey = String(row.missed_date).split("T")[0];
      const key = `${row.employee_id}::${dateKey}`;
      const pair = approvedFtlByEmployeeDate.get(key) || {
        inTime: null,
        outTime: null,
        sourceId: row.id,
      };
      if (
        (row.entry_type === "in" || row.entry_type === "both") &&
        row.actual_clock_in_time
      ) {
        pair.inTime = row.actual_clock_in_time;
      }
      if (
        (row.entry_type === "out" || row.entry_type === "both") &&
        row.actual_clock_out_time
      ) {
        pair.outTime = row.actual_clock_out_time;
      }
      pair.sourceId = pair.sourceId || row.id;
      approvedFtlByEmployeeDate.set(key, pair);
    });

    const approvedOtByEmployeeDate = new Map<string, Map<string, number>>();
    const approvedNdByEmployeeDate = new Map<string, Map<string, number>>();
    const { data: approvedOtRows } = await supabase
      .from("overtime_requests")
      .select("employee_id, ot_date, end_date, start_time, end_time, total_hours, status")
      .in("employee_id", employeeIds)
      .gte("ot_date", cutoffStart)
      .lte("ot_date", cutoffEnd)
      .in("status", ["approved", "approved_by_manager", "approved_by_hr"]);

    (approvedOtRows || []).forEach((row: any) => {
      const employeeId = row.employee_id as string | undefined;
      if (!employeeId) return;
      const dateKey = String(row.ot_date || "").split("T")[0];
      if (!dateKey) return;
      const otHours = Number(row.total_hours || 0);
      const ndHours = calculateApprovedOtNightDiffHours(
        row.start_time,
        row.end_time,
        row.ot_date,
        row.end_date,
        row.total_hours
      );

      const otByDate = approvedOtByEmployeeDate.get(employeeId) || new Map<string, number>();
      otByDate.set(dateKey, Math.round(((otByDate.get(dateKey) || 0) + otHours) * 100) / 100);
      approvedOtByEmployeeDate.set(employeeId, otByDate);

      const ndByDate = approvedNdByEmployeeDate.get(employeeId) || new Map<string, number>();
      ndByDate.set(dateKey, Math.round(((ndByDate.get(dateKey) || 0) + ndHours) * 100) / 100);
      approvedNdByEmployeeDate.set(employeeId, ndByDate);
    });

    // Replace existing payslips for this run (draft regen).
    // Important: If RLS blocks this delete, we must fail; otherwise the UI will appear to "reuse cached" rows.
    const { error: deleteErr } = await supabase
      .from("payslips")
      .delete()
      .eq("payroll_run_id", payroll_run_id);
    if (deleteErr) throw deleteErr;

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

      // Add synthetic sessions from approved FTL IN+OUT pairs when both times exist.
      const ftlSessionsForEmployee: any[] = [];
      approvedFtlByEmployeeDate.forEach((pair, key) => {
        const [employeeId, dateKey] = key.split("::");
        if (employeeId !== e.id) return;
        if (!pair.inTime || !pair.outTime) return;
        if (dateKey < cutoffStart || dateKey > cutoffEnd) return;
        ftlSessionsForEmployee.push({
          id: `ftl-${pair.sourceId}`,
          employee_id: e.id,
          clock_in_time: pair.inTime,
          clock_out_time: pair.outTime,
          regular_hours: null,
          overtime_hours: 0,
          total_night_diff_hours: 0,
          status: "approved",
        });
      });
      employeeSessions.push(...ftlSessionsForEmployee);

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
        approvedOtByEmployeeDate.get(e.id),
        approvedNdByEmployeeDate.get(e.id),
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
      const periodEndTuesday = new Date(`${cutoffEnd}T00:00:00`);

      // Monthly basic salary mapping (matches /payslips page behavior).
      const basis = String(e.salary_basis || "").toLowerCase();
      const baseRate = Number(e.base_rate ?? 0);
      const monthlyBasicSalary =
        baseRate > 0
          ? basis === "monthly"
            ? baseRate
            : baseRate * 26
          : 0;
      const validMonthlySalary = monthlyBasicSalary > 0 ? monthlyBasicSalary : 0;

      // Statutory contributions (employee shares)
      const sssContribution = calculateSSS(validMonthlySalary);
      const philhealthContribution = calculatePhilHealth(validMonthlySalary);
      const pagibigContribution = calculatePagIBIG(validMonthlySalary);

      let mtdWorkDaysForSave = STATUTORY_PRORATION_REFERENCE_DAYS;
      let prorationFactorSave = 1;
      try {
        const clockIds = [
          e.id,
          e.transferred_from_employee_id,
        ].filter(Boolean) as string[];
        mtdWorkDaysForSave = await fetchDistinctWorkDaysMonthToDate(
          supabase as any,
          clockIds,
          periodEndTuesday
        );
        prorationFactorSave = statutoryProrationFactorFromDays(mtdWorkDaysForSave);
      } catch {
        mtdWorkDaysForSave = STATUTORY_PRORATION_REFERENCE_DAYS;
        prorationFactorSave = 1;
      }

      const takeStatutory =
        grossPay > 0 && isFourthStatutoryWeeklyPay(periodEndTuesday);
      const sssRegularAmount =
        takeStatutory && validMonthlySalary > 0
          ? applyStatutoryProration(
              Math.round((sssContribution.regularEmployeeShare ?? 0) * 100) / 100,
              prorationFactorSave
            )
          : 0;
      const sssWispAmount =
        takeStatutory && validMonthlySalary > 0 && (sssContribution.wispEmployeeShare ?? 0) > 0
          ? applyStatutoryProration(
              Math.round((sssContribution.wispEmployeeShare ?? 0) * 100) / 100,
              prorationFactorSave
            )
          : 0;
      const philhealthAmount =
        takeStatutory && validMonthlySalary > 0
          ? applyStatutoryProration(
              Math.round((philhealthContribution.employeeShare ?? 0) * 100) / 100,
              prorationFactorSave
            )
          : 0;
      const pagibigAmount =
        takeStatutory && validMonthlySalary > 0
          ? applyStatutoryProration(
              Math.round((pagibigContribution.employeeShare ?? 0) * 100) / 100,
              prorationFactorSave
            )
          : 0;

      // Withholding tax (semi-monthly settlement on last Tue of each half)
      let withholdingTax = 0;
      const takeSemiMonthTax =
        grossPay > 0 && isLastWeeklyPayOfSemiMonth(periodEndTuesday);
      if (takeSemiMonthTax && (grossPay > 0 || validMonthlySalary > 0)) {
        const monthlyContributionsFull =
          (sssContribution.employeeShare ?? 0) +
          (philhealthContribution.employeeShare ?? 0) +
          (pagibigContribution.employeeShare ?? 0);
        const monthlyContributions = applyStatutoryProration(
          Math.round(monthlyContributionsFull * 100) / 100,
          prorationFactorSave
        );
        const halfMonthlyContrib = Math.round((monthlyContributions / 2) * 100) / 100;

        const curEndStr = format(periodEndTuesday, "yyyy-MM-dd");
        const startM = startOfMonth(periodEndTuesday);
        const endM = endOfMonth(periodEndTuesday);
        const half = semiMonthlyPeriodIndex(periodEndTuesday);

        // Fetch existing payslips for same month to compute prior gross+tax in this semi-month.
        const { data: monthRows } = await (supabase as any)
          .from("payslips")
          .select("gross_pay, adjustment_amount, period_end, deductions_breakdown")
          .eq("employee_id", e.id)
          .gte("period_end", format(startM, "yyyy-MM-dd"))
          .lte("period_end", format(endM, "yyyy-MM-dd"));

        let grossOther = 0;
        let taxPrior = 0;
        for (const row of monthRows || []) {
          if (row.period_end === curEndStr) continue;
          const [py, pm, pd] = String(row.period_end || "")
            .split("-")
            .map(Number);
          if (!py || !pm || !pd) continue;
          const rowEnd = new Date(py, pm - 1, pd);
          if (semiMonthlyPeriodIndex(rowEnd) !== half) continue;
          grossOther += Number(row.gross_pay ?? 0) + Number(row.adjustment_amount ?? 0);
          const br = row.deductions_breakdown as { tax?: number } | undefined;
          taxPrior += typeof br?.tax === "number" ? br.tax : 0;
        }
        grossOther = Math.round(grossOther * 100) / 100;
        taxPrior = Math.round(taxPrior * 100) / 100;

        const nSemiWeeks = countWeeklyPaysInSemiMonth(periodEndTuesday);
        const actualSemiGross =
          monthRows != null
            ? Math.round((grossOther + grossPay) * 100) / 100
            : Math.round(grossPay * nSemiWeeks * 100) / 100;

        const semiTaxableIncome = Math.max(0, actualSemiGross - halfMonthlyContrib);
        const semiTaxDue = calculateSemiMonthlyWithholdingTax(semiTaxableIncome);
        withholdingTax = Math.max(0, Math.round((semiTaxDue - taxPrior) * 100) / 100);
      }

      const totalDeductions =
        Math.round(
          (sssRegularAmount +
            sssWispAmount +
            philhealthAmount +
            pagibigAmount +
            withholdingTax) *
            100
        ) / 100;
      const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

      const deductionsBreakdown: any = {
        tax: withholdingTax,
        sss: sssRegularAmount,
        sss_wisp: sssWispAmount,
        philhealth: philhealthAmount,
        pagibig: pagibigAmount,
        statutory_mtd_work_days: mtdWorkDaysForSave,
        statutory_proration_factor: prorationFactorSave,
        statutory_reference_days: STATUTORY_PRORATION_REFERENCE_DAYS,
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
        total_deductions: totalDeductions,
        net_pay: netPay,
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

    // Upsert makes regenerate idempotent even if deletes are partially blocked by policies.
    const { error: insertErr } = await supabase
      .from("payslips")
      .upsert(inserts as any, { onConflict: "payroll_run_id,employee_id" });
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

