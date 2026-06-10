import {
  BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  getBundy23HourAutoOutIso,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";
import {
  getOpenEntryFromPunches,
  getDateInManilaDefault,
  isBundyAutoClockOutPunch,
  isSupersededInPunch,
  type TimeEntryPunch,
} from "@/lib/timeEntries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

/** Enough history to pair open INs with their auto-outs (some employees have many punches). */
export const BUNDY_OPEN_SESSION_PUNCH_LIMIT = 500;

const PUNCH_SELECT =
  "id, employee_id, punch_type, punched_at, device_info, source";

function hasAutoOutForClockIn(
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

/**
 * Inserts an OUT punch when an open session is past 23 hours since clock-in (Deputy-style).
 */
export async function applyBundyAutoClockOutIfNeeded(
  supabase: SupabaseAdmin,
  employeeId: string,
  now: Date = new Date()
): Promise<{ applied: boolean; outPunchId?: string; punchedAt?: string }> {
  const punches = await fetchRecentPunches(supabase, employeeId);
  const open = getOpenEntryFromPunches(punches, getDateInManilaDefault);
  if (!open?.clock_in_time || isSupersededInPunch(open.id, punches)) {
    return { applied: false };
  }

  if (!isPastBundyAutoClockOut(open.clock_in_time, now)) {
    return { applied: false };
  }

  if (hasAutoOutForClockIn(open.clock_in_time, punches)) {
    return { applied: false };
  }

  const punchedAt = getBundy23HourAutoOutIso(open.clock_in_time);

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
  return { applied: true, outPunchId: row.id, punchedAt: row.punched_at };
}

/** Auto-close stale open sessions, then return the current open session (if any). */
export async function resolveOpenBundySessionAfterAutoClose(
  supabase: SupabaseAdmin,
  employeeId: string,
  now: Date = new Date()
): Promise<{
  open: ReturnType<typeof getOpenEntryFromPunches>;
  autoClosed: boolean;
}> {
  let autoClosed = false;
  const first = await applyBundyAutoClockOutIfNeeded(supabase, employeeId, now);
  if (first.applied) autoClosed = true;

  let punches = await fetchRecentPunches(supabase, employeeId);
  let open = getOpenEntryFromPunches(punches, getDateInManilaDefault);

  if (
    open?.clock_in_time &&
    isPastBundyAutoClockOut(open.clock_in_time, now) &&
    !hasAutoOutForClockIn(open.clock_in_time, punches)
  ) {
    const retry = await applyBundyAutoClockOutIfNeeded(supabase, employeeId, now);
    if (retry.applied) {
      autoClosed = true;
      punches = await fetchRecentPunches(supabase, employeeId);
      open = getOpenEntryFromPunches(punches, getDateInManilaDefault);
    }
  }

  return { open, autoClosed };
}
