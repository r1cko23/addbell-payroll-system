import {
  BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  getBundy23HourAutoOutIso,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";
import {
  getOpenEntryFromPunches,
  getDateInManilaDefault,
  isSupersededInPunch,
  type TimeEntryPunch,
} from "@/lib/timeEntries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

/**
 * Inserts an OUT punch when an open session is past 23 hours since clock-in (Deputy-style).
 */
export async function applyBundyAutoClockOutIfNeeded(
  supabase: SupabaseAdmin,
  employeeId: string,
  now: Date = new Date()
): Promise<{ applied: boolean; outPunchId?: string; punchedAt?: string }> {
  const { data, error } = await supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at")
    .eq("employee_id", employeeId)
    .order("punched_at", { ascending: false })
    .limit(100);

  if (error) {
    throw new Error(error.message);
  }

  const punches = (data || []) as TimeEntryPunch[];
  const open = getOpenEntryFromPunches(punches, getDateInManilaDefault);
  if (!open?.clock_in_time || isSupersededInPunch(open.id, punches)) {
    return { applied: false };
  }

  if (!isPastBundyAutoClockOut(open.clock_in_time, now)) {
    return { applied: false };
  }
  const punchedAt = getBundy23HourAutoOutIso(open.clock_in_time);
  const punchedAtMs = new Date(punchedAt).getTime();
  const clockInMs = new Date(open.clock_in_time).getTime();

  const alreadyHasAutoOut = punches.some(
    (p) =>
      p.punch_type === "out" &&
      (p.device_info?.startsWith("auto:business-day-close") ||
        p.device_info?.startsWith("auto:23h-open-shift-close") ||
        p.device_info?.includes(BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO)) &&
      new Date(p.punched_at).getTime() > clockInMs &&
      new Date(p.punched_at).getTime() <= punchedAtMs + 60_000
  );
  if (alreadyHasAutoOut) {
    return { applied: false };
  }

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
