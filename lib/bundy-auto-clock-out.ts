import {
  BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  getBundy23HourAutoOutIso,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";
import {
  getAllOpenSessionsFromPunches,
  getDateInManilaDefault,
  getOpenEntryFromPunches,
  isBundyAutoClockOutPunch,
  isSupersededInPunch,
  type TimeEntryPunch,
  type TimeEntrySession,
} from "@/lib/timeEntries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

/** Enough history to pair open INs with their auto-outs (some employees have many punches). */
export const BUNDY_OPEN_SESSION_PUNCH_LIMIT = 500;

const PUNCH_SELECT =
  "id, employee_id, punch_type, punched_at, device_info, source";

export function hasAutoOutForClockIn(
  clockInIso: string,
  punches: TimeEntryPunch[]
): boolean {
  const expectedMs = new Date(getBundy23HourAutoOutIso(clockInIso)).getTime();
  return punches.some(
    (p) =>
      p.punch_type === "out" &&
      isBundyAutoClockOutPunch(p) &&
      Math.abs(new Date(p.punched_at).getTime() - expectedMs) < 2 * 60 * 1000
  );
}

/** Open sessions past 23h without an auto-out yet (oldest first). Includes admin manual INs. */
export function findStaleOpenSessionsForAutoClose(
  punches: TimeEntryPunch[],
  now: Date = new Date()
): TimeEntrySession[] {
  return getAllOpenSessionsFromPunches(punches, getDateInManilaDefault, now, {
    excludeStaleAdminManual: false,
  }).filter(
    (session) =>
      session.clock_in_time &&
      !isSupersededInPunch(session.id, punches) &&
      isPastBundyAutoClockOut(session.clock_in_time, now) &&
      !hasAutoOutForClockIn(session.clock_in_time, punches)
  );
}

async function fetchRecentPunches(
  supabase: SupabaseAdmin,
  employeeId: string
): Promise<TimeEntryPunch[]> {
  const { data, error } = await supabase
    .from("time_entries")
    .select(PUNCH_SELECT)
    .eq("employee_id", employeeId)
    .order("punched_at", { ascending: false })
    .limit(BUNDY_OPEN_SESSION_PUNCH_LIMIT);

  if (error) {
    throw new Error(error.message);
  }
  return (data || []) as TimeEntryPunch[];
}

async function insertAutoOutForSession(
  supabase: SupabaseAdmin,
  employeeId: string,
  clockInIso: string
): Promise<{ outPunchId: string; punchedAt: string }> {
  const punchedAt = getBundy23HourAutoOutIso(clockInIso);

  const { data: insertData, error: insertError } = await supabase
    .from("time_entries")
    .insert({
      employee_id: employeeId,
      punch_type: "out",
      punched_at: punchedAt,
      device_info: BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
    })
    .select("id, punched_at")
    .single();

  if (insertError || !insertData) {
    throw new Error(insertError?.message || "Failed to auto clock out");
  }

  const row = insertData as { id: string; punched_at: string };
  return { outPunchId: row.id, punchedAt: row.punched_at };
}

/**
 * Closes every open session past 23 hours (oldest first), not only the latest.
 */
export async function applyAllStaleBundyAutoClockOuts(
  supabase: SupabaseAdmin,
  employeeId: string,
  now: Date = new Date()
): Promise<{
  closedCount: number;
  closedSessions: Array<{ clockInId: string; outPunchId: string; punchedAt: string }>;
}> {
  const closedSessions: Array<{
    clockInId: string;
    outPunchId: string;
    punchedAt: string;
  }> = [];

  let punches = await fetchRecentPunches(supabase, employeeId);
  let stale = findStaleOpenSessionsForAutoClose(punches, now);

  while (stale.length > 0) {
    const session = stale[0];
    if (!session.clock_in_time) break;

    const inserted = await insertAutoOutForSession(
      supabase,
      employeeId,
      session.clock_in_time
    );
    closedSessions.push({
      clockInId: session.id,
      outPunchId: inserted.outPunchId,
      punchedAt: inserted.punchedAt,
    });

    punches = await fetchRecentPunches(supabase, employeeId);
    stale = findStaleOpenSessionsForAutoClose(punches, now);
  }

  return { closedCount: closedSessions.length, closedSessions };
}

/**
 * Inserts an OUT punch when an open session is past 23 hours since clock-in (Deputy-style).
 * Closes the oldest eligible stale session (not only the latest open IN).
 */
export async function applyBundyAutoClockOutIfNeeded(
  supabase: SupabaseAdmin,
  employeeId: string,
  now: Date = new Date()
): Promise<{ applied: boolean; outPunchId?: string; punchedAt?: string }> {
  const result = await applyAllStaleBundyAutoClockOuts(supabase, employeeId, now);
  if (result.closedCount === 0) {
    return { applied: false };
  }
  const first = result.closedSessions[0];
  return {
    applied: true,
    outPunchId: first.outPunchId,
    punchedAt: first.punchedAt,
  };
}

/** Auto-close all stale open sessions, then return the current open session (if any). */
export async function resolveOpenBundySessionAfterAutoClose(
  supabase: SupabaseAdmin,
  employeeId: string,
  now: Date = new Date()
): Promise<{
  open: ReturnType<typeof getOpenEntryFromPunches>;
  autoClosed: boolean;
  closedCount: number;
}> {
  const { closedCount } = await applyAllStaleBundyAutoClockOuts(
    supabase,
    employeeId,
    now
  );

  const punches = await fetchRecentPunches(supabase, employeeId);
  const open = getOpenEntryFromPunches(punches, getDateInManilaDefault);

  return { open, autoClosed: closedCount > 0, closedCount };
}

/** Run stale-session auto-close for many employees (timesheet / payroll pre-load). */
export async function applyAllStaleBundyAutoClockOutsForEmployees(
  supabase: SupabaseAdmin,
  employeeIds: string[],
  now: Date = new Date()
): Promise<{ totalClosed: number; byEmployee: Record<string, number> }> {
  const byEmployee: Record<string, number> = {};
  let totalClosed = 0;

  for (const employeeId of employeeIds) {
    const { closedCount } = await applyAllStaleBundyAutoClockOuts(
      supabase,
      employeeId,
      now
    );
    if (closedCount > 0) {
      byEmployee[employeeId] = closedCount;
      totalClosed += closedCount;
    }
  }

  return { totalClosed, byEmployee };
}
