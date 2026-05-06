import { format, isSunday, parseISO, getDay, isValid } from "date-fns";
import type { DayType } from "./payroll-calculator";

export type { DayType };

export interface Holiday {
  date: string;
  name: string;
  type: "regular" | "non-working";
}

/**
 * Normalize date string to YYYY-MM-DD format
 * Handles various date formats and ensures consistent comparison
 */
export function normalizeDateString(dateString: string): string {
  try {
    // If already in YYYY-MM-DD format, return as is
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      return dateString;
    }

    // Parse the date and format it
    const date = parseISO(dateString);
    if (!isValid(date)) {
      // Try parsing as Date object string
      const dateObj = new Date(dateString);
      if (!isValid(dateObj)) {
        console.warn(`Invalid date string: ${dateString}`);
        return dateString; // Return original if can't parse
      }
      return format(dateObj, "yyyy-MM-dd");
    }

    return format(date, "yyyy-MM-dd");
  } catch (error) {
    console.warn(`Error normalizing date string: ${dateString}`, error);
    return dateString; // Return original if error
  }
}

/**
 * Check if a date is Sunday
 */
export function isDateSunday(dateString: string): boolean {
  try {
    const normalizedDate = normalizeDateString(dateString);
    return isSunday(parseISO(normalizedDate));
  } catch (error) {
    console.warn(`Error checking if date is Sunday: ${dateString}`, error);
    return false;
  }
}

/**
 * Check if a date is Saturday
 */
export function isDateSaturday(dateString: string): boolean {
  try {
    const normalizedDate = normalizeDateString(dateString);
    const dayOfWeek = getDay(parseISO(normalizedDate));
    return dayOfWeek === 6; // Saturday is 6 in date-fns (0 = Sunday, 6 = Saturday)
  } catch (error) {
    console.warn(`Error checking if date is Saturday: ${dateString}`, error);
    return false;
  }
}

/**
 * Find holiday by date with normalized date comparison
 * Handles date format variations and ensures accurate matching
 */
function findHolidayByDate(
  dateString: string,
  holidays: Holiday[]
): Holiday | undefined {
  const normalizedDate = normalizeDateString(dateString);

  // Try exact match first
  let holiday = holidays.find((h) => {
    const normalizedHolidayDate = normalizeDateString(h.date);
    return normalizedHolidayDate === normalizedDate;
  });

  // If not found, try with date-only comparison (in case of timestamp strings)
  if (!holiday) {
    holiday = holidays.find((h) => {
      const holidayDate = normalizeDateString(h.date);
      // Extract date part if it includes time
      const holidayDateOnly = holidayDate.split("T")[0];
      const dateOnly = normalizedDate.split("T")[0];
      return holidayDateOnly === dateOnly;
    });
  }

  return holiday;
}

/**
 * Determine day type based on date, holidays, and rest days
 * @param dateString - Date in YYYY-MM-DD format (or any parseable date format)
 * @param holidays - Array of holidays
 * @param isRestDay - Optional: whether this date is a rest day for the employee (from schedule)
 *                    For office-based employees: Sunday is the designated rest day
 *                    For client-based employees: Rest days are determined by schedule (day_off flag)
 *                    IMPORTANT: For client-based Account Supervisors, rest days can be on any weekday.
 *                    However, if a rest day falls on a holiday, it should be treated as a holiday (holiday takes priority).
 *                    Rest days on regular workdays are still treated as rest days for dayType, but payment logic
 *                    in timesheet generator handles which rest day gets paid.
 * @param isClientBased - Optional: whether the employee is client-based (default: false)
 *                        For client-based employees, Sunday is NOT automatically a rest day unless explicitly marked
 */
