/**
 * Time Keeper Utilities
 *
 * Helper functions for working with time_entries (punch-based) and
 * integrating them with the timesheet system.
 */

import { createClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, format, parseISO, addDays } from "date-fns";
import {
  fetchSessionsForEmployee,
  getOpenEntryFromPunches,
  type TimeEntryPunch,
  type TimeEntrySession,
} from "@/lib/timeEntries";
import { creditNightDiffHours, creditOvertimeHours } from "@/utils/overtime";

export interface TimeClockEntry {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  overtime_hours: number | null;
  total_night_diff_hours: number | null;
  status:
    | "clocked_in"
    | "clocked_out"
    | "approved"
    | "rejected"
    | "auto_approved"
    | "pending";
  employee_notes: string | null;
  hr_notes: string | null;
}

export interface DailySummary {
  date: string; // YYYY-MM-DD
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  totalHours: number;
  entries: TimeClockEntry[];
}

export interface WeeklySummary {
  employeeId: string;
  weekStartDate: string;
  weekEndDate: string;
  dailySummaries: Map<string, DailySummary>;
  totalRegularHours: number;
  totalOvertimeHours: number;
  totalNightDiffHours: number;
  totalHours: number;
}

function sessionToTimeClockEntry(s: TimeEntrySession, employeeId: string): TimeClockEntry {
  return {
    id: s.id,
    employee_id: employeeId,
    clock_in_time: s.clock_in_time,
    clock_out_time: s.clock_out_time,
    total_hours: s.total_hours ?? null,
    regular_hours: s.regular_hours ?? null,
    overtime_hours: null,
    total_night_diff_hours: s.total_night_diff_hours ?? null,
    status: s.status === "clocked_in" ? "clocked_in" : "clocked_out",
    employee_notes: null,
    hr_notes: null,
  };
}

/**
 * Fetch time entries (as sessions) for an employee for a specific week
 */
export async function fetchWeeklyTimeEntries(
  employeeId: string,
  weekStart: Date
): Promise<TimeClockEntry[]> {
  const supabase = createClient();
  const weekEnd = addDays(weekStart, 6);
  weekEnd.setHours(23, 59, 59, 999);

  const sessions = await fetchSessionsForEmployee(
    supabase,
    employeeId,
    weekStart.toISOString(),
    weekEnd.toISOString(),
    (iso) => format(new Date(iso), "yyyy-MM-dd")
  );
  return sessions
    .filter((s) => s.clock_out_time != null)
    .map((s) => sessionToTimeClockEntry(s, employeeId));
}

/**
 * Group time entries by day and calculate daily summaries
 */
export function groupEntriesByDay(
  entries: TimeClockEntry[]
): Map<string, DailySummary> {
  const dailySummaries = new Map<string, DailySummary>();

  entries.forEach((entry) => {
    const date = format(parseISO(entry.clock_in_time), "yyyy-MM-dd");

    if (!dailySummaries.has(date)) {
      dailySummaries.set(date, {
        date,
        regularHours: 0,
        overtimeHours: 0,
        nightDiffHours: 0,
        totalHours: 0,
        entries: [],
      });
    }

    const summary = dailySummaries.get(date)!;
    summary.regularHours += entry.regular_hours || 0;
    summary.overtimeHours += creditOvertimeHours(entry.overtime_hours || 0);
    summary.nightDiffHours += creditNightDiffHours(entry.total_night_diff_hours || 0);
    summary.totalHours += entry.total_hours || 0;
    summary.entries.push(entry);
  });

  return dailySummaries;
}

/**
 * Generate weekly summary from time clock entries
 */
