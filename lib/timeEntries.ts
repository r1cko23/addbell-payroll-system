/**
 * Utilities for the punch-based time_entries table.
 * Converts punch rows (in/out) into session-shaped entries for UI compatibility.
 */

export type PunchType = "in" | "out";

export interface TimeEntryPunch {
  id: string;
  employee_id: string;
  punch_type: PunchType;
  punched_at: string;
  lat?: number | null;
  lng?: number | null;
  device_info?: string | null;
  created_at?: string;
  /** 'web' | 'biometric' - how the punch was recorded */
  source?: string | null;
  device_serial?: string | null;
  office_location_id?: string | null;
}

/** Session-shaped entry (one row per in/out pair) for UI that expects clock_in_time/clock_out_time */
export interface TimeEntrySession {
  id: string;
  /** Set when session has clock_out; used for deleting both punches */
  out_punch_id?: string | null;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_date_ph: string;
  status: string;
  total_hours: number | null;
  regular_hours?: number | null;
  total_night_diff_hours?: number | null;
  clock_in_location?: string | null;
  clock_out_location?: string | null;
  clock_in_device?: string | null;
  clock_out_device?: string | null;
  employee_id?: string;
}

function getManilaDateString(iso: string): string {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Regular hours rule (shift-agnostic):
 * - Count actual worked duration from punch in/out
 * - Cap regular hours at 8.00 per completed session
 * - Any hours beyond 8 must be handled via approved OT workflows
 */
function calculateCappedRegularHours(
  clockInISO: string,
  clockOutISO: string
): number {
  const start = new Date(clockInISO);
  const end = new Date(clockOutISO);
  if (end <= start) return 0;
  const totalHours =
    (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  const capped = Math.min(8, Math.max(0, totalHours));
  return Math.round(capped * 100) / 100;
}

/**
 * Night differential overlap for actual worked time:
 * - ND window is 22:00–06:00 (Asia/Manila)
 * - Uses actual worked session overlap (works for cross-midnight shifts)
 */
function calculateNightDiffHours(
  clockInISO: string,
  clockOutISO: string
): number {
  const start = new Date(clockInISO);
  const end = new Date(clockOutISO);
  if (end <= start) return 0;

  const overlapHours = (
    aStart: Date,
    aEnd: Date,
    bStart: Date,
    bEnd: Date
  ) => {
    const s = Math.max(aStart.getTime(), bStart.getTime());
    const e = Math.min(aEnd.getTime(), bEnd.getTime());
    if (e <= s) return 0;
    return (e - s) / (1000 * 60 * 60);
  };

  let total = 0;
  const startDateStr = getManilaDateString(clockInISO);
  const endDateStr = getManilaDateString(clockOutISO);
  let cursor = new Date(`${startDateStr}T00:00:00+08:00`);
  const endCursor = new Date(`${endDateStr}T00:00:00+08:00`);

  while (cursor <= endCursor) {
    const dayStr = getManilaDateString(cursor.toISOString());
    // ND part 1: 22:00–24:00 of the same day
    const nd1Start = new Date(`${dayStr}T22:00:00+08:00`);
    const nd1End = new Date(`${dayStr}T23:59:59.999+08:00`);
    // ND part 2: 00:00–06:00 of the same day
    const nd2Start = new Date(`${dayStr}T00:00:00+08:00`);
    const nd2End = new Date(`${dayStr}T06:00:00+08:00`);

    total += overlapHours(start, end, nd1Start, nd1End);
    total += overlapHours(start, end, nd2Start, nd2End);

    cursor.setDate(cursor.getDate() + 1);
  }

  return Math.round(total * 100) / 100;
}

/**
 * Converts punch rows (ordered by punched_at asc) into sessions.
 * Pairs consecutive in/out; trailing 'in' without 'out' becomes one session with clock_out_time null.
 */
export function punchesToSessions(
  punches: TimeEntryPunch[],
  getDateInManila: (iso: string) => string
): TimeEntrySession[] {
  const sorted = [...punches].sort(
    (a, b) =>
      new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
  );
  const formatLocation = (punch: TimeEntryPunch): string | null => {
    if (
      punch.lat != null &&
      punch.lng != null &&
      !Number.isNaN(punch.lat) &&
      !Number.isNaN(punch.lng)
    ) {
      return `${punch.lat},${punch.lng}`;
    }
    if (punch.office_location_id) {
      return `office:${punch.office_location_id}`;
    }
    return null;
  };

  const sessions: TimeEntrySession[] = [];
  let i = 0;
  while (i < sorted.length) {
    const p = sorted[i];
    if (p.punch_type === "out") {
      i++;
      continue;
    }
    // p is 'in'
    const clockIn = p.punched_at;
    const clockInDatePh = getDateInManila(clockIn);
    const next = sorted[i + 1];

    if (next?.punch_type === "out") {
      const clockOut = next.punched_at;
      const totalHours =
        (new Date(clockOut).getTime() - new Date(clockIn).getTime()) /
        (1000 * 60 * 60);
      const regularHours = calculateCappedRegularHours(clockIn, clockOut);
      const nightDiffHours = calculateNightDiffHours(clockIn, clockOut);
      sessions.push({
        id: p.id,
        out_punch_id: next.id,
        clock_in_time: clockIn,
        clock_out_time: clockOut,
        clock_in_date_ph: clockInDatePh,
        status: "clocked_out",
        total_hours: Math.round(totalHours * 100) / 100,
        regular_hours: regularHours,
        total_night_diff_hours: nightDiffHours,
        clock_in_location: formatLocation(p),
        clock_out_location: formatLocation(next),
        clock_in_device: p.device_info ?? null,
        clock_out_device: next.device_info ?? null,
      });
      i += 2;
    } else {
      sessions.push({
        id: p.id,
        out_punch_id: null,
        clock_in_time: clockIn,
        clock_out_time: null,
        clock_in_date_ph: clockInDatePh,
        status: "clocked_in",
        total_hours: null,
        regular_hours: null,
        total_night_diff_hours: null,
        clock_in_location: formatLocation(p),
        clock_out_location: null,
        clock_in_device: p.device_info ?? null,
        clock_out_device: null,
      });
      i += 1;
    }
  }
  return sessions;
}

/**
 * Finds the current open entry: an 'in' that has no matching 'out' (using same pairing as punchesToSessions).
 * If todayManilaStr is provided, only treats as open if that unpaired 'in' is from today.
 */
export function getOpenEntryFromPunches(
  punches: TimeEntryPunch[],
  getDateInManila: (iso: string) => string,
  todayManilaStr?: string
): TimeEntrySession | null {
  const sessions = punchesToSessions(
    [...punches].sort(
      (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
    ),
    getDateInManila
  );
  const openSessions = sessions.filter(
    (s) =>
      !s.clock_out_time &&
      (todayManilaStr == null || s.clock_in_date_ph === todayManilaStr)
  );
  return openSessions.length > 0 ? openSessions[openSessions.length - 1] : null;
}

function defaultGetDateInManila(iso: string): string {
  const date = new Date(iso);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Fetches project_time_entries for one employee in a date range and returns session-shaped entries.
 * Used so that BH for timesheet/payroll = sum of all hours (main clock + project clocks) per day.
 * Project breakdown is for project management; HRIS sees one BH per day.
 */
export async function fetchProjectTimeSessionsForEmployee(
  supabase: any,
  employeeId: string,
  startIso: string,
  endIso: string,
  getDateInManila: (iso: string) => string = defaultGetDateInManila
): Promise<TimeEntrySession[]> {
  const { data: rows } = await supabase
    .from("project_time_entries")
    .select("id, project_id, employee_id, clock_in, clock_out, regular_hours, total_hours")
    .eq("employee_id", employeeId)
    .gte("clock_in", startIso)
    .lte("clock_in", endIso)
    .not("clock_out", "is", null)
    .order("clock_in", { ascending: true });
  const list = (rows || []) as Array<{
    id: string;
    project_id: string;
    employee_id: string;
    clock_in: string;
    clock_out: string | null;
    regular_hours: number | null;
    total_hours: number | null;
  }>;
  return list.map((r) => {
    const hours = r.regular_hours ?? r.total_hours ?? 0;
    return {
      id: r.id,
      clock_in_time: r.clock_in,
      clock_out_time: r.clock_out,
      clock_in_date_ph: getDateInManila(r.clock_in),
      status: "clocked_out",
      total_hours: r.total_hours ?? hours,
      regular_hours: hours,
      total_night_diff_hours: null,
      employee_id: r.employee_id,
    } as TimeEntrySession;
  });
}

/**
 * Fetches time_entries punches for one employee in a date range and returns session-shaped entries.
 * Use this from app code that previously queried time_clock_entries.
 */
export async function fetchSessionsForEmployee(
  supabase: any,
  employeeId: string,
  startIso: string,
  endIso: string,
  getDateInManila: (iso: string) => string = defaultGetDateInManila
): Promise<TimeEntrySession[]> {
  const { data: punches } = await supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at, lat, lng, device_info, source, office_location_id")
    .eq("employee_id", employeeId)
    .gte("punched_at", startIso)
    .lte("punched_at", endIso)
    .order("punched_at", { ascending: true });
  const list = (punches || []) as TimeEntryPunch[];
  return punchesToSessions(list, getDateInManila).map((s) => ({
    ...s,
    employee_id: employeeId,
    regular_hours: s.regular_hours ?? s.total_hours ?? null,
  }));
}

/**
 * Fetches all time_entries punches in a date range (optionally for one employee),
 * converts to sessions, and returns them with employee_id set.
 */
export async function fetchSessionsInRange(
  supabase: any,
  startIso: string,
  endIso: string,
  options?: { employeeId?: string; statusFilter?: string }
): Promise<TimeEntrySession[]> {
  let query = supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at, lat, lng, device_info, source, office_location_id")
    .gte("punched_at", startIso)
    .lte("punched_at", endIso)
    .order("punched_at", { ascending: true });

  if (options?.employeeId) {
    query = query.eq("employee_id", options.employeeId);
  }

  const { data: punches } = await query;
  const list = (punches || []) as TimeEntryPunch[];

  const byEmployee = new Map<string, TimeEntryPunch[]>();
  list.forEach((p) => {
    if (!byEmployee.has(p.employee_id)) byEmployee.set(p.employee_id, []);
    byEmployee.get(p.employee_id)!.push(p);
  });

  const allSessions: TimeEntrySession[] = [];
  byEmployee.forEach((empPunches, empId) => {
    const sessions = punchesToSessions(
      empPunches,
      (iso) => defaultGetDateInManila(iso)
    ).map((s) => ({ ...s, employee_id: empId }));
    allSessions.push(...sessions);
  });
  allSessions.sort(
    (a, b) =>
      new Date(b.clock_in_time).getTime() - new Date(a.clock_in_time).getTime()
  );

  if (options?.statusFilter && options.statusFilter !== "all") {
    return allSessions.filter((s) => s.status === options.statusFilter);
  }
  return allSessions;
}
