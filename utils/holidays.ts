import { format, isSunday, parseISO } from 'date-fns';
import type { DayType } from './payroll-calculator';

export interface Holiday {
  date: string;
  name: string;
  type: 'regular' | 'non-working';
}

/**
 * Check if a date is Sunday
 */
export function isDateSunday(dateString: string): boolean {
  return isSunday(parseISO(dateString));
}

/**
 * Determine day type based on date and holidays
 */
export function determineDayType(
  dateString: string,
  holidays: Holiday[]
): DayType {
  const isSundayDate = isDateSunday(dateString);
  const holiday = holidays.find((h) => h.date === dateString);

  if (isSundayDate && holiday?.type === 'regular') {
    return 'sunday-regular-holiday';
  }

  if (isSundayDate && holiday?.type === 'non-working') {
    return 'sunday-special-holiday';
  }

  if (holiday?.type === 'regular') {
    return 'regular-holiday';
  }

  if (holiday?.type === 'non-working') {
    return 'non-working-holiday';
  }

  if (isSundayDate) {
    return 'sunday';
  }

  return 'regular';
}

/**
 * Format date for display
 */
export function formatDateDisplay(dateString: string): string {
  return format(parseISO(dateString), 'MMM dd, yyyy');
}

/**
 * Format date for display (short)
 */
export function formatDateShort(dateString: string): string {
  return format(parseISO(dateString), 'MMM dd');
}

/**
 * Get day name
 */
export function getDayName(dateString: string): string {
  return format(parseISO(dateString), 'EEEE');
}

/**
 * Get week dates (Monday to Sunday)
 */
export function getWeekDates(startDate: Date): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);

  for (let i = 0; i < 7; i++) {
    dates.push(format(current, 'yyyy-MM-dd'));
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