export function determineDayType(
  dateString: string,
  holidays: Holiday[],
  isRestDay?: boolean,
  isClientBased?: boolean
): DayType {
  try {
    // Normalize the input date string
    const normalizedDate = normalizeDateString(dateString);

    // Check if it's a rest day:
    // 1. From employee schedule (isRestDay parameter) - for client-based employees with custom schedules
    // 2. Sunday (default rest day for office-based employees per Labor Code)
    //    IMPORTANT: For client-based employees, Sunday is NOT automatically a rest day unless explicitly marked
    // Note: Saturday is NOT automatically a rest day - it's a company benefit (paid regular day)
    // For client-based Account Supervisors: rest days can be on any weekday (Mon-Fri)
    let isRestDayDate: boolean;
    if (isRestDay !== undefined) {
      // Explicitly provided - use it
      isRestDayDate = isRestDay;
    } else if (isClientBased === true) {
      // Client-based employee: Sunday is NOT automatically a rest day
      // Only treat as rest day if explicitly marked in schedule
      isRestDayDate = false;
    } else {
      // Office-based employee: Sunday is the default rest day
      isRestDayDate = isDateSunday(normalizedDate);
    }

    // Find holiday with normalized date comparison
    const holiday = findHolidayByDate(normalizedDate, holidays);

    // Debug logging for holiday detection (can be removed in production)
    if (process.env.NODE_ENV === "development") {
      if (normalizedDate.includes("12-24") || normalizedDate.includes("12-25")) {
        console.log("Holiday detection debug:", {
          dateString,
          normalizedDate,
          isRestDay,
          isRestDayDate,
          holiday: holiday ? { date: holiday.date, name: holiday.name, type: holiday.type } : null,
          holidaysCount: holidays.length,
          holidaysSample: holidays.slice(0, 3).map(h => ({ date: h.date, name: h.name, type: h.type })),
        });
      }
    }

    // Holidays take priority - if it's a holiday, treat as holiday (not rest day)
    // Rest day + Regular Holiday
    if (isRestDayDate && holiday?.type === "regular") {
      return "sunday-regular-holiday";
    }

    // Rest day + Special Holiday
    if (isRestDayDate && holiday?.type === "non-working") {
      return "sunday-special-holiday";
    }

    // Regular Holiday (not on rest day) - holidays take priority over rest days
    if (holiday?.type === "regular") {
      return "regular-holiday";
    }

    // Special Holiday (not on rest day) - holidays take priority over rest days
    if (holiday?.type === "non-working") {
      return "non-working-holiday";
    }

    // Rest Day (no holiday) - can be on any day for client-based Account Supervisors
    // Payment logic (which rest day gets paid) is handled in timesheet generator
    if (isRestDayDate) {
      return "sunday";
    }

    return "regular";
  } catch (error) {
    console.error(`Error determining day type for date: ${dateString}`, error);
    // Default to regular day on error
    return "regular";
  }
}

/**
 * Normalize holidays array to ensure all dates are in YYYY-MM-DD format
 * This should be called after fetching holidays from the database
 */
export function normalizeHolidays(holidays: Holiday[]): Holiday[] {
  return holidays.map((holiday) => ({
    ...holiday,
    date: normalizeDateString(holiday.date),
  }));
}

/**
 * Format date for display
 */