export async function generateWeeklySummary(
  employeeId: string,
  weekStart: Date
): Promise<WeeklySummary> {
  const weekEnd = addDays(weekStart, 6); // 7-day week, regardless of day
  const entries = await fetchWeeklyTimeEntries(employeeId, weekStart);
  const dailySummaries = groupEntriesByDay(entries);

  let totalRegularHours = 0;
  let totalOvertimeHours = 0;
  let totalNightDiffHours = 0;
  let totalHours = 0;

  dailySummaries.forEach((summary) => {
    totalRegularHours += summary.regularHours;
    totalOvertimeHours += summary.overtimeHours;
    totalNightDiffHours += summary.nightDiffHours;
    totalHours += summary.totalHours;
  });

  return {
    employeeId,
    weekStartDate: format(weekStart, "yyyy-MM-dd"),
    weekEndDate: format(weekEnd, "yyyy-MM-dd"),
    dailySummaries,
    totalRegularHours: Math.round(totalRegularHours * 100) / 100,
    totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
    totalNightDiffHours: Math.round(totalNightDiffHours * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
  };
}

/**
 * Check if an employee is currently clocked in (has an open 'in' punch)
 */
export async function isEmployeeClockedIn(
  employeeId: string
): Promise<boolean> {
  const supabase = createClient();
  const { data: punches } = await supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at")
    .eq("employee_id", employeeId)
    .order("punched_at", { ascending: false })
    .limit(100);
  const list = (punches || []) as TimeEntryPunch[];
  const open = getOpenEntryFromPunches(
    list,
    (iso) => format(new Date(iso), "yyyy-MM-dd")
  );
  return open != null;
}

/**
 * Get the current active clock entry for an employee (open 'in' punch as session)
 */
export async function getCurrentClockEntry(
  employeeId: string
): Promise<TimeClockEntry | null> {
  const supabase = createClient();
  const { data: punches } = await supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at")
    .eq("employee_id", employeeId)
    .order("punched_at", { ascending: false })
    .limit(100);
  const list = (punches || []) as TimeEntryPunch[];
  const open = getOpenEntryFromPunches(
    list,
    (iso) => format(new Date(iso), "yyyy-MM-dd")
  );
  if (!open) return null;
  return sessionToTimeClockEntry(open, employeeId);
}

/**
 * Clock in an employee (insert 'in' punch into time_entries)
 */
export async function clockIn(
  employeeId: string,
  options?: {
    location?: string;
    ip?: string | null;
    notes?: string;
    device?: string;
  }
): Promise<{ success: boolean; entry?: TimeClockEntry; error?: string }> {
  const supabase = createClient();
  const alreadyClockedIn = await isEmployeeClockedIn(employeeId);
  if (alreadyClockedIn) {
    return { success: false, error: "Employee is already clocked in" };
  }

  const { data: serverTimeData, error: timeError } =
    await supabase.rpc("get_server_time");
  if (timeError || !serverTimeData) {
    return { success: false, error: "Could not get server time" };
  }
  const serverTime = new Date(serverTimeData as string).toISOString();

  const { data: insertData, error } = await supabase
    .from("time_entries")
    .insert({
      employee_id: employeeId,
      punch_type: "in",
      punched_at: serverTime,
      device_info: [options?.device, options?.location, options?.ip]
        .filter(Boolean)
        .join(" | ") || null,
    })
    .select("id, punched_at")
    .single();

  if (error) {
    console.error("Error clocking in:", error);
    return { success: false, error: error.message };
  }
  const row = insertData as { id: string; punched_at: string };
  const entry: TimeClockEntry = {
    id: row.id,
    employee_id: employeeId,
    clock_in_time: row.punched_at,
    clock_out_time: null,
    total_hours: null,
    regular_hours: null,
    overtime_hours: null,
    total_night_diff_hours: null,
    status: "clocked_in",
    employee_notes: options?.notes ?? null,
    hr_notes: null,
  };
  return { success: true, entry };
}

/**
 * Clock out an employee (insert 'out' punch into time_entries)
 */
export async function clockOut(
  employeeId: string,
  options?: {
    location?: string;
    ip?: string | null;
    notes?: string;
    device?: string;
  }
): Promise<{ success: boolean; entry?: TimeClockEntry; error?: string }> {
  const supabase = createClient();
  const currentEntry = await getCurrentClockEntry(employeeId);
  if (!currentEntry) {
    return { success: false, error: "Employee is not clocked in" };
  }

  const { data: serverTimeData, error: timeError } =
    await supabase.rpc("get_server_time");
  if (timeError || !serverTimeData) {
    return { success: false, error: "Could not get server time" };
  }
  const serverTime = new Date(serverTimeData as string).toISOString();

  const { error } = await supabase.from("time_entries").insert({
    employee_id: employeeId,
    punch_type: "out",
    punched_at: serverTime,
    device_info: [options?.device, options?.location, options?.ip]
      .filter(Boolean)
      .join(" | ") || null,
  });

  if (error) {
    console.error("Error clocking out:", error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Approve a time clock entry.
 * In punch-based time_entries there is no per-entry status; approval is tracked elsewhere (e.g. attendance_records).
 * This is a no-op for compatibility.
 */
export async function approveTimeEntry(
  _entryId: string,
  _hrNotes?: string
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

/**
 * Reject a time clock entry.
 * In punch-based time_entries there is no per-entry status; no-op for compatibility.
 */
export async function rejectTimeEntry(
  _entryId: string,
  _hrNotes: string
): Promise<{ success: boolean; error?: string }> {
  return { success: true };
}

/**
 * Get completed (in+out) time entries count. Optional employee filter.
 */
export async function getPendingEntriesCount(
  employeeId?: string
): Promise<number> {
  const supabase = createClient();
  const weekEnd = new Date();
  const weekStart = addDays(weekEnd, -7);
  if (!employeeId) {
    const { count, error } = await supabase
      .from("time_entries")
      .select("id", { count: "exact", head: true })
      .gte("punched_at", weekStart.toISOString())
      .lte("punched_at", weekEnd.toISOString())
      .eq("punch_type", "out");
    if (error) return 0;
    return count ?? 0;
  }
  const sessions = await fetchSessionsForEmployee(
    supabase,
    employeeId,
    weekStart.toISOString(),
    weekEnd.toISOString(),
    (iso) => format(new Date(iso), "yyyy-MM-dd")
  );
  return sessions.filter((s) => s.clock_out_time != null).length;
}