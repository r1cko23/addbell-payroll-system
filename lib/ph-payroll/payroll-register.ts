/**
 * Payroll Register — consolidated salary slip view (Frappe Salary Register pattern).
 * Reads saved payslips only; supports Addbell weekly cutoffs + semi-monthly rollup.
 */

import { format } from "date-fns";
import {
  getBiMonthlyPeriodEnd,
  getBiMonthlyPeriodStart,
  formatBiMonthlyPeriod,
  getWednesdayWeekStart,
  getWeeklyCutoffEnd,
  formatWeeklyCutoffPeriod,
} from "@/utils/bimonthly";
import { creditNightDiffHours, creditOvertimeHours, creditWorkHoursHalfHour } from "@/utils/overtime";
import { normalizeEarningsBreakdownForExport } from "@/lib/payroll-earnings-breakdown";
import { getRatePerHour, getRatePerDay } from "./employee-rates";
import type { RateEmployee } from "./employee-rates";

export type RegisterPeriodMode = "weekly" | "semi-monthly";

export type RegisterPeriod = {
  mode: RegisterPeriodMode;
  periodStart: Date;
  periodEnd: Date;
  periodStartStr: string;
  periodEndStr: string;
  label: string;
};

export type RegisterPayslip = {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  earnings_breakdown: unknown;
  gross_pay: number;
  deductions_breakdown: unknown;
  total_deductions: number;
  sss_amount: number;
  philhealth_amount: number;
  pagibig_amount: number;
  withholding_tax: number;
  allowance_amount: number;
  net_pay: number;
  status: string;
};

export type RegisterAllowance = {
  transpo_allowance: number;
  load_allowance: number;
  allowance: number;
  refund: number;
};

export type RegisterDeductionExtras = {
  other_deduction: number;
  sss_pro: number;
};

