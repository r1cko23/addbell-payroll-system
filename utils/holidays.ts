import { format, isSunday, parseISO, getDay } from "date-fns";
import type { DayType } from "./payroll-calculator";

export type { DayType };

export interface Holiday {
  date: string;
  name: string;
  type: "regular" | "non-working";
}

/**
 * Check if a date is Sunday
 */
export function isDateSunday(dateString: string): boolean {
  return isSunday(parseISO(dateString));
}

/**
 * Check if a date is Saturday
 */
export function isDateSaturday(dateString: string): boolean {
  const dayOfWeek = getDay(parseISO(dateString));
  return dayOfWeek === 6; // Saturday is 6 in date-fns (0 = Sunday, 6 = Saturday)
}

/**
 * Determine day type based on date, holidays, and rest days
 * @param dateString - Date in YYYY-MM-DD format
 * @param holidays - Array of holidays
 * @param isRestDay - Optional: whether this date is a rest day for the employee (from schedule)
 *                    For office-based employees: Sunday is the designated rest day
 *                    For client-based employees: Rest days are determined by schedule (day_off flag)
 */
export function determineDayType(
  dateString: string,
  holidays: Holiday[],
  isRestDay?: boolean
): DayType {
  // Check if it's a rest day:
  // 1. From employee schedule (isRestDay parameter) - for client-based employees with custom schedules
  // 2. Sunday (default rest day for office-based employees per Labor Code)
  // Note: Saturday is NOT automatically a rest day - it's a company benefit (paid regular day)
  const isRestDayDate =
    isRestDay !== undefined ? isRestDay : isDateSunday(dateString);
  const holiday = holidays.find((h) => h.date === dateString);

  // Rest day + Regular Holiday
  if (isRestDayDate && holiday?.type === "regular") {
    return "sunday-regular-holiday";
  }

  // Rest day + Special Holiday
  if (isRestDayDate && holiday?.type === "non-working") {
    return "sunday-special-holiday";
  }

  // Regular Holiday (not on rest day)
  if (holiday?.type === "regular") {
    return "regular-holiday";
  }

  // Special Holiday (not on rest day)
  if (holiday?.type === "non-working") {
    return "non-working-holiday";
  }

  // Rest Day (no holiday)
  if (isRestDayDate) {
    return "sunday";
  }

  return "regular";
}

/**
 * Format date for display
 */
export function formatDateDisplay(dateString: string): string {
  return format(parseISO(dateString), "MMM dd, yyyy");
}

/**
 * Format date for display (short)
 */
export function formatDateShort(dateString: string): string {
  return format(parseISO(dateString), "MMM dd");
}

/**
 * Get day name
 */
export function getDayName(dateString: string): string {
  return format(parseISO(dateString), "EEEE");
}

/**
 * Get week dates (Monday to Sunday)
 */
export function getWeekDates(startDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    dates.push(format(current, "yyyy-MM-dd"));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Get week number of the month (1-4 or 5)
 */
export function getWeekOfMonth(date: Date): number {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

/**
 * Check if date is in week range
 */
export function isDateInWeek(
  date: string,
  weekStart: string,
  weekEnd: string
): boolean {
  return date >= weekStart && date <= weekEnd;
}