export function formatDateDisplay(dateString: string): string {
  try {
    const normalizedDate = normalizeDateString(dateString);
    return format(parseISO(normalizedDate), "MMM dd, yyyy");
  } catch (error) {
    console.warn(`Error formatting date: ${dateString}`, error);
    return dateString;
  }
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

/** Paid BH/regular hours when eligible for a holiday but absent (or de minimis clock only). */
export const HOLIDAY_UNWORKED_CREDIT_HOURS = 4;

/** Below this many hours on a holiday counts as "did not work" for eligibility + credit (stray bundy punches). */
export const HOLIDAY_DE_MINIMIS_HOURS = 1;

export function isSubstantiveHolidayWork(
  regularHours: number | null | undefined
): boolean {
  return (Number(regularHours) || 0) >= HOLIDAY_DE_MINIMIS_HOURS;
}

export type HolidayPayAttendanceDay = {
  date: string;
  dayType?: string;
  regularHours?: number;
};

/**
 * Holiday daily-rate eligibility:
 * - Substantive work on the holiday (>= HOLIDAY_DE_MINIMIS_HOURS), or
 * - Last regular working day before the holiday with 8+ hours, or
 * - Consecutive holiday after an eligible holiday (prior day credited >= HOLIDAY_UNWORKED_CREDIT_HOURS).
 */
export function isEligibleForHolidayPayRule(
  currentDate: string,
  holidayRegularHours: number,
  attendanceData: HolidayPayAttendanceDay[]
): boolean {
  if (isSubstantiveHolidayWork(holidayRegularHours)) {
    return true;
  }

  const currentDateObj = new Date(currentDate);
  const prevDateObj = new Date(currentDateObj);
  prevDateObj.setDate(prevDateObj.getDate() - 1);
  const prevDateStr = prevDateObj.toISOString().split("T")[0];

  const prevDay = attendanceData.find((day) => day.date === prevDateStr);
  const isPrevDayHoliday =
    prevDay &&
    (prevDay.dayType === "regular-holiday" ||
      prevDay.dayType === "non-working-holiday");

  if (
    isPrevDayHoliday &&
    prevDay &&
    (prevDay.regularHours || 0) >= HOLIDAY_UNWORKED_CREDIT_HOURS
  ) {
    return true;
  }

  for (let i = 1; i <= 7; i++) {
    const checkDateObj = new Date(currentDateObj);
    checkDateObj.setDate(checkDateObj.getDate() - i);
    const checkDateStr = checkDateObj.toISOString().split("T")[0];

    const checkDay = attendanceData.find((day) => day.date === checkDateStr);

    if (checkDay) {
      if (
        checkDay.dayType === "regular" &&
        (checkDay.regularHours || 0) >= 8
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Fallback PH holidays used when the `holidays` table is empty/unavailable.
 * NOTE: Movable holidays can vary year to year; prefer DB-driven holidays when possible.
 */
export const PH_HOLIDAYS_FALLBACK: Holiday[] = normalizeHolidays([
  // 2025 (sample)
  { date: "2025-01-01", name: "New Year's Day", type: "regular" },
  { date: "2025-03-29", name: "Maundy Thursday", type: "regular" },
  { date: "2025-03-30", name: "Good Friday", type: "regular" },
  { date: "2025-04-09", name: "Araw ng Kagitingan", type: "regular" },
  { date: "2025-05-01", name: "Labor Day", type: "regular" },
  { date: "2025-06-12", name: "Independence Day", type: "regular" },
  { date: "2025-08-25", name: "National Heroes Day", type: "regular" },
  { date: "2025-11-30", name: "Bonifacio Day", type: "regular" },
  { date: "2025-12-25", name: "Christmas Day", type: "regular" },
  { date: "2025-02-09", name: "Chinese New Year", type: "non-working" },
  { date: "2025-12-24", name: "Christmas Eve", type: "non-working" },
  { date: "2025-12-31", name: "New Year's Eve", type: "non-working" },

  // 2026 (includes May 1 Labor Day)
  { date: "2026-01-01", name: "New Year's Day", type: "regular" },
  { date: "2026-04-02", name: "Maundy Thursday", type: "regular" },
  { date: "2026-04-03", name: "Good Friday", type: "regular" },
  { date: "2026-04-09", name: "Araw ng Kagitingan", type: "regular" },
  { date: "2026-05-01", name: "Labor Day", type: "regular" },
  { date: "2026-06-12", name: "Independence Day", type: "regular" },
  { date: "2026-08-31", name: "National Heroes Day", type: "regular" },
  { date: "2026-11-30", name: "Bonifacio Day", type: "regular" },
  { date: "2026-12-25", name: "Christmas Day", type: "regular" },
  { date: "2026-02-17", name: "Chinese New Year", type: "non-working" },
  { date: "2026-12-24", name: "Christmas Eve", type: "non-working" },
  { date: "2026-12-31", name: "New Year's Eve", type: "non-working" },
]);