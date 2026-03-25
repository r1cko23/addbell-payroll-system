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
