/**
 * Base Pay Calculator for Bi-Monthly Periods
 *
 * Simplified calculation:
 * - Base: 104 hours (13 days × 8 hours) per bi-monthly period for all employees.
 *   Saturday is paid (company benefit) but only actual absences are deducted.
 * - Deduct 8 hours only for each absence on scheduled work days (no clock entry).
 * - Office-based: work Mon–Fri only; rest days = Saturday + Sunday (no absence for Sat/Sun).
 * - Client-based: work days = all days except rest days from schedule (e.g. Mon/Tue/Wed off);
 *   absences on their working days (e.g. Thu–Sun) are deducted.
 * - Holidays count toward the 13 days; missing a holiday is not an absence (handled separately).
 */

import { format, parseISO, getDay } from "date-fns";
import { getBiMonthlyPeriodStart, getBiMonthlyPeriodEnd } from "./bimonthly";

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
  baseHours: number; // Base hours (104 or prorated)
  absences: number; // Number of absences
  absenceHours: number; // Total hours deducted for absences
  finalBaseHours: number; // Final base hours after deductions
  absenceDates: string[]; // Dates of absences
}

/**
 * Calculate base pay for bi-monthly period
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

  // Calculate proration factor if employee is new or terminated
  let prorationFactor = 1;
  const periodStartStr = format(periodStart, "yyyy-MM-dd");
  const periodEndStr = format(periodEnd, "yyyy-MM-dd");

  if (hireDate) {
    const hireDateStr = format(hireDate, "yyyy-MM-dd");
    if (hireDateStr > periodStartStr) {
      // Employee started mid-period
      const actualStart = hireDate > periodStart ? hireDate : periodStart;
      const actualEnd = terminationDate && terminationDate < periodEnd ? terminationDate : periodEnd;
      const actualDays = Math.ceil(
        (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      const totalDays = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      prorationFactor = actualDays / totalDays;
    }
  }

  if (terminationDate) {
    const terminationDateStr = format(terminationDate, "yyyy-MM-dd");
    if (terminationDateStr < periodEndStr) {
      // Employee terminated mid-period
      const actualStart = hireDate && hireDate > periodStart ? hireDate : periodStart;
      const actualEnd = terminationDate < periodEnd ? terminationDate : periodEnd;
      const actualDays = Math.ceil(
        (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      const totalDays = Math.ceil(
        (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
      ) + 1;
      prorationFactor = actualDays / totalDays;
    }
  }

  // Base hours: 104 hours (13 days × 8 hours) per bi-monthly period
  const baseHours = Math.round(104 * prorationFactor * 100) / 100;

  // Create a set of dates with clock entries (for absence detection)
  const clockEntryDates = new Set<string>();
  clockEntries.forEach((entry) => {
    if (!entry.clock_out_time) return; // Skip incomplete entries

    // Use Asia/Manila timezone for date grouping
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

  // Create a set of holiday dates
  const holidayDates = new Set<string>();
  holidays.forEach((h) => {
    holidayDates.add(h.holiday_date);
  });

  // Count absences: scheduled work days with no clock entry
  const absenceDates: string[] = [];
  let currentDate = new Date(periodStart);
  const endDate = new Date(periodEnd);

  while (currentDate <= endDate) {
    const dateStr = format(currentDate, "yyyy-MM-dd");

    // Skip if before hire date
    if (hireDate && dateStr < format(hireDate, "yyyy-MM-dd")) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Skip if after termination date
    if (terminationDate && dateStr > format(terminationDate, "yyyy-MM-dd")) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check if it's a rest day (days that are not expected work — no absence if no clock)
    let isRestDay = false;
    if (isClientBased) {
      // Client-based: rest days from schedule (e.g. Mon, Tue, Wed); work Thu–Sun. Absences only on working days.
      isRestDay = restDays?.get(dateStr) === true;
    } else {
      // Office-based: only Mon–Fri are expected office days. Sat & Sun are not counted for absence.
      const dayOfWeek = getDay(currentDate);
      isRestDay = dayOfWeek === 0 || dayOfWeek === 6; // Sunday and Saturday
    }

    // If it's a rest day, skip (don't count as absence)
    if (isRestDay) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // If it's a holiday, it counts toward the 13 days (already included in 104 hours)
    // But if they didn't work on a holiday, it's not an absence (holiday pay handled separately)
    // So we skip holidays from absence calculation
    if (holidayDates.has(dateStr)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // If it's a scheduled work day (not rest day, not holiday) and no clock entry = absence
    if (!clockEntryDates.has(dateStr)) {
      absenceDates.push(dateStr);
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

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