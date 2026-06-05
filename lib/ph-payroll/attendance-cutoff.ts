/**
 * Unified Days Work / Hours Work calculation for timesheet and payslip.
 * Frappe HR pattern: one engine, multiple views.
 */

import { creditWorkHoursHalfHour } from "@/utils/overtime";
import {
  WEEKLY_MAX_CUTOFF_HOURS,
  type DaysWorkInput,
  type DaysWorkResult,
} from "./types";

export { WEEKLY_MAX_CUTOFF_HOURS } from "./types";

/**
 * Compute Days Work for a weekly cutoff.
 * Used by Time Attendance and Payslip so both screens always match.
 */
export function computeDaysWork(params: DaysWorkInput): DaysWorkResult {
  const {
    basePayHours,
    actualTotalBH,
    renderedSpecialBH,
    excludeWorkedSpecialDayFromDaysWork,
  } = params;

  const totalBHForDaysWork = Math.min(
    WEEKLY_MAX_CUTOFF_HOURS,
    excludeWorkedSpecialDayFromDaysWork
      ? Math.max(0, basePayHours - renderedSpecialBH)
      : Math.max(basePayHours, actualTotalBH)
  );

  return {
    totalBHForDaysWork,
    daysWorked: totalBHForDaysWork / 8,
  };
}

/** Sum regular-day hours only (matches PayslipDetailedBreakdown basic row). */
export function sumRegularDayHours(
  attendanceData: Array<{ dayType?: string; regularHours?: number }>
): number {
  if (!Array.isArray(attendanceData)) return 0;
  return attendanceData.reduce((sum, day) => {
    if ((day.dayType || "regular") !== "regular") return sum;
    return (
      sum +
      creditWorkHoursHalfHour(
        Math.round(Number(day.regularHours || 0) * 100) / 100
      )
    );
  }, 0);
}

export function sumAttendanceRegularHours(
  attendanceData: Array<{ regularHours?: number }>
): number {
  return (
    Math.round(
      attendanceData.reduce((sum, day) => sum + Number(day.regularHours || 0), 0) *
        100
    ) / 100
  );
}
