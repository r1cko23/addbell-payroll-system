/**
 * Automated Timesheet Generator
 *
 * Aggregates time clock entries into weekly_attendance format
 * This eliminates manual timesheet entry by auto-generating from time clock data
 */

import { format, parseISO, startOfDay, isWithinInterval, startOfWeek } from "date-fns";
import {
  determineDayType,
  HOLIDAY_DE_MINIMIS_HOURS,
  HOLIDAY_UNWORKED_CREDIT_HOURS,
  isEligibleForHolidayPayRule,
  normalizeHolidays,
} from "@/utils/holidays";
import type { DailyAttendance } from "@/utils/payroll-calculator";
import {
  BUSINESS_HOURS_GRACE_MINUTES,
  getBusinessDayPolicyByDay,
} from "@/utils/business-hours";

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

function parseTimestampInManila(value: string): Date {
  // If timestamp already has timezone info, preserve it.
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(value)) {
    return parseISO(value);
  }
  // Supabase can return timezone-naive strings (timestamp without time zone).
  // Interpret them as Asia/Manila to keep calculations consistent across runtimes.
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(`${normalized}+08:00`);
}

function getManilaDateString(value: Date): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(value);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
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
  eligibleForNightDiff: boolean = true, // When false, ND from clock entries / approved ND maps is omitted
  isClientBasedAccountSupervisor: boolean = false, // Whether employee is client-based Account Supervisor (for rest day logic)
  approvedOTByDate?: Map<string, number>, // Map of date string to approved OT hours (for dates without clock entries)
  approvedNDByDate?: Map<string, number>, // Map of date string to approved ND hours (for dates without clock entries)
  isClientBased: boolean = false // Whether employee is client-based (for Saturday/Sunday logic)
): {
  attendance_data: DailyAttendance[];
  total_regular_hours: number;
  total_overtime_hours: number;
  total_night_diff_hours: number;
} {
  const enforceApprovedOtNdOnly =
    approvedOTByDate !== undefined || approvedNDByDate !== undefined;

  // Group entries by date
  const entriesByDate = new Map<string, TimeClockEntry[]>();

  clockEntries.forEach((entry) => {
    if (!entry.clock_out_time) return; // Skip incomplete entries

    // Use Asia/Manila timezone for date grouping (same as timesheet page)
    // Convert UTC time to Asia/Manila timezone for correct date grouping
    const entryDateUTC = parseTimestampInManila(entry.clock_in_time);
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
    const isSaturday = parseISO(dateStr).getDay() === 6;

    // Helper to calculate regular business hours based on company business-day policy.
    const calculateBusinessRegularHours = (entry: TimeClockEntry): number => {
      if (!entry.clock_in_time || !entry.clock_out_time) return 0;

      const clockIn = parseTimestampInManila(entry.clock_in_time);
      const clockOut = parseTimestampInManila(entry.clock_out_time);
      if (clockOut <= clockIn) return 0;
      const manilaDate = getManilaDateString(clockIn);
      const workDate = parseISO(manilaDate);
      const dayPolicy = getBusinessDayPolicyByDay(workDate.getDay());
      if (dayPolicy.windows.length === 0) return 0;

      const overlapHours = (startA: Date, endA: Date, startB: Date, endB: Date) => {
        const start = Math.max(startA.getTime(), startB.getTime());
        const end = Math.min(endA.getTime(), endB.getTime());
        if (end <= start) return 0;
        return (end - start) / (1000 * 60 * 60);
      };

      const windowStarts = dayPolicy.windows.map(
        (w) => new Date(`${manilaDate}T${String(w.startHour).padStart(2, "0")}:00:00+08:00`)
      );
      const windowEnds = dayPolicy.windows.map(
        (w) => new Date(`${manilaDate}T${String(w.endHour).padStart(2, "0")}:00:00+08:00`)
      );

      const dayStart = windowStarts[0];
      const dayEnd = windowEnds[windowEnds.length - 1];
      let adjustedClockIn = clockIn;
      let adjustedClockOut = clockOut;

      if (
        adjustedClockIn > dayStart &&
        adjustedClockIn.getTime() <=
          dayStart.getTime() + BUSINESS_HOURS_GRACE_MINUTES * 60 * 1000
      ) {
        adjustedClockIn = dayStart;
      }
      if (
        adjustedClockOut < dayEnd &&
        adjustedClockOut.getTime() >=
          dayEnd.getTime() - BUSINESS_HOURS_GRACE_MINUTES * 60 * 1000
      ) {
        adjustedClockOut = dayEnd;
      }

      return dayPolicy.windows.reduce((sum, _window, idx) => {
        const start = windowStarts[idx];
        const end = windowEnds[idx];
        return sum + overlapHours(adjustedClockIn, adjustedClockOut, start, end);
      }, 0);
    };

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
        // Always recompute regular business hours from raw clock times,
        // so Time Attendance and Payslip keep unpaid lunch excluded and cap to policy windows.
        // unless it is explicitly recorded as OT.
        const entryRegularHours = calculateBusinessRegularHours(entry);
        const entryOTHours = enforceApprovedOtNdOnly
          ? 0
          : entry.overtime_hours || 0;
        const entryNDHours = enforceApprovedOtNdOnly
          ? 0
          : entry.total_night_diff_hours || 0;
        if (isSaturday) {
          // Saturday is outside the required office schedule for now.
          // Treat worked hours as OT instead of regular hours.
          if (eligibleForOT && !enforceApprovedOtNdOnly) {
            // Prefer DB OT hours when present; otherwise fallback to worked business-window hours.
            overtimeHours += entryOTHours > 0 ? entryOTHours : entryRegularHours;
          }
        } else {
          regularHours += entryRegularHours;
          // Only count overtime if employee is eligible for OT
          // Note: OT hours from clock entries are already set from approved OT requests in payslip
          // But we still add them here for consistency
          if (eligibleForOT) {
            overtimeHours += entryOTHours;
          }
        }
        // Night differential when caller passes eligibleForNightDiff (payslip: all employees)
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

    // Note: Employees do NOT get automatic regularHours for Saturday or Sunday.
    // They must log time on scheduled workdays or be marked as ABSENT in the timesheet display.

    // Client-based Account Supervisor Rest Day Logic:
    // They can mark rest days as Monday, Tuesday, or Wednesday only (enforced in schedule validation)
    // Rest days that fall on holidays are treated as holidays (handled by determineDayType)
    // Rest day is NOT PAID if not worked - only paid if employee has clock entries
    // The other 6 days (non-rest days) are paid IF they have clock entries based on their submitted schedule

    // Note: The second rest day (dayType === "sunday") needs rest day pay logic, which is handled in payslip calculation
    // If rest day falls on holiday, dayType will be "sunday-regular-holiday" or "sunday-special-holiday"
    // and it will be handled by the holiday logic below

    // Sunday Rest Day: DO NOT automatically set regularHours = 8
    // For Rank and File: They get paid 8 hours even if not worked (handled in payslip calculation)
    // For Account Supervisors/Supervisory: They only get paid if they actually worked (regularHours > 0)
    // The payslip calculation will handle the payment logic based on employee type
    // We keep regularHours = 0 if they didn't work, so the payslip can check if they actually worked

    // Holidays: credit HOLIDAY_UNWORKED_CREDIT_HOURS when eligible (previous regular day / consecutive holiday)
    // and hours on the holiday are below HOLIDAY_DE_MINIMIS_HOURS (absent or stray punch only).
    // Jan 1, 2026: 8h if no time logs (system go-live exception).
    if (dayType === "regular-holiday" || dayType === "non-working-holiday") {
      // Only give holiday credit when there's NO actual time log on the holiday.
      // If they have a complete time in/out, we treat it as "worked" and premiums apply downstream.
      if (dateStr === "2026-01-01" && dayEntries.length === 0) {
        regularHours = 8;
      } else if (dayEntries.length === 0) {
        if (
          regularHours < HOLIDAY_DE_MINIMIS_HOURS &&
          isEligibleForHolidayPayRule(dateStr, regularHours, attendance_data)
        ) {
          regularHours = HOLIDAY_UNWORKED_CREDIT_HOURS;
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
        if (dayEntries.length === 0) {
          nightDiffHours = ndFromRequest;
        } else {
          nightDiffHours = Math.max(nightDiffHours, ndFromRequest);
        }
      }
    }

    // #region agent log
    if (dateStr === "2026-01-01") {
      const hasJan1 = holidays.some((h: { holiday_date?: string; date?: string }) => ((h.holiday_date || h.date || "").toString().split("T")[0] || "") === "2026-01-01");
      fetch("http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "timesheet-auto-generator.ts:2026-01-01", message: "Generator Jan 1", data: { dateStr, dayType, regularHoursFinal: Math.floor(regularHours), holidaysCount: holidays.length, hasJan1InHolidays: hasJan1 }, hypothesisId: "H2", timestamp: Date.now(), sessionId: "debug-session" }) }).catch(() => {});
    }
    // #endregion

    // Floor down hours (round down to full hours only, matching database trigger)
    // Preserve fractional hours (e.g. 0.2) by rounding to 2 decimals
    const round2 = (value: number) =>
      Math.round((value + Number.EPSILON) * 100) / 100;

    attendance_data.push({
      date: dateStr,
      dayType: dayType as any,
      regularHours: round2(regularHours),
      overtimeHours: round2(overtimeHours),
      nightDiffHours: round2(nightDiffHours),
    });

    // Move to next day
    currentDate = new Date(currentDate);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Calculate totals with 2-decimal precision
  const sumRound2 = (values: number[]) =>
    Math.round(
      (values.reduce((sum, v) => sum + v, 0) + Number.EPSILON) * 100
    ) / 100;

  const total_regular_hours = sumRound2(
    attendance_data.map((day) => day.regularHours)
  );
  const total_overtime_hours = sumRound2(
    attendance_data.map((day) => day.overtimeHours)
  );
  const total_night_diff_hours = sumRound2(
    attendance_data.map((day) => day.nightDiffHours)
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