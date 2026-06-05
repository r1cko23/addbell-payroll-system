/**
 * Payroll Entry validation (Frappe HR pre-check before bulk payslip generation).
 * Addbell: weekly Wed–Tue cutoffs, weekly_attendance finalize gate.
 */

import { parseISO } from "date-fns";
import { calculateBasePay } from "@/utils/base-pay-calculator";
import { getRatePerHour, type RateEmployee } from "./employee-rates";
import type { TimesheetReviewStatus } from "./timesheet-review";

export type PayrollEntryStatus = "saved" | "ready" | "warning" | "blocked";

export interface PayrollEntryEmployeeInput extends RateEmployee {
  id: string;
  employee_id: string;
  full_name: string;
  position?: string | null;
  job_level?: string | null;
  employment_type?: string | null;
  hire_date?: string | null;
  employment_status?: string | null;
}

export interface PayrollEntryRow {
  employeeId: string;
  employeeCode: string;
  fullName: string;
  position: string | null;
  jobLevel: string | null;
  status: PayrollEntryStatus;
  timesheetStatus: TimesheetReviewStatus;
  issues: string[];
  warnings: string[];
  clockEntryCount: number;
  absences: number;
  hasRate: boolean;
  payslipId: string | null;
  payslipStatus: string | null;
  grossPay: number | null;
  netPay: number | null;
  pendingLeaveCount: number;
  pendingOtCount: number;
  pendingFtlCount: number;
}

export interface PayrollEntrySummary {
  periodStart: string;
  periodEnd: string;
  total: number;
  saved: number;
  ready: number;
  warning: number;
  blocked: number;
  timesheetsFinalized: number;
  timesheetsDraft: number;
  timesheetsMissing: number;
  totalGross: number;
  totalNet: number;
  rows: PayrollEntryRow[];
}

export function hasEmployeePayRate(emp: PayrollEntryEmployeeInput): boolean {
  return getRatePerHour(emp) > 0;
}

function countAbsences(
  emp: PayrollEntryEmployeeInput,
  clockEntryDates: Set<string>,
  holidays: Array<{ holiday_date: string }>,
  periodStart: Date,
  periodEnd: Date
): number {
  const isClientBased = emp.employment_type === "client-based";
  const isAccountSupervisor =
    emp.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") ?? false;

  const result = calculateBasePay({
    periodStart,
    periodEnd,
    clockEntries: Array.from(clockEntryDates).map((date) => ({
      clock_in_time: `${date}T08:00:00`,
      clock_out_time: `${date}T17:00:00`,
    })),
    holidays,
    isClientBased: isClientBased || isAccountSupervisor,
    hireDate: emp.hire_date ? parseISO(emp.hire_date) : undefined,
  });

  return result.absences;
}

export function buildPayrollEntryRow(
  emp: PayrollEntryEmployeeInput,
  params: {
    clockEntryCount: number;
    clockEntryDates: Set<string>;
    timesheet: { id: string; status: string } | null;
    payslip: {
      id: string;
      status: string;
      gross_pay: number;
      net_pay: number;
    } | null;
    holidays: Array<{ holiday_date: string }>;
    periodStart: Date;
    periodEnd: Date;
    pendingLeaveCount?: number;
    pendingOtCount?: number;
    pendingFtlCount?: number;
  }
): PayrollEntryRow {
  const issues: string[] = [];
  const warnings: string[] = [];
  const hasRate = hasEmployeePayRate(emp);
  const timesheetStatus: TimesheetReviewStatus = !params.timesheet
    ? "missing"
    : params.timesheet.status === "finalized"
      ? "finalized"
      : "draft";

  const pendingLeave = params.pendingLeaveCount ?? 0;
  const pendingOt = params.pendingOtCount ?? 0;
  const pendingFtl = params.pendingFtlCount ?? 0;

  if (!hasRate) {
    issues.push("Missing pay rate (base_rate + salary_basis)");
  }

  if (!params.payslip && timesheetStatus !== "finalized") {
    issues.push("Timesheet not finalized for this cutoff");
  }

  if (pendingLeave > 0) {
    warnings.push(`${pendingLeave} pending leave request(s) in cutoff`);
  }
  if (pendingOt > 0) {
    warnings.push(`${pendingOt} pending OT request(s) in cutoff`);
  }
  if (pendingFtl > 0) {
    warnings.push(`${pendingFtl} pending failure-to-log request(s) in cutoff`);
  }

  const absences = countAbsences(
    emp,
    params.clockEntryDates,
    params.holidays,
    params.periodStart,
    params.periodEnd
  );

  if (absences > 0) {
    warnings.push(`${absences} absence(s) in cutoff`);
  }

  if (params.clockEntryCount === 0) {
    const isManagerial =
      emp.job_level?.toUpperCase() === "MANAGERIAL" ||
      emp.job_level?.toUpperCase() === "SUPERVISORY";
    if (isManagerial) {
      warnings.push("No clock sessions (managerial — base pay may still apply)");
    } else if (emp.employment_type !== "client-based") {
      warnings.push("No clock sessions (office-based may still get Saturday credit)");
    } else {
      issues.push("No clock sessions for client-based employee");
    }
  }

  let status: PayrollEntryStatus;
  if (params.payslip) {
    status = "saved";
  } else if (issues.length > 0) {
    status = "blocked";
  } else if (warnings.length > 0) {
    status = "warning";
  } else {
    status = "ready";
  }

  return {
    employeeId: emp.id,
    employeeCode: emp.employee_id,
    fullName: emp.full_name,
    position: emp.position ?? null,
    jobLevel: emp.job_level ?? null,
    status,
    timesheetStatus,
    issues,
    warnings,
    clockEntryCount: params.clockEntryCount,
    absences,
    hasRate,
    payslipId: params.payslip?.id ?? null,
    payslipStatus: params.payslip?.status ?? null,
    grossPay: params.payslip?.gross_pay ?? null,
    netPay: params.payslip?.net_pay ?? null,
    pendingLeaveCount: pendingLeave,
    pendingOtCount: pendingOt,
    pendingFtlCount: pendingFtl,
  };
}

