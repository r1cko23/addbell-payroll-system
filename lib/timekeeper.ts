/**
 * Time Keeper Utilities
 *
 * Helper functions for working with time clock entries and
 * integrating them with the timesheet system
 */

import { createClient } from "@/lib/supabase/client";
import { startOfWeek, endOfWeek, format, parseISO, addDays } from "date-fns";

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

/**
 * Fetch time clock entries for an employee for a specific week
 */
export async function fetchWeeklyTimeEntries(
  employeeId: string,
  weekStart: Date
): Promise<TimeClockEntry[]> {
  const supabase = createClient();

  // Calculate week end as 6 days after week start (to support Wed-Tue cutoff)
  const weekEnd = addDays(weekStart, 6);
  // Set to end of day
  weekEnd.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from("time_clock_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .gte("clock_in_time", weekStart.toISOString())
    .lte("clock_in_time", weekEnd.toISOString())
    .in("status", ["clocked_out", "approved", "auto_approved"]) // Include all completed entries
    .order("clock_in_time", { ascending: true });

  if (error) {
    console.error("Error fetching time entries:", error);
    throw error;
  }

  return data || [];
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
    summary.overtimeHours += entry.overtime_hours || 0;
    summary.nightDiffHours += entry.total_night_diff_hours || 0;
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
 * Check if an employee is currently clocked in
 */
export async function isEmployeeClockedIn(
  employeeId: string
): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("time_clock_entries")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("status", "clocked_in")
    .limit(1);

  if (error) {
    console.error("Error checking clock status:", error);
    return false;
  }

  return (data || []).length > 0;
}

/**
 * Get the current active clock entry for an employee
 */
export async function getCurrentClockEntry(
  employeeId: string
): Promise<TimeClockEntry | null> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("time_clock_entries")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("status", "clocked_in")
    .order("clock_in_time", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Clock in an employee
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

  // Check if already clocked in
  const alreadyClockedIn = await isEmployeeClockedIn(employeeId);
  if (alreadyClockedIn) {
    return { success: false, error: "Employee is already clocked in" };
  }

  const { data, error } = await supabase.rpc("clock_in_now", {
    p_employee_id: employeeId,
    p_location: options?.location || null,
    p_ip: options?.ip ?? null,
    p_device: options?.device || null,
    p_notes: options?.notes || null,
  } as any);

  if (error) {
    console.error("Error clocking in:", error);
    return { success: false, error: error.message };
  }

  return { success: true, entry: data };
}

/**
 * Clock out an employee
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

  // Get the current clock entry
  const currentEntry = await getCurrentClockEntry(employeeId);
  if (!currentEntry) {
    return { success: false, error: "Employee is not clocked in" };
  }

  const { data, error } = await supabase.rpc("clock_out_now", {
    p_employee_id: employeeId,
    p_location: options?.location || null,
    p_ip: options?.ip ?? null,
    p_device: options?.device || null,
    p_notes: options?.notes || currentEntry.employee_notes || null,
  } as any);

  if (error) {
    console.error("Error clocking out:", error);
    return { success: false, error: error.message };
  }

  return { success: true, entry: data };
}

/**
 * Approve a time clock entry
 */
export async function approveTimeEntry(
  entryId: string,
  hrNotes?: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await (supabase.from("time_clock_entries") as any)
    .update({
      status: "approved",
      hr_notes: hrNotes || null,
      approved_at: new Date().toISOString(),
    })
    .eq("id", entryId);

  if (error) {
    console.error("Error approving entry:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Reject a time clock entry
 */
export async function rejectTimeEntry(
  entryId: string,
  hrNotes: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await (supabase.from("time_clock_entries") as any)
    .update({
      status: "rejected",
      hr_notes: hrNotes,
    })
    .eq("id", entryId);

  if (error) {
    console.error("Error rejecting entry:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

/**
 * Get pending time entries count for an employee
 */
export async function getPendingEntriesCount(
  employeeId?: string
): Promise<number> {
  const supabase = createClient();

  let query = supabase
    .from("time_clock_entries")
    .select("id", { count: "exact", head: true })
    .eq("status", "clocked_out");

  if (employeeId) {
    query = query.eq("employee_id", employeeId);
  }

  const { count, error } = await query;

  if (error) {
    console.error("Error getting pending entries count:", error);
    return 0;
  }

  return count || 0;
}