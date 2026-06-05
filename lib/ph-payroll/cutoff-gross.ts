/**
 * Shared gross pay resolution for weekly cutoffs (Frappe HR: one engine, multiple views).
 */

import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import { sumRegularDayHours } from "./attendance-cutoff";

/** Sum of Mon–Sat `regular` day hours × rate (matches PayslipDetailedBreakdown basic row). */
export function regularHoursBasicGross(
  attendanceData: any[],
  ratePerHour: number
): number {
  if (ratePerHour <= 0 || !Array.isArray(attendanceData)) return 0;
  const regularHours = sumRegularDayHours(attendanceData);
  return Math.round(regularHours * ratePerHour * 100) / 100;
}

/** Full weekly gross including premiums (OT, holiday, ND, etc.). */
export function computeWeeklyGrossFromAttendance(
  attendanceData: any[],
  ratePerHour: number
): number {
  if (ratePerHour <= 0 || !Array.isArray(attendanceData) || attendanceData.length === 0) {
    return 0;
  }
  const payrollResult = calculateWeeklyPayroll(attendanceData, ratePerHour);
  return Math.round(payrollResult.grossPay * 100) / 100;
}

/**
 * Unified cutoff gross: max(basic regular-day gross, full payroll calculator gross).
 * Used by payslip UI, bulk payroll runs, and exports.
 */
export function resolveCutoffGrossPay(
  attendanceData: any[],
  ratePerHour: number
): number {
  if (ratePerHour <= 0 || !Array.isArray(attendanceData) || attendanceData.length === 0) {
    return 0;
  }
  const basicGross = regularHoursBasicGross(attendanceData, ratePerHour);
  const fullGross = computeWeeklyGrossFromAttendance(attendanceData, ratePerHour);
  return Math.round(Math.max(basicGross, fullGross) * 100) / 100;
}