export type RegisterRow = {
  employeeName: string;
  dailyRate: number;
  hoursWorked: number;
  daysWorked: number;
  basicSalary: number;
  totalSalary: number;
  regOTHours: number;
  regOTAmount: number;
  nightDiffHours: number;
  nightDiffAmount: number;
  specialHolidayHours: number;
  specialHolidayAmount: number;
  specialHolidayOTHours: number;
  specialHolidayOTAmount: number;
  restdayHours: number;
  restdayAmount: number;
  totalOTAmount: number;
  serviceIncentiveLeaveAmount: number;
  refund: number;
  transpoAllowance: number;
  loadAllowance: number;
  allowance: number;
  grossAmount: number;
  sss: number;
  sssPRO: number;
  philhealth: number;
  pagibig: number;
  withholdingTax: number;
  sssLoan: number;
  otherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  thirteenthMonthCutoff: number;
  silCutoff: number;
  thirteenthMonthYTD: number;
  /** Weekly slips rolled into this row (semi-monthly mode). */
  payslipCount: number;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function resolveRegisterPeriod(
  anchorDate: Date,
  mode: RegisterPeriodMode
): RegisterPeriod {
  if (mode === "weekly") {
    const periodStart = getWednesdayWeekStart(anchorDate);
    const periodEnd = getWeeklyCutoffEnd(periodStart);
    return {
      mode,
      periodStart,
      periodEnd,
      periodStartStr: format(periodStart, "yyyy-MM-dd"),
      periodEndStr: format(periodEnd, "yyyy-MM-dd"),
      label: formatWeeklyCutoffPeriod(periodStart, periodEnd),
    };
  }

  const periodStart = getBiMonthlyPeriodStart(anchorDate);
  const periodEnd = getBiMonthlyPeriodEnd(periodStart);
  return {
    mode,
    periodStart,
    periodEnd,
    periodStartStr: format(periodStart, "yyyy-MM-dd"),
    periodEndStr: format(periodEnd, "yyyy-MM-dd"),
    label: formatBiMonthlyPeriod(periodStart, periodEnd),
  };
}

/** Payslip overlaps register window (for semi-monthly rollup). */
export function payslipOverlapsPeriod(
  slip: Pick<RegisterPayslip, "period_start" | "period_end">,
  periodStartStr: string,
  periodEndStr: string
): boolean {
  return slip.period_start <= periodEndStr && slip.period_end >= periodStartStr;
}

function breakdownAmountsFromDays(
  days: any[],
  ratePerHour: number,
  totals?: {
    regularPay?: number;
    overtimePay?: number;
    nightDiffPay?: number;
  }
) {
  let hoursWorked = 0;
  let daysWorked = 0;
  let basicSalary = 0;
  let regOTHours = 0;
  let regOTAmount = 0;
  let nightDiffHours = 0;
  let nightDiffAmount = 0;
  let specialHolidayHours = 0;
  let specialHolidayAmount = 0;
  let specialHolidayOTHours = 0;
  let specialHolidayOTAmount = 0;
  let restdayHours = 0;
  let restdayAmount = 0;

  for (const day of days) {
    const regularHours = creditWorkHoursHalfHour(
      Math.round((Number(day.regularHours) || 0) * 100) / 100
    );
    const overtimeHours = creditOvertimeHours(
      Math.round((Number(day.overtimeHours) || 0) * 100) / 100
    );
    const nightDiff = creditNightDiffHours(
      Math.round((Number(day.nightDiffHours) || 0) * 100) / 100
    );
    const dayType = day.dayType || "regular";

    hoursWorked += regularHours;
    if (regularHours >= 8) daysWorked += regularHours / 8;
    basicSalary += round2(regularHours * ratePerHour);

    if (dayType === "regular" && overtimeHours > 0) {
      regOTHours += overtimeHours;
      regOTAmount += round2(overtimeHours * ratePerHour * 1.25);
    }

    nightDiffHours += nightDiff;
    nightDiffAmount += round2(nightDiff * ratePerHour * 0.1);

    if (dayType === "special-holiday" || dayType === "non-working-holiday") {
      specialHolidayHours += regularHours;
      specialHolidayAmount += round2(regularHours * ratePerHour * 1.3);
      if (overtimeHours > 0) {
        specialHolidayOTHours += overtimeHours;
        specialHolidayOTAmount += round2(overtimeHours * ratePerHour * 1.69);
      }
    }

    if (dayType === "rest-day" || dayType === "sunday") {
      restdayHours += regularHours;
      restdayAmount += round2(regularHours * ratePerHour * 1.3);
    }
  }

  if (totals) {
    if (totals.regularPay && totals.regularPay > basicSalary) {
      basicSalary = round2(totals.regularPay);
    }
    if (totals.overtimePay && totals.overtimePay > regOTAmount) {
      regOTAmount = round2(totals.overtimePay);
    }
    if (totals.nightDiffPay && totals.nightDiffPay > nightDiffAmount) {
      nightDiffAmount = round2(totals.nightDiffPay);
    }
  }

  const totalOTAmount = round2(
    regOTAmount + nightDiffAmount + specialHolidayOTAmount + (restdayHours > 0 ? restdayAmount : 0)
  );

  return {
    hoursWorked: round2(hoursWorked),
    daysWorked: round2(daysWorked),
    basicSalary: round2(basicSalary),
    regOTHours: round2(regOTHours),
    regOTAmount: round2(regOTAmount),
    nightDiffHours: round2(nightDiffHours),
    nightDiffAmount: round2(nightDiffAmount),
    specialHolidayHours: round2(specialHolidayHours),
    specialHolidayAmount: round2(specialHolidayAmount),
    specialHolidayOTHours: round2(specialHolidayOTHours),
    specialHolidayOTAmount: round2(specialHolidayOTAmount),
    restdayHours: round2(restdayHours),
    restdayAmount: round2(restdayAmount),
    totalOTAmount,
  };
}

function sssLoanFromBreakdown(deductionsBreakdown: unknown): number {
  if (!deductionsBreakdown || typeof deductionsBreakdown !== "object") return 0;
  const ded = deductionsBreakdown as Record<string, unknown>;
  const weekly = (ded.weekly as Record<string, unknown>) || {};
  return round2(
    Number(weekly.sss_loan ?? ded.sssLoan ?? 0) +
      Number(weekly.sss_calamity ?? ded.sss_calamity_loan ?? 0) +
      Number(ded.sss_salary_loan ?? 0) +
      Number(ded.sss_calamity_loan ?? 0)
  );
}

export function buildRegisterRow(params: {
  employeeName: string;
  employee: RateEmployee & { monthly_rate?: number | null; per_day?: number | null };
  payslips: RegisterPayslip[];
  allowance?: RegisterAllowance;
  deductionExtras?: RegisterDeductionExtras;
  thirteenthMonthYTD?: number;
}): RegisterRow {
  const {
    employeeName,
    employee,
    payslips,
    allowance = {
      transpo_allowance: 0,
      load_allowance: 0,
      allowance: 0,
      refund: 0,
    },
    deductionExtras = { other_deduction: 0, sss_pro: 0 },
    thirteenthMonthYTD = 0,
  } = params;

  const dailyRate = round2(getRatePerDay(employee));
  const ratePerHour = getRatePerHour(employee);

  let hoursWorked = 0;
  let daysWorked = 0;
  let basicSalary = 0;
  let regOTHours = 0;
  let regOTAmount = 0;
  let nightDiffHours = 0;
  let nightDiffAmount = 0;
  let specialHolidayHours = 0;
  let specialHolidayAmount = 0;
  let specialHolidayOTHours = 0;
  let specialHolidayOTAmount = 0;
  let restdayHours = 0;
  let restdayAmount = 0;
  let totalOTAmount = 0;

  let grossPaySum = 0;
  let netPaySum = 0;
  let sssSum = 0;
  let philhealthSum = 0;
  let pagibigSum = 0;
  let withholdingTaxSum = 0;
  let sssLoanSum = 0;
  let totalDeductionSum = 0;

  for (const payslip of payslips) {
    const normalized = normalizeEarningsBreakdownForExport(payslip.earnings_breakdown);
    const days = normalized?.attendance_data || [];
    const payrollTotals = normalized?.payroll_result?.totals;

    const part = breakdownAmountsFromDays(days, ratePerHour, payrollTotals);
    hoursWorked += part.hoursWorked;
    daysWorked += part.daysWorked;
    basicSalary += part.basicSalary;
    regOTHours += part.regOTHours;
    regOTAmount += part.regOTAmount;
    nightDiffHours += part.nightDiffHours;
    nightDiffAmount += part.nightDiffAmount;
    specialHolidayHours += part.specialHolidayHours;
    specialHolidayAmount += part.specialHolidayAmount;
    specialHolidayOTHours += part.specialHolidayOTHours;
    specialHolidayOTAmount += part.specialHolidayOTAmount;
    restdayHours += part.restdayHours;
    restdayAmount += part.restdayAmount;
    totalOTAmount += part.totalOTAmount;

    grossPaySum += Number(payslip.gross_pay || 0);
    netPaySum += Number(payslip.net_pay || 0);
    sssSum += Number(payslip.sss_amount || 0);
    philhealthSum += Number(payslip.philhealth_amount || 0);
    pagibigSum += Number(payslip.pagibig_amount || 0);
    withholdingTaxSum += Number(payslip.withholding_tax || 0);
    sssLoanSum += sssLoanFromBreakdown(payslip.deductions_breakdown);
    totalDeductionSum += Number(payslip.total_deductions || 0);
  }

  const totalSalary = grossPaySum > 0 ? round2(grossPaySum) : round2(basicSalary + totalOTAmount);
  const grossAmount = round2(
    totalSalary +
      allowance.transpo_allowance +
      allowance.load_allowance +
      allowance.allowance +
      allowance.refund
  );

  const sssPRO = round2(deductionExtras.sss_pro);
  const otherDeduction = round2(deductionExtras.other_deduction);
  const totalDeduction = round2(
    totalDeductionSum > 0
      ? totalDeductionSum + sssPRO + otherDeduction
      : sssSum +
          sssPRO +
          philhealthSum +
          pagibigSum +
          withholdingTaxSum +
          sssLoanSum +
          otherDeduction
  );
  const netAmount = netPaySum > 0 ? round2(netPaySum) : round2(grossAmount - totalDeduction);

  const monthlyBasic =
    Number(employee.monthly_rate || 0) > 0
      ? Number(employee.monthly_rate)
      : dailyRate > 0
        ? dailyRate * 22
        : 0;
  const thirteenthMonthCutoff =
    monthlyBasic > 0 ? round2(basicSalary / 12) : round2(basicSalary / 12);

  return {
    employeeName,
    dailyRate,
    hoursWorked: round2(hoursWorked),
    daysWorked: round2(daysWorked),
    basicSalary: round2(basicSalary),
    totalSalary,
    regOTHours: round2(regOTHours),
    regOTAmount: round2(regOTAmount),
    nightDiffHours: round2(nightDiffHours),
    nightDiffAmount: round2(nightDiffAmount),
    specialHolidayHours: round2(specialHolidayHours),
    specialHolidayAmount: round2(specialHolidayAmount),
    specialHolidayOTHours: round2(specialHolidayOTHours),
    specialHolidayOTAmount: round2(specialHolidayOTAmount),
    restdayHours: round2(restdayHours),
    restdayAmount: round2(restdayAmount),
    totalOTAmount: round2(totalOTAmount),
    serviceIncentiveLeaveAmount: 0,
    refund: round2(allowance.refund),
    transpoAllowance: round2(allowance.transpo_allowance),
    loadAllowance: round2(allowance.load_allowance),
    allowance: round2(allowance.allowance),
    grossAmount,
    sss: round2(sssSum),
    sssPRO,
    philhealth: round2(philhealthSum),
    pagibig: round2(pagibigSum),
    withholdingTax: round2(withholdingTaxSum),
    sssLoan: round2(sssLoanSum),
    otherDeduction,
    totalDeduction,
    netAmount,
    thirteenthMonthCutoff,
    silCutoff: 0,
    thirteenthMonthYTD: round2(thirteenthMonthYTD),
    payslipCount: payslips.length,
  };
}

export function groupPayslipsByEmployee(
  payslips: RegisterPayslip[]
): Map<string, RegisterPayslip[]> {
  const map = new Map<string, RegisterPayslip[]>();
  for (const slip of payslips) {
    const existing = map.get(slip.employee_id) || [];
    existing.push(slip);
    map.set(slip.employee_id, existing);
  }
  return map;
}
