/**
 * Automated Timesheet Generator
 *
 * Aggregates time clock entries into weekly_attendance format
 * This eliminates manual timesheet entry by auto-generating from time clock data
 */

import { format, parseISO, startOfDay, isWithinInterval, startOfWeek } from "date-fns";
import { determineDayType, normalizeHolidays } from "@/utils/holidays";
import type { DailyAttendance } from "@/utils/payroll-calculator";

export interface TimeClockEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_night_diff_hours: number | null;
  status: string;
}

export interface TimesheetGenerationResult {
  success: boolean;
  employee_id: string;
  period_start: string;
  period_end: string;
  days_generated: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
  errors?: string[];
}

/**
 * Generate timesheet data from time clock entries for a specific period
 */
export function generateTimesheetFromClockEntries(
  clockEntries: TimeClockEntry[],
  periodStart: Date,
  periodEnd: Date,
  holidays: Array<{ holiday_date: string; holiday_type: string }>,
  restDays?: Map<string, boolean>, // Map of date string to isRestDay boolean
  eligibleForOT: boolean = true, // Whether employee is eligible for overtime
  eligibleForNightDiff: boolean = true, // Whether employee is eligible for night differential (Account Supervisors have flexi time, so no night diff)
  isClientBasedAccountSupervisor: boolean = false, // Whether employee is client-based Account Supervisor (for rest day logic)
  approvedOTByDate?: Map<string, number>, // Map of date string to approved OT hours (for dates without clock entries)
  approvedNDByDate?: Map<string, number> // Map of date string to approved ND hours (for dates without clock entries)
): {
  attendance_data: DailyAttendance[];
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
} {
  // Group entries by date
  const entriesByDate = new Map<string, TimeClockEntry[]>();

  clockEntries.forEach((entry) => {
    if (!entry.clock_out_time) return; // Skip incomplete entries

    // Use Asia/Manila timezone for date grouping (same as timesheet page)
    // Convert UTC time to Asia/Manila timezone for correct date grouping
    const entryDateUTC = parseISO(entry.clock_in_time);
    // Use Intl.DateTimeFormat to get date parts in Asia/Manila timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(entryDateUTC);
    const entryDate = `${parts.find((p) => p.type === "year")!.value}-${
      parts.find((p) => p.type === "month")!.value
    }-${parts.find((p) => p.type === "day")!.value}`;

    if (!entriesByDate.has(entryDate)) {
      entriesByDate.set(entryDate, []);
    }
    entriesByDate.get(entryDate)!.push(entry);
  });

  // Generate daily attendance for each day in period
  const attendance_data: DailyAttendance[] = [];
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  let currentDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, "yyyy-MM-dd");
    const dayEntries = entriesByDate.get(dateStr) || [];

    // Check if this date is a rest day from employee schedule
    const isRestDay = restDays?.get(dateStr);

    // Normalize holidays before determining day type
    const normalizedHolidays = normalizeHolidays(
      holidays.map((h) => ({
        date: h.holiday_date,
        name: "",
        type: h.holiday_type as "regular" | "non-working",
      }))
    );

    // For client-based Account Supervisors:
    // Rest days can only be Monday, Tuesday, or Wednesday (enforced in schedule validation)
    // The FIRST rest day (chronologically) is the ACTUAL REST DAY (only paid if worked)
    // The SECOND rest day is treated as a REGULAR WORKDAY (paid even if not worked, gets 8 BH)
    let actualIsRestDay = isRestDay;
    if (isClientBasedAccountSupervisor && isRestDay && restDays && restDays.size > 0) {
      // Get the week start (Monday) for this date
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday = 1
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

      // Get all rest days in THIS WEEK (not the entire period)
      const restDaysInWeek = Array.from(restDays.keys())
        .filter(rd => {
          const rdDate = parseISO(rd);
          return rdDate >= weekStart && rdDate <= weekEnd;
        })
        .sort((a, b) => a.localeCompare(b)); // Sort chronologically within the week

      // Check if this is the SECOND rest day of THIS WEEK (chronologically)
      if (restDaysInWeek.length >= 2 && dateStr === restDaysInWeek[1]) {
        // Second rest day of the week: Treat as regular workday (like Mon-Sat for office-based)
        // It's NOT a rest day - it's just a regular workday (paid at regular rate, no rest day premium, no allowances)
        actualIsRestDay = false;
      }
      // First rest day of the week (restDaysInWeek[0]): Keep as actual rest day
    }

    // Determine day type (regular, holiday, sunday/rest day, etc.)
    // Pass isClientBasedAccountSupervisor so Sunday is not automatically treated as rest day for client-based employees
    const dayType = determineDayType(dateStr, normalizedHolidays, actualIsRestDay, isClientBasedAccountSupervisor);

    // Aggregate hours from all entries for this day
    let regularHours = 0;
    let overtimeHours = 0;
    let nightDiffHours = 0;

    dayEntries.forEach((entry) => {
      // Only count approved or auto-approved entries
      if (
        entry.status === "approved" ||
        entry.status === "auto_approved" ||
        entry.status === "clocked_out"
      ) {
        const entryRegularHours = entry.regular_hours || 0;
        const entryOTHours = entry.overtime_hours || 0;
        const entryNDHours = entry.total_night_diff_hours || 0;
        regularHours += entryRegularHours;
        // Only count overtime if employee is eligible for OT
        // Note: OT hours from clock entries are already set from approved OT requests in payslip
        // But we still add them here for consistency
        if (eligibleForOT) {
          overtimeHours += entryOTHours;
        }
        // Only count night differential if employee is eligible (Account Supervisors have flexi time, so no night diff)
        if (eligibleForNightDiff) {
          nightDiffHours += entryNDHours;
        }
      }
    });

    // Add approved OT hours from approved OT requests
    // This ensures approved OT requests are included even when employee didn't clock in/out
    // Clock entries already have OT hours mapped from approved requests (in payslip)
    // But if there are no clock entries for a date, we need to add OT hours here
    if (eligibleForOT && approvedOTByDate) {
      const otFromRequest = approvedOTByDate.get(dateStr) || 0;
      if (otFromRequest > 0) {
        // If there are no clock entries, add OT hours from approved requests
        // If there are clock entries, they already have OT hours mapped (don't double-count)
        if (dayEntries.length === 0) {
          overtimeHours = otFromRequest;
        } else {
          // Clock entries already have OT hours from approved requests (mapped in payslip)
          // But ensure we're using the approved request hours (they're the source of truth)
          // IMPORTANT: Clock entries should have overtime_hours = 0 (reset in payslip mapping)
          // So we should ONLY use otFromRequest, not sum them
          const otFromClockEntries = overtimeHours;
          overtimeHours = Math.max(otFromClockEntries, otFromRequest);
        }
      }
    }

    // Add approved ND hours from approved OT requests
    // Same logic as OT hours
    if (eligibleForNightDiff && approvedNDByDate) {
      const ndFromRequest = approvedNDByDate.get(dateStr) || 0;
      if (ndFromRequest > 0) {
        if (dayEntries.length === 0) {
          nightDiffHours = ndFromRequest;
        } else {
          const ndFromClockEntries = nightDiffHours;
          nightDiffHours = Math.max(ndFromClockEntries, ndFromRequest);
        }
      }
    }

    // Saturday Regular Work Day: Set regularHours = 8 even if employee didn't work
    // Per Philippine labor law, employees are paid 6 days/week (Mon-Sat)
    // Saturday is a regular work day - paid even if not worked, and counts towards days worked and total hours
    // This applies to ALL employees (office-based)
    if (dayType === "regular" && regularHours === 0) {
      const dateObj = parseISO(dateStr);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
      if (dayOfWeek === 6) {
        regularHours = 8; // Regular work day: 8 hours even if not worked (paid 6 days/week)
      }
    }

    // Client-based Account Supervisor Rest Day Logic:
    // They can mark rest days as Monday, Tuesday, or Wednesday only (enforced in schedule validation)
    // Rest days that fall on holidays are treated as holidays (handled by determineDayType)
    // The FIRST rest day (chronologically) is the ACTUAL REST DAY (only paid if worked)
    // - If worked: daily rate (hours × rate/hour × 1.0) + allowance (if worked ≥4 hours)
    // The SECOND rest day is treated as a REGULAR WORKDAY (like Mon-Sat for office-based)
    // - It's NOT a rest day - it's just a regular workday (paid at regular rate, no rest day premium, no allowances)
    // - It gets 8 BH even if not worked (like Saturday company benefit) - part of 6-day work week
    // - It's included in basic salary calculation

    // Second rest day: Set regularHours = 8 even if not worked (like Saturday company benefit)
    // This is part of their 6-day work week, so they get 8 BH even without logging in
    if (isClientBasedAccountSupervisor && isRestDay && dayType === "regular" && regularHours === 0) {
      // Check if this is the second rest day (treated as regular workday)
      if (restDays && restDays.size > 0) {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const restDaysInWeek = Array.from(restDays.keys())
          .filter(rd => {
            const rdDate = parseISO(rd);
            return rdDate >= weekStart && rdDate <= weekEnd;
          })
          .sort((a, b) => a.localeCompare(b));

        // Only set BH = 8 if this is the second rest day
        if (restDaysInWeek.length >= 2 && dateStr === restDaysInWeek[1]) {
          regularHours = 8; // Second rest day gets 8 BH even if not worked
        }
      }
    }

    // Note: The second rest day (dayType === "sunday") needs rest day pay logic, which is handled in payslip calculation
    // If rest day falls on holiday, dayType will be "sunday-regular-holiday" or "sunday-special-holiday"
    // and it will be handled by the holiday logic below

    // Sunday Rest Day: DO NOT automatically set regularHours = 8
    // For Rank and File: They get paid 8 hours even if not worked (handled in payslip calculation)
    // For Account Supervisors/Supervisory: They only get paid if they actually worked (regularHours > 0)
    // The payslip calculation will handle the payment logic based on employee type
    // We keep regularHours = 0 if they didn't work, so the payslip can check if they actually worked

    // Holidays: Set regularHours = 8 if employee is eligible (worked REGULAR WORKING DAY before) even if didn't work on holiday
    // Check "1 Day Before" rule for holidays - must be a REGULAR WORKING DAY (not a holiday or rest day)
    // CONSECUTIVE HOLIDAYS RULE: If holidays are consecutive, once the first holiday is eligible,
    // all consecutive holidays are also eligible (they should still be paid and recorded as work/present)
    // Eligible holidays count towards "Days Work" and "Hours Worked"
    // SPECIAL CASE: January 1, 2026 - Set regularHours = 8 if no time log entries exist
    // This is because employees started using the system on January 6, 2026
    if (
      (dayType === "regular-holiday" || dayType === "non-working-holiday") &&
      regularHours === 0
    ) {
      // Special handling for January 1, 2026
      if (dateStr === "2026-01-01") {
        regularHours = 8; // All employees present on first day of system
      } else {
        const dateObj = parseISO(dateStr);
        let foundRegularWorkingDay = false;
        let isConsecutiveHoliday = false;
        let previousHolidayEligible = false;

        // Check if this is a consecutive holiday (check if previous day was also a holiday)
        const prevDateObj = new Date(dateObj);
        prevDateObj.setDate(prevDateObj.getDate() - 1);
        const prevDateStr = format(prevDateObj, "yyyy-MM-dd");
        const normalizedHolidays = normalizeHolidays(
          holidays.map((h) => ({
            date: h.holiday_date,
            name: "",
            type: h.holiday_type as "regular" | "non-working",
          }))
        );
        const prevDayType = determineDayType(prevDateStr, normalizedHolidays, undefined, isClientBasedAccountSupervisor);
        const isPrevDayHoliday = prevDayType === "regular-holiday" || prevDayType === "non-working-holiday";

        if (isPrevDayHoliday) {
          // This is a consecutive holiday - check if previous holiday was already marked as eligible
          // Look in attendance_data we've already processed
          const prevDayInAttendance = attendance_data.find((d) => d.date === prevDateStr);
          if (prevDayInAttendance && (prevDayInAttendance.regularHours || 0) >= 8) {
            // Previous holiday is eligible, so this consecutive holiday is also eligible
            isConsecutiveHoliday = true;
            previousHolidayEligible = true;
          }
        }

        if (!isConsecutiveHoliday || !previousHolidayEligible) {
          // Not a consecutive holiday, or previous holiday wasn't eligible - check "1 day before" rule
          // Search up to 7 days back to find the last REGULAR WORKING DAY (skip holidays and rest days)
          // This matches the payslip calculation logic
          for (let i = 1; i <= 7; i++) {
            const checkDateObj = new Date(dateObj);
            checkDateObj.setDate(checkDateObj.getDate() - i);
            const checkDateStr = format(checkDateObj, "yyyy-MM-dd");

            // Check if this date is a regular working day (not a holiday or rest day)
            const checkDayType = determineDayType(checkDateStr, normalizedHolidays, undefined, isClientBasedAccountSupervisor);

            // Only check regular working days (skip holidays and rest days)
            if (checkDayType === "regular") {
              // Check if employee worked this regular working day (has entry with regular_hours >= 8)
              // Use entriesByDate map for faster lookup (already grouped by date)
              const checkDayEntries = entriesByDate.get(checkDateStr) || [];
              const checkDayEntry = checkDayEntries.find((entry) => {
                return (
                  (entry.status === "approved" ||
                    entry.status === "auto_approved" ||
                    entry.status === "clocked_out") &&
                  (entry.regular_hours || 0) >= 8
                );
              });

              if (checkDayEntry) {
                foundRegularWorkingDay = true;
                break; // Found the immediately preceding regular working day with 8+ hours
              }
            }
            // If it's a holiday or rest day, continue searching backwards
          }
        }

        if (foundRegularWorkingDay || (isConsecutiveHoliday && previousHolidayEligible)) {
          regularHours = 8; // Eligible holiday: 8 hours even if not worked
        }
      }
    }

    // NOTE: Approved OT hours are already handled above (lines 174-201)
    // This duplicate block was causing OT hours to be doubled
    // Removed to fix double-counting bug

    // Add approved ND hours even if there are no clock entries for this date
    if (eligibleForNightDiff && approvedNDByDate) {
      const ndFromRequest = approvedNDByDate.get(dateStr) || 0;
      if (ndFromRequest > 0) {
        nightDiffHours += ndFromRequest;
      }
    }

    // Floor down hours (round down to full hours only, matching database trigger)
    attendance_data.push({
      date: dateStr,
      dayType: dayType as any,
      regularHours: Math.floor(regularHours),
      overtimeHours: Math.floor(overtimeHours),
      nightDiffHours: Math.floor(nightDiffHours),
    });

    // Move to next day
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate totals (already floored in individual days, but ensure totals are also floored)
  const total_regular_hours = Math.floor(
    attendance_data.reduce((sum, day) => sum + day.regularHours, 0)
  );
  const total_overtime_hours = Math.floor(
    attendance_data.reduce((sum, day) => sum + day.overtimeHours, 0)
  );
  const total_night_diff_hours = Math.floor(
    attendance_data.reduce((sum, day) => sum + day.nightDiffHours, 0)
  );

  return {
    attendance_data,
    total_regular_hours,
    total_overtime_hours,
    total_night_diff_hours,
  };
}

