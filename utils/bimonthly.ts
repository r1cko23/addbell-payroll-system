/**
 * Bi-Monthly (Semi-Monthly) Period Utilities
 * 
 * Handles 2 payout windows each month:
 *  - 1st period : 1 - 15
 *  - 2nd period : 16 - end of month (28/30/31 depending on month)
 */

import { addDays, format, endOfDay } from 'date-fns';

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the start date of the current bi-monthly period.
 * Periods reset on the 1st and 16th day of each month.
 */
export function getBiMonthlyPeriodStart(date: Date = new Date()): Date {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();

  const startDay = day <= 15 ? 1 : 16;
  return new Date(year, month, startDay);
}

/**
 * Get the end date (calendar day) of the bi-monthly period.
 *  - If the period started on the 1st, it ends on the 15th.
 *  - If it started on the 16th, it ends on the last day of the month.
 */
export function getBiMonthlyPeriodEnd(periodStart: Date): Date {
  const year = periodStart.getFullYear();
  const month = periodStart.getMonth();
  const startDay = periodStart.getDate();

  const endDay = startDay === 1 ? 15 : getLastDayOfMonth(year, month);
  return endOfDay(new Date(year, month, endDay));
}

/**
 * Get all calendar days included in the current bi-monthly period.
 * This returns 15 days for the first period and 15/16 days for the second,
 * covering weekends as well so payroll can classify them as rest/holiday.
 */
export function getBiMonthlyWorkingDays(periodStart: Date): Date[] {
  const days: Date[] = [];
  const periodEnd = getBiMonthlyPeriodEnd(periodStart);

  let cursor = new Date(periodStart);
  while (cursor.getTime() <= periodEnd.getTime()) {
    days.push(new Date(cursor));
    cursor = addDays(cursor, 1);
  }
  
  return days;
}

/**
 * Get the next bi-monthly period start date.
 *  - 1st period -> 16th of the same month
 *  - 2nd period -> 1st of the next month
 */
export function getNextBiMonthlyPeriod(currentPeriodStart: Date): Date {
  const year = currentPeriodStart.getFullYear();
  const month = currentPeriodStart.getMonth();
  const day = currentPeriodStart.getDate();

  if (day === 1) {
    return new Date(year, month, 16);
  }

  return new Date(year, month + 1, 1);
}

/**
 * Get the previous bi-monthly period start date.
 *  - 2nd period -> 1st of the same month
 *  - 1st period -> 16th of the previous month
 */
export function getPreviousBiMonthlyPeriod(currentPeriodStart: Date): Date {
  const year = currentPeriodStart.getFullYear();
  const month = currentPeriodStart.getMonth();
  const day = currentPeriodStart.getDate();

  if (day === 16) {
    return new Date(year, month, 1);
  }

  // Go to previous month and pick the 16th
  const prevMonthDate = new Date(year, month - 1, 16);
  return prevMonthDate;
}

/**
 * Format bi-monthly period for display
 * @param periodStart Start date
 * @param periodEnd End date
 * @returns Formatted string like "Jan 1 - Jan 12, 2025"
 */
export function formatBiMonthlyPeriod(periodStart: Date, periodEnd: Date): string {
  const startFormatted = format(periodStart, 'MMM d');
  const endFormatted = format(periodEnd, 'd, yyyy');
  return `${startFormatted} - ${endFormatted}`;
}

/**
 * Check if a date falls within a bi-monthly period
 * @param date Date to check
 * @param periodStart Period start date
 * @param periodEnd Period end date
 * @returns True if date is within the period
 */
export function isDateInBiMonthlyPeriod(
  date: Date,
  periodStart: Date,
  periodEnd: Date
): boolean {
  const dateTime = date.getTime();
  const startTime = periodStart.getTime();
  const endTime = periodEnd.getTime();
  
  return dateTime >= startTime && dateTime <= endTime;
}

/**
 * Get bi-monthly period from a date
 * @param date Reference date
 * @returns Object with periodStart and periodEnd
 */
export function getBiMonthlyPeriodFromDate(date: Date = new Date()): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = getBiMonthlyPeriodStart(date);
  const periodEnd = getBiMonthlyPeriodEnd(periodStart);
  
  return {
    periodStart,
    periodEnd,
  };
}