export function summarizePayrollEntry(
  rows: PayrollEntryRow[]
): Omit<PayrollEntrySummary, "periodStart" | "periodEnd" | "rows"> {
  return {
    total: rows.length,
    saved: rows.filter((r) => r.status === "saved").length,
    ready: rows.filter((r) => r.status === "ready").length,
    warning: rows.filter((r) => r.status === "warning").length,
    blocked: rows.filter((r) => r.status === "blocked").length,
    timesheetsFinalized: rows.filter((r) => r.timesheetStatus === "finalized").length,
    timesheetsDraft: rows.filter((r) => r.timesheetStatus === "draft").length,
    timesheetsMissing: rows.filter((r) => r.timesheetStatus === "missing").length,
    totalGross: rows.reduce((s, r) => s + (r.grossPay ?? 0), 0),
    totalNet: rows.reduce((s, r) => s + (r.netPay ?? 0), 0),
  };
}

export function validatePayrollEntry(params: {
  periodStart: Date;
  periodEnd: Date;
  periodStartStr: string;
  periodEndStr: string;
  employees: PayrollEntryEmployeeInput[];
  clockCounts: Map<string, number>;
  clockDatesByEmployee: Map<string, Set<string>>;
  timesheets: Map<string, { id: string; status: string }>;
  payslips: Map<
    string,
    { id: string; status: string; gross_pay: number; net_pay: number }
  >;
  holidays: Array<{ holiday_date: string }>;
  pendingLeaveByEmployee?: Map<string, number>;
  pendingOtByEmployee?: Map<string, number>;
  pendingFtlByEmployee?: Map<string, number>;
}): PayrollEntrySummary {
  const rows = params.employees.map((emp) =>
    buildPayrollEntryRow(emp, {
      clockEntryCount: params.clockCounts.get(emp.id) ?? 0,
      clockEntryDates: params.clockDatesByEmployee.get(emp.id) ?? new Set(),
      timesheet: params.timesheets.get(emp.id) ?? null,
      payslip: params.payslips.get(emp.id) ?? null,
      holidays: params.holidays,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      pendingLeaveCount: params.pendingLeaveByEmployee?.get(emp.id) ?? 0,
      pendingOtCount: params.pendingOtByEmployee?.get(emp.id) ?? 0,
      pendingFtlCount: params.pendingFtlByEmployee?.get(emp.id) ?? 0,
    })
  );

  return {
    periodStart: params.periodStartStr,
    periodEnd: params.periodEndStr,
    ...summarizePayrollEntry(rows),
    rows,
  };
}

export function payrollEntryRowsToCsv(rows: PayrollEntryRow[]): string {
  const blocked = rows.filter((r) => r.status === "blocked");
  const header = [
    "Employee Code",
    "Name",
    "Status",
    "Timesheet",
    "Issues",
    "Warnings",
  ].join(",");
  const lines = blocked.map((r) =>
    [
      r.employeeCode,
      `"${r.fullName.replace(/"/g, '""')}"`,
      r.status,
      r.timesheetStatus,
      `"${r.issues.join("; ").replace(/"/g, '""')}"`,
      `"${r.warnings.join("; ").replace(/"/g, '""')}"`,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}