/**
 * Validate that all required time clock entries exist for a period
 */
export function validateClockEntries(
  clockEntries: TimeClockEntry[],
  periodStart: Date,
  periodEnd: Date,
  expectedWorkingDays: number[]
): {
  isValid: boolean;
  missingDays: string[];
  incompleteEntries: string[];
} {
  const missingDays: string[] = [];
  const incompleteEntries: string[] = [];

  const entriesByDate = new Map<string, TimeClockEntry[]>();
  clockEntries.forEach((entry) => {
    const dateStr = format(parseISO(entry.clock_in_time), "yyyy-MM-dd");
    if (!entriesByDate.has(dateStr)) {
      entriesByDate.set(dateStr, []);
    }
    entriesByDate.get(dateStr)!.push(entry);
  });

  // Check for missing days (only check expected working days)
  expectedWorkingDays.forEach((dayOfWeek) => {
    let currentDate = new Date(periodStart);
    while (currentDate <= periodEnd) {
      if (currentDate.getDay() === dayOfWeek) {
        const dateStr = format(currentDate, "yyyy-MM-dd");
        const dayEntries = entriesByDate.get(dateStr) || [];

        // Check if there's at least one complete entry
        const hasCompleteEntry = dayEntries.some(
          (entry) =>
            entry.clock_out_time !== null &&
            (entry.status === "approved" ||
              entry.status === "auto_approved" ||
              entry.status === "clocked_out")
        );

        if (!hasCompleteEntry && dayEntries.length > 0) {
          incompleteEntries.push(dateStr);
        } else if (!hasCompleteEntry) {
          missingDays.push(dateStr);
        }
      }
      currentDate = new Date(currentDate);
      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  return {
    isValid: missingDays.length === 0 && incompleteEntries.length === 0,
    missingDays,
    incompleteEntries,
  };
}