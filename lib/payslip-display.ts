import {
  normalizeEarningsBreakdownForExport,
  regularHoursBasicGross,
} from "@/lib/payroll-earnings-breakdown";
import { mapPayslipAttendanceDays } from "@/lib/map-payslip-attendance-days";
import type { ClockEntryForPayslipMap } from "@/lib/map-payslip-attendance-days";

export { regularHoursBasicGross };

export type PayslipRowForDisplay = {
  gross_pay: number;
  net_pay: number;
  total_deductions: number;
  adjustment_amount?: number;
  adjustment_reason?: string | null;
  allowance_amount?: number;
  sss_amount?: number;
  philhealth_amount?: number;
  pagibig_amount?: number;
  withholding_tax?: number;
  earnings_breakdown?: unknown;
  deductions_breakdown?: Record<string, unknown> | null;
  period_start: string;
  period_end: string;
};

export type EmployeeProfileForPayslip = {
  employee_id: string;
  full_name: string;
  position?: string | null;
  employment_type?: string | null;
  job_level?: string | null;
  salary_basis?: string | null;
  base_rate?: number | null;
  hire_date?: string | null;
};

const BR_SSS = "sss";
const BR_SSS_WISP = "sss_wisp";

export function ratePerDayAndHourFromProfile(profile: EmployeeProfileForPayslip): {
  perDay: number;
  perHour: number;
} {
  const basis = String(profile.salary_basis || "daily").toLowerCase();
  const baseRate = Number(profile.base_rate ?? 0);
  if (!baseRate) return { perDay: 0, perHour: 0 };
  const perDay = basis === "daily" ? baseRate : baseRate / 26;
  const perHour = perDay / 8;
  return {
    perDay: perDay > 0 && Number.isFinite(perDay) ? perDay : 0,
    perHour: perHour > 0 && Number.isFinite(perHour) ? perHour : 0,
  };
}

export function getAttendanceDataFromEarningsBreakdown(raw: unknown): any[] {
  const normalized = normalizeEarningsBreakdownForExport(raw);
  return normalized?.attendance_data ?? [];
}

/** Attendance days for print/breakdown; merges clock when sessions are provided. */
export function attendanceDataForPayslipView(
  earningsBreakdown: unknown,
  clockEntries: ClockEntryForPayslipMap[] = []
): any[] {
  const raw = getAttendanceDataFromEarningsBreakdown(earningsBreakdown);
  if (clockEntries.length > 0) {
    return mapPayslipAttendanceDays(raw, clockEntries);
  }
  return raw;
}

export function attendanceForPayslipPrint(payslip: PayslipRowForDisplay) {
  return {
    attendance_data: getAttendanceDataFromEarningsBreakdown(
      payslip.earnings_breakdown
    ),
    gross_pay: Number(payslip.gross_pay ?? 0),
  };
}

export function sssPartsFromPayslip(p: PayslipRowForDisplay): {
  regular: number;
  wisp: number;
} {
  const br = p.deductions_breakdown;
  if (!br || typeof br !== "object") {
    return {
      regular: Number(p.sss_amount ?? 0),
      wisp: 0,
    };
  }
  const wisp = Number(br[BR_SSS_WISP] ?? 0);
  const reg = Number(br[BR_SSS] ?? NaN);
  if (Number.isFinite(reg) && reg >= 0 && (reg > 0 || wisp > 0)) {
    return { regular: reg, wisp: Number.isFinite(wisp) ? wisp : 0 };
  }
  const totalSss = Number(p.sss_amount ?? 0);
  return {
    regular: Math.max(0, totalSss - (Number.isFinite(wisp) ? wisp : 0)),
    wisp: Number.isFinite(wisp) ? wisp : 0,
  };
}

export function mapPayslipDeductionsForPrint(p: PayslipRowForDisplay) {
  const br = (p.deductions_breakdown || {}) as Record<string, unknown>;
  const weekly = (br.weekly || {}) as Record<string, unknown>;
  const sss = sssPartsFromPayslip(p);
  const num = (v: unknown) => {
    const n = Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    vale: num(weekly.vale ?? br.vale_amount ?? br.vale),
    sssLoan: num(weekly.sss_loan ?? br.sss_salary_loan ?? br.sss_loan),
    sssCalamityLoan: num(weekly.sss_calamity ?? br.sss_calamity_loan),
    pagibigLoan: num(weekly.pagibig_loan ?? br.pagibig_salary_loan),
    pagibigCalamityLoan: num(weekly.pagibig_calamity ?? br.pagibig_calamity_loan),
    sssContribution: sss.regular,
    sssWisp: sss.wisp,
    philhealthContribution: num(br.philhealth ?? p.philhealth_amount),
    pagibigContribution: num(br.pagibig ?? p.pagibig_amount),
    withholdingTax: num(br.tax ?? br.withholding_tax ?? p.withholding_tax),
    totalDeductions: num(p.total_deductions),
  };
}

export function employeeForPayslipComponents(
  profile: EmployeeProfileForPayslip
) {
  const { perDay, perHour } = ratePerDayAndHourFromProfile(profile);
  const employeeType =
    profile.employment_type === "client-based"
      ? ("client-based" as const)
      : profile.employment_type
        ? ("office-based" as const)
        : null;
  return {
    employee_id: profile.employee_id,
    full_name: profile.full_name,
    rate_per_day: perDay,
    rate_per_hour: perHour,
    position: profile.position ?? null,
    assigned_hotel: null,
    employee_type: employeeType,
    job_level: profile.job_level ?? null,
    hire_date: profile.hire_date ?? null,
    termination_date: null,
  };
}

export function mapAttendanceDaysForBreakdown(
  attendanceData: any[]
): Array<{
  date: string;
  dayType: string;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  clockInTime?: string;
  clockOutTime?: string;
}> {
  return attendanceData.map((day: any) => ({
    date: day.date || "",
    dayType: day.dayType || "regular",
    regularHours: Number(day.regularHours ?? 0),
    overtimeHours: Number(day.overtimeHours ?? 0),
    nightDiffHours: Number(day.nightDiffHours ?? 0),
    clockInTime: day.clockInTime,
    clockOutTime: day.clockOutTime,
  }));
}
