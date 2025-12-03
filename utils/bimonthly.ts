/**
 * Bi-Monthly Period Utilities
 * 
 * Handles bi-monthly payroll periods (every 2 weeks, Monday-Friday)
 */

import { startOfWeek, addDays, format, parseISO, isMonday } from 'date-fns';

/**
 * Get the start date of the current bi-monthly period
 * Bi-monthly periods start on Monday and span 2 weeks (10 working days)
 * 
 * @param date Reference date (default: today)
 * @returns Start date of the bi-monthly period (Monday)
 */
export function getBiMonthlyPeriodStart(date: Date = new Date()): Date {
  // Find the most recent Monday
  const monday = startOfWeek(date, { weekStartsOn: 1 }); // 1 = Monday
  
  // Check if we're in the first or second week of the bi-monthly period
  // Bi-monthly periods: Week 1 (Mon-Fri), Week 2 (Mon-Fri)
  const daysSinceMonday = Math.floor((date.getTime() - monday.getTime()) / (1000 * 60 * 60 * 24));
  
  // If we're in the second week (days 5-9), go back to the previous Monday
  if (daysSinceMonday >= 5) {
    return monday;
  } else {
    // If we're in the first week, check if we need to go back 2 weeks
    // to get the start of the current bi-monthly period
    const weeksSinceMonday = Math.floor(daysSinceMonday / 7);
    if (weeksSinceMonday >= 1) {
      return addDays(monday, -7); // Go back one week
    }
    return monday;
  }
}

/**
 * Get the end date of the bi-monthly period
 * @param periodStart Start date of the period
 * @returns End date (Friday, 13 days after start)
 */
export function getBiMonthlyPeriodEnd(periodStart: Date): Date {
  // Bi-monthly period: 2 weeks = 14 days
  // But we want Friday of the second week, which is 13 days after Monday
  return addDays(periodStart, 13);
}

/**
 * Get all working days (Monday-Friday) in a bi-monthly period
 * @param periodStart Start date of the period
 * @returns Array of dates for working days
 */
export function getBiMonthlyWorkingDays(periodStart: Date): Date[] {
  const workingDays: Date[] = [];
  
  // Bi-monthly period spans 2 weeks (14 days)
  // Working days: Monday-Friday of week 1 and week 2
  for (let i = 0; i < 14; i++) {
    const date = addDays(periodStart, i);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // Only include Monday (1) through Friday (5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      workingDays.push(date);
    }
  }
  
  return workingDays;
}

/**
 * Get the next bi-monthly period
 * @param currentPeriodStart Current period start date
 * @returns Next period start date
 */
export function getNextBiMonthlyPeriod(currentPeriodStart: Date): Date {
  return addDays(currentPeriodStart, 14); // 2 weeks later
}

/**
 * Get the previous bi-monthly period
 * @param currentPeriodStart Current period start date
 * @returns Previous period start date
 */
export function getPreviousBiMonthlyPeriod(currentPeriodStart: Date): Date {
  return addDays(currentPeriodStart, -14); // 2 weeks earlier
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

