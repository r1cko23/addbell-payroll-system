import { extendCutoffPeriodEndForPunchFetch } from "@/lib/bundy-business-day";
import {
  getDateInManilaDefault,
  punchesToSessions,
  type TimeEntryPunch,
  type TimeEntrySession,
} from "@/lib/timeEntries";

/** Lookback for linking open time ins on FTL (days). */
export const FTL_OPEN_SESSION_LOOKBACK_DAYS = 60;
/** Max punches fetched for pairing — kept low for free-tier usage. */
export const FTL_OPEN_SESSION_PUNCH_LIMIT = 120;

/**
 * Open Bundy sessions (time in without time out) for failure-to-log linking.
 * Does not run auto clock-out — that stays on Bundy / time-entries routes only.
 */
export async function loadOpenBundySessionsForFtl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  employeeId: string
): Promise<TimeEntrySession[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - FTL_OPEN_SESSION_LOOKBACK_DAYS);
  const punchFetchEnd = extendCutoffPeriodEndForPunchFetch(end).toISOString();

  const { data, error } = await admin
    .from("time_entries")
    .select(
      "id, employee_id, punch_type, punched_at, lat, lng, device_info, office_location_id"
    )
    .eq("employee_id", employeeId)
    .gte("punched_at", start.toISOString())
    .lte("punched_at", punchFetchEnd)
    .order("punched_at", { ascending: true })
    .limit(FTL_OPEN_SESSION_PUNCH_LIMIT);

  if (error) {
    throw new Error(error.message);
  }

  const punches = (data || []) as TimeEntryPunch[];
  const sessions = punchesToSessions(punches, getDateInManilaDefault);
  return sessions.filter((s) => !s.clock_out_time);
}
