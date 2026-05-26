/**
 * Weekly period utilities (cutoff Wednesday to Tuesday, Sunday = rest day)
 */

import { addDays, subDays, format, endOfDay } from "date-fns";

const WEDNESDAY_DOW = 3; // 0 = Sunday, 3 = Wednesday

/**
 * Get the Wednesday that starts the week containing the given date.
 * Week runs Wed (inclusive) to Tue (inclusive).
 */
export function getWeeklyPeriodStart(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  // If Tue (2), go back 6 days; Mon (1) back 5; Sun (0) back 4; Sat (6) back 3; Fri (5) back 2; Thu (4) back 1; Wed (3) stay
  const daysBack = (dow + 7 - WEDNESDAY_DOW) % 7;
  return subDays(d, daysBack);
}

/**
 * Get the Tuesday that ends the week (day after period start + 6).
 */
export function getWeeklyPeriodEnd(periodStart: Date): Date {
  return endOfDay(addDays(periodStart, 6));
}

/**
 * Format for display: "Wed, Mar 12 – Tue, Mar 18, 2025"
 */
export function formatWeeklyPeriod(periodStart: Date, periodEnd: Date): string {
  return `${format(periodStart, "EEE, MMM d")} – ${format(periodEnd, "EEE, MMM d, yyyy")}`;
}

/**
 * Next week (next Wednesday).
 */
export function getNextWeeklyPeriod(periodStart: Date): Date {
  return addDays(periodStart, 7);
}

/**
 * Previous week (previous Wednesday).
 */
export function getPreviousWeeklyPeriod(periodStart: Date): Date {
  return subDays(periodStart, 7);
}

/** Tuesday (inclusive end) for a Wed-start cutoff, as a calendar date. */
export function getWeeklyCutoffEndDate(weekStartWednesday: Date): Date {
  return addDays(
    new Date(
      weekStartWednesday.getFullYear(),
      weekStartWednesday.getMonth(),
      weekStartWednesday.getDate()
    ),
    6
  );
}

/**
 * Default payroll run week: last completed Wed–Tue cutoff.
 * On Tuesday, uses the week ending that day; otherwise the prior week.
 */
export function getDefaultPayrollRunWeek(referenceDate: Date = new Date()) {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const thisWeekStart = getWeeklyPeriodStart(today);
  const weekStart =
    today.getDay() === 2 ? thisWeekStart : getPreviousWeeklyPeriod(thisWeekStart);
  const weekEnd = getWeeklyCutoffEndDate(weekStart);
  const suggestedPayDate = addDays(weekEnd, 3);
  return { weekStart, weekEnd, suggestedPayDate };
}

export function buildPayrollRunFormFromWeekStart(weekStartWednesday: Date) {
  const start = new Date(
    weekStartWednesday.getFullYear(),
    weekStartWednesday.getMonth(),
    weekStartWednesday.getDate()
  );
  const weekEnd = getWeeklyCutoffEndDate(start);
  const suggestedPayDate = addDays(weekEnd, 3);
  return {
    cutoff_start: format(start, "yyyy-MM-dd"),
    cutoff_end: format(weekEnd, "yyyy-MM-dd"),
    pay_date: format(suggestedPayDate, "yyyy-MM-dd"),
  };
}

export function buildDefaultPayrollRunForm(referenceDate?: Date) {
  return buildPayrollRunFormFromWeekStart(
    getDefaultPayrollRunWeek(referenceDate).weekStart
  );
}
