import {
  assignBundyBusinessDayKeysFromPunches,
  BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  getBundyBusinessDayAutoOutIso,
  getBundyBusinessDayKeyForInPunch,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";
import {
  getOpenEntryFromPunches,
  getDateInManilaDefault,
  type TimeEntryPunch,
} from "@/lib/timeEntries";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseAdmin = any;

/**
 * Inserts an OUT punch at 06:59 Manila when a session crossed the business-day boundary
 * and the employee did not clock out manually (e.g. overnight past midnight).
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
  if (!open?.clock_in_time) {
    return { applied: false };
  }

  const businessDay = getBundyBusinessDayKeyForInPunch(
    open.id,
    open.clock_in_time,
    punches
  );

  if (!isPastBundyAutoClockOut(open.clock_in_time, now, businessDay)) {
    return { applied: false };
  }
  const punchedAt = getBundyBusinessDayAutoOutIso(businessDay);

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
