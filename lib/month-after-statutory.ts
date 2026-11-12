/**
 * SSS / PhilHealth / Pag-IBIG the way Add-bell's accountant computes them
 * (2026-ADDBELL-PAYROLL summary workbook):
 *
 * - Contribution month = weekly cutoffs whose period end (Tuesday) falls in that month.
 *   e.g. September = Aug 26 – Sep 29, October = Sep 30 – Oct 27.
 * - PhilHealth = 2.5% employee share of the month's BASIC pay (floor ₱10,000, cap ₱100,000).
 * - SSS = table lookup on the month's GROSS pay (basic + OT).
 * - Pag-IBIG = ₱200 employee share.
 * - Deducted on the LAST cutoff ending in the NEXT month
 *   (September's on the Oct 21–27 payroll, October's on Nov 18–24).
 */

import { endOfMonth, format, subMonths } from "date-fns";
import { calculatePagIBIG, calculateSSS } from "@/utils/ph-deductions";
import { isLastWeeklyPayOfMonth } from "@/lib/weekly-statutory-deductions";

const PHILHEALTH_EMPLOYEE_RATE = 0.025;
const PHILHEALTH_FLOOR = 10000;
const PHILHEALTH_CEILING = 100000;

export type ContributionMonthPayslip = {
  gross_pay: number | string | null;
  earnings_breakdown?: unknown;
};

export type MonthAfterStatutory = {
  /** yyyy-MM of the contribution month being deducted, or null when this pay deducts nothing. */
  contributionMonth: string | null;
  basic: number;
  gross: number;
  sssReg: number;
  sssWisp: number;
  phil: number;
  pagibig: number;
  total: number;
};

const NONE: MonthAfterStatutory = {
  contributionMonth: null,
  basic: 0,
  gross: 0,
  sssReg: 0,
  sssWisp: 0,
  phil: 0,
  pagibig: 0,
  total: 0,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Basic pay saved on a payslip (payroll_result.totals.regularPay; holidays at their day rate included). */
export function payslipBasicPay(p: ContributionMonthPayslip): number {
  const eb = p.earnings_breakdown as
    | { payroll_result?: { totals?: { regularPay?: number } } }
    | null
    | undefined;
  return Number(eb?.payroll_result?.totals?.regularPay) || 0;
}

/** Employee shares for one contribution month from that month's saved payslips. */
export function statutoryFromContributionMonth(
  contributionMonth: string,
  payslips: ContributionMonthPayslip[]
): MonthAfterStatutory {
  const basic = round2(payslips.reduce((s, p) => s + payslipBasicPay(p), 0));
  const gross = round2(payslips.reduce((s, p) => s + (Number(p.gross_pay) || 0), 0));
  // No pay that month: nothing to remit (accountant leaves the row blank).
  if (basic <= 0 && gross <= 0) return { ...NONE, contributionMonth };

  const sss = calculateSSS(gross);
  const philBase = Math.min(PHILHEALTH_CEILING, Math.max(PHILHEALTH_FLOOR, basic));
  const phil = round2(philBase * PHILHEALTH_EMPLOYEE_RATE);
  const pagibig = calculatePagIBIG(gross).employeeShare;
  const sssReg = sss.regularEmployeeShare;
  const sssWisp = sss.wispEmployeeShare;
  return {
    contributionMonth,
    basic,
    gross,
    sssReg,
    sssWisp,
    phil,
    pagibig,
    total: round2(sssReg + sssWisp + phil + pagibig),
  };
}

/**
 * Which contribution month this pay deducts: the month before `periodEnd`'s month,
 * only when this is the last weekly pay ending in its month. Otherwise null.
 */
export function contributionMonthDeductedOn(periodEnd: Date): string | null {
  if (!isLastWeeklyPayOfMonth(periodEnd)) return null;
  return format(subMonths(periodEnd, 1), "yyyy-MM");
}

/** Loads the previous contribution month's payslips and computes this pay's statutory deductions. */
export async function fetchMonthAfterStatutory(
  supabase: any,
  employeeIds: string[],
  periodEnd: Date
): Promise<MonthAfterStatutory> {
  const month = contributionMonthDeductedOn(periodEnd);
  if (!month) return NONE;
  const ids = [...new Set(employeeIds.filter(Boolean))];
  if (ids.length === 0) return { ...NONE, contributionMonth: month };
  const monthStart = new Date(`${month}-01T00:00:00`);
  const { data, error } = await supabase
    .from("payslips")
    .select("gross_pay, earnings_breakdown")
    .in("employee_id", ids)
    .gte("period_end", format(monthStart, "yyyy-MM-dd"))
    .lte("period_end", format(endOfMonth(monthStart), "yyyy-MM-dd"));
  if (error) throw new Error(error.message);
  return statutoryFromContributionMonth(month, (data ?? []) as ContributionMonthPayslip[]);
}
