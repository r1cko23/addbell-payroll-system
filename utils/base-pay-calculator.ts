/**
 * Base Pay Calculator — weekly (and arbitrary) payroll cutoffs
 *
 * This organization uses **weekly cutoffs** (e.g. Wed–Tue), not a fixed 104h semi-month bucket per slice.
 *
 * Rules:
 * - **Base hours** for [periodStart, periodEnd] = (scheduled work days in that range) × 8 hours,
 *   then hire/termination proration on that total.
 * - **Scheduled work day**: not a rest day, not a public holiday (holiday pay is handled elsewhere).
 * - **Absence**: a scheduled work day with no complete clock entry (−8h each).
 * - Office-based: rest = Saturday + Sunday (Sat forced rest for absence policy).
 * - Client-based: rest days from schedule (`restDays` map).
 */

import { format, parseISO, getDay } from "date-fns";

export interface BasePayCalculationParams {
  periodStart: Date;
  periodEnd: Date;
  clockEntries: Array<{ clock_in_time: string; clock_out_time: string | null }>;
  restDays?: Map<string, boolean>; // Map of date string to isRestDay boolean
  holidays: Array<{ holiday_date: string }>; // Holidays in the period
  isClientBased: boolean; // true for client-based, false for office-based
  hireDate?: Date; // For proration
  terminationDate?: Date; // For proration
}

export interface BasePayCalculationResult {
  baseHours: number; // Scheduled slots × 8h (after hire/term proration), before absence deductions
  absences: number; // Number of absences
  absenceHours: number; // Total hours deducted for absences
  finalBaseHours: number; // Final base hours after deductions
  absenceDates: string[]; // Dates of absences
}

/**
 * Calculate base pay hours for the given cutoff window (typically one week).
 */
export function calculateBasePay(params: BasePayCalculationParams): BasePayCalculationResult {
  const {
    periodStart,
    periodEnd,
    clockEntries,
    restDays,
    holidays,
    isClientBased,
    hireDate,
    terminationDate,
  } = params;

  // Proration if employee started or ended mid-cutoff
  let prorationFactor = 1;
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  if (hireDate) {
    const hireDateStr = format(hireDate, "yyyy-MM-dd");
    if (hireDateStr > periodStartStr) {
      const actualStart = hireDate > periodStart ? hireDate : periodStart;
      const actualEnd = terminationDate && terminationDate < periodEnd ? terminationDate : periodEnd;
      const actualDays =
        Math.ceil(
          (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      const totalDays =
        Math.ceil(
          (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      prorationFactor = actualDays / totalDays;
    }
  }

  if (terminationDate) {
    const terminationDateStr = format(terminationDate, "yyyy-MM-dd");
    if (terminationDateStr < periodEndStr) {
      const actualStart = hireDate && hireDate > periodStart ? hireDate : periodStart;
      const actualEnd = terminationDate < periodEnd ? terminationDate : periodEnd;
      const actualDays =
        Math.ceil(
          (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      const totalDays =
        Math.ceil(
          (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
        ) + 1;
      prorationFactor = actualDays / totalDays;
    }
  }

  const clockEntryDates = new Set<string>();
  clockEntries.forEach((entry) => {
    if (!entry.clock_out_time) return;

    const entryDateUTC = parseISO(entry.clock_in_time);
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

    clockEntryDates.add(entryDate);
  });

  const holidayDates = new Set<string>();
  holidays.forEach((h) => {
    holidayDates.add(String(h.holiday_date).split("T")[0]);
  });

  const absenceDates: string[] = [];
  let scheduledWorkSlots = 0;
  let currentDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, "yyyy-MM-dd");

    if (hireDate && dateStr < format(hireDate, "yyyy-MM-dd")) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    if (terminationDate && dateStr > format(terminationDate, "yyyy-MM-dd")) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    let isRestDay = false;
    if (isClientBased) {
      isRestDay = restDays?.get(dateStr) === true;
    } else {
      const dayOfWeek = getDay(currentDate);
      isRestDay = dayOfWeek === 0 || dayOfWeek === 6;
    }

    const dayOfWeek = getDay(currentDate);
    if (dayOfWeek === 6) {
      isRestDay = true;
    }

    if (isRestDay) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Holiday: not a scheduled clock day here (premium handled in payroll/timesheet elsewhere)
    if (holidayDates.has(dateStr)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    scheduledWorkSlots += 1;
    if (!clockEntryDates.has(dateStr)) {
      absenceDates.push(dateStr);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  const baseHours = Math.round(scheduledWorkSlots * 8 * prorationFactor * 100) / 100;
  const absences = absenceDates.length;
  const absenceHours = absences * 8;
  const finalBaseHours = Math.max(0, baseHours - absenceHours);

  return {
    baseHours,
    absences,
    absenceHours,
    finalBaseHours,
    absenceDates,
  };
}
