/**
 * Utilities for the punch-based time_entries table.
 * Converts punch rows (in/out) into session-shaped entries for UI compatibility.
 */

import {
  assignBundyBusinessDayKeysFromPunches,
  BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  extendCutoffPeriodEndForPunchFetch,
  getBundyBusinessDayKey,
  getBundyBusinessDayKeyForClockIn,
  getBundyBusinessDayKeyForInPunch,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";
import { filterOfficialBundySessions } from "@/lib/official-bundy-sessions";
import { regularHoursFromBundyClockPair } from "@/utils/business-hours";

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

/** Do not pair an OUT to an IN if the gap exceeds this (avoids binding to a distant OUT). */
const MAX_PAIR_GAP_MS = 20 * 60 * 60 * 1000;

/** Pair auto-outs up to 23h + buffer (matches BUNDY_MAX_OPEN_SESSION_HOURS). */
const MAX_BUNDY_AUTO_PAIR_MS = 24 * 60 * 60 * 1000;

export function isBundyAutoClockOutPunch(punch: TimeEntryPunch): boolean {
  const info = punch.device_info ?? "";
  return (
    info.includes(BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO) ||
    info.startsWith("auto:business-day-close") ||
    info.startsWith("auto:23h-open-shift-close")
  );
}

/** Bulk 7 AM placeholder IN — not a second employee session; early-bird IN stays official. */
export function isAdminPreOpenClockIn(punch: TimeEntryPunch): boolean {
  return (
    punch.punch_type === "in" &&
    punch.source === "admin_correction" &&
    (punch.device_info?.toLowerCase().includes("pre-open") ?? false)
  );
}

/** HR manual punch from Time Entries → Manual punch (forgot time in/out backfill). */
export function isAdminManualBackfillPunch(punch: TimeEntryPunch): boolean {
  const info = punch.device_info?.toLowerCase() ?? "";
  return punch.source === "admin_correction" && info.startsWith("admin:manual");
}

/**
 * Prior-day admin manual time-in without clock-out is a payroll backfill, not a live Bundy shift.
 * Same-day admin manual time-in stays open so the employee can clock out in the app.
 */
export function isStaleAdminManualOpenIn(
  inPunch: TimeEntryPunch | undefined,
  now: Date = new Date()
): boolean {
  if (!inPunch || inPunch.punch_type !== "in") return false;
  if (!isAdminManualBackfillPunch(inPunch)) return false;
  const inDay = getDateInManilaDefault(inPunch.punched_at);
  const today = getDateInManilaDefault(now.toISOString());
  return inDay < today;
}

function shouldSkipAdminPreOpenIn(
  punch: TimeEntryPunch,
  punchIndex: number,
  sorted: TimeEntryPunch[]
): boolean {
  if (!isAdminPreOpenClockIn(punch)) return false;
  const adminMs = new Date(punch.punched_at).getTime();
  for (let k = 0; k < punchIndex; k++) {
    const earlier = sorted[k];
    if (earlier.punch_type !== "in" || isAdminPreOpenClockIn(earlier)) continue;
    const earlierMs = new Date(earlier.punched_at).getTime();
    const hasOutBetween = sorted.some(
      (o) =>
        o.punch_type === "out" &&
        new Date(o.punched_at).getTime() > earlierMs &&
        new Date(o.punched_at).getTime() < adminMs
    );
    if (!hasOutBetween) return true;
  }
  return false;
}

function canPairOutToIn(
  inMs: number,
  outMs: number,
  outPunch: TimeEntryPunch
): boolean {
  if (outMs <= inMs) return false;
  const gap = outMs - inMs;
  if (gap <= MAX_PAIR_GAP_MS) return true;
  if (gap <= MAX_BUNDY_AUTO_PAIR_MS && isBundyAutoClockOutPunch(outPunch)) {
    return true;
  }
  return false;
}

/**
 * True when a later employee IN was punched before any OUT for this IN.
 * Early-bird IN before 7 AM is valid; a later admin 7 AM pre-open placeholder does not supersede it.
 * Two employee taps (e.g. 6:29 then 7:19) without OUT between still supersede the first.
 */
export function isSupersededInPunch(
  inPunchId: string,
  punches: TimeEntryPunch[]
): boolean {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
  );
  const inPunch = sorted.find((p) => p.id === inPunchId && p.punch_type === "in");
  if (!inPunch) return false;
  const inMs = new Date(inPunch.punched_at).getTime();

  for (const p of sorted) {
    if (p.punch_type !== "in" || p.id === inPunchId) continue;
    if (isAdminPreOpenClockIn(p) || isAdminManualBackfillPunch(p)) continue;
    const laterMs = new Date(p.punched_at).getTime();
    if (laterMs <= inMs) continue;
    const hasOutBetween = sorted.some(
      (o) =>
        o.punch_type === "out" &&
        new Date(o.punched_at).getTime() > inMs &&
        new Date(o.punched_at).getTime() < laterMs
    );
    if (!hasOutBetween) return true;
  }
  return false;
}

/**
 * Converts punch rows (ordered by punched_at asc) into sessions.
 * Pairs each IN with the first OUT that is strictly after the IN (skips orphan OUTs and
 * mistaken OUT-before-IN on the same wall-clock narrative). Caps pair duration at MAX_PAIR_GAP_MS
 * (except business-day auto clock-out punches, which may land just after 24h).
 * A second employee IN before any OUT supersedes the earlier IN (no open session).
 * Admin 7 AM pre-open rows are skipped when an early-bird IN already started the day.
 * Trailing IN without a valid OUT becomes one session with clock_out_time null.
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
    if (shouldSkipAdminPreOpenIn(p, i, sorted)) {
      i++;
      continue;
    }
    const clockIn = p.punched_at;
    const clockInMs = new Date(clockIn).getTime();
    const clockInDatePh = getDateInManila(clockIn);

    let j = i + 1;
    let pairedOut: TimeEntryPunch | null = null;
    let supersededByLaterIn = false;
    while (j < sorted.length) {
      const q = sorted[j];
      if (q.punch_type === "in") {
        if (isAdminPreOpenClockIn(q) || isAdminManualBackfillPunch(q)) {
          j++;
          continue;
        }
        supersededByLaterIn = true;
        break;
      }
      const outMs = new Date(q.punched_at).getTime();
      if (canPairOutToIn(clockInMs, outMs, q)) {
        pairedOut = q;
        break;
      }
      j++;
    }

    if (supersededByLaterIn) {
      i += 1;
      continue;
    }

    if (pairedOut) {
      const clockOut = pairedOut.punched_at;
      const totalHours =
        (new Date(clockOut).getTime() - new Date(clockIn).getTime()) /
        (1000 * 60 * 60);
      const regularHours = regularHoursFromBundyClockPair(clockIn, clockOut);
      const nightDiffHours = calculateNightDiffHours(clockIn, clockOut);
      sessions.push({
        id: p.id,
        out_punch_id: pairedOut.id,
        clock_in_time: clockIn,
        clock_out_time: clockOut,
        clock_in_date_ph: clockInDatePh,
        status: "clocked_out",
        total_hours: Math.round(totalHours * 100) / 100,
        regular_hours: regularHours,
        total_night_diff_hours: nightDiffHours,
        clock_in_location: formatLocation(p),
        clock_out_location: formatLocation(pairedOut),
        clock_in_device: p.device_info ?? null,
        clock_out_device: pairedOut.device_info ?? null,
      });
      i = j + 1;
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
 * Manila dates (yyyy-MM-dd) that already have a valid complete Bundy session
 * (clock-out strictly after clock-in). Used to drop redundant FTL synthetic rows.
 */
export function manilaDatesWithCompleteBundySession(
  mainSessions: TimeEntrySession[],
  getDateInManila: (iso: string) => string,
  ...additionalSessionLists: TimeEntrySession[][]
): Set<string> {
  const dates = new Set<string>();
  const lists = [mainSessions, ...additionalSessionLists];
  for (const list of lists) {
    if (!list?.length) continue;
    for (const s of list) {
      if (!s.clock_in_time || !s.clock_out_time) continue;
      if (new Date(s.clock_out_time) <= new Date(s.clock_in_time)) continue;
      dates.add(getDateInManila(s.clock_in_time));
    }
  }
  return dates;
}

type SessionLike = {
  clock_in_time: string;
  clock_out_time: string | null;
};

/**
 * When approved failure-to-log is merged with real Bundy punches, omit FTL-only sessions
 * for dates that already have a complete Bundy session on main and/or project clocks — avoids double BH.
 */
export function filterSyntheticFtlWhenBundyExists<T extends SessionLike>(
  mainSessions: TimeEntrySession[],
  ftlEntries: T[],
  getDateInManila: (iso: string) => string,
  projectSessions?: TimeEntrySession[] | null
): T[] {
  const bundyDates =
    projectSessions?.length ?
      manilaDatesWithCompleteBundySession(mainSessions, getDateInManila, projectSessions)
    : manilaDatesWithCompleteBundySession(mainSessions, getDateInManila);
  return ftlEntries.filter((e) => {
    if (!e.clock_out_time) return true;
    if (new Date(e.clock_out_time) <= new Date(e.clock_in_time)) return true;
    const d = getDateInManila(e.clock_in_time);
    return !bundyDates.has(d);
  });
}

/**
 * One logical clock session per Manila workday when Bundy (main + optional project) overlaps
 * approved Failure-to-Log (FTL) synthetic sessions:
 *
 * - If a **complete** Bundy session already exists for that Manila date, skip the duplicate
 *   full FTL session (same work documented twice).
 * - If only an **incomplete** Bundy session exists (missing clock-out or invalid pair), merge
 *   FTL times in so there is a single complete row (Bundy punches win when both define a side).
 * - If there is no Bundy row for that date, append the FTL synthetic session.
 *
 * `mainSessions` and `projectSessions` are kept separate only for computing “complete” dates;
 * you may pass **all Bundy+project rows in `mainSessions`** and `null` for project (batch routes).
 */
export function mergeBundyAndFtlClockSessions(
  mainSessions: TimeEntrySession[],
  ftlSessions: TimeEntrySession[],
  getDateInManila: (iso: string) => string,
  projectSessions?: TimeEntrySession[] | null
): TimeEntrySession[] {
  const project = projectSessions ?? [];
  const out: TimeEntrySession[] = [...mainSessions, ...project].map((s) => ({ ...s }));
  const completeDates = manilaDatesWithCompleteBundySession(
    mainSessions,
    getDateInManila,
    project
  );

  for (const ftl of ftlSessions) {
    if (!ftl.clock_in_time || !ftl.clock_out_time) continue;
    const cinF = new Date(ftl.clock_in_time);
    const coutF = new Date(ftl.clock_out_time);
    if (Number.isNaN(cinF.getTime()) || Number.isNaN(coutF.getTime()) || coutF <= cinF) continue;

    const empId = ftl.employee_id;
    const d = getDateInManila(ftl.clock_in_time);
    if (completeDates.has(d)) {
      continue;
    }

    const sameEmployee = (s: TimeEntrySession) =>
      !empId || !s.employee_id || s.employee_id === empId;

    const incIdx = out.findIndex((s) => {
      if (!sameEmployee(s) || !s.clock_in_time) return false;
      if (getDateInManila(s.clock_in_time) !== d) return false;
      if (!s.clock_out_time) return true;
      const cin = new Date(s.clock_in_time);
      const cout = new Date(s.clock_out_time);
      return (
        !Number.isNaN(cin.getTime()) &&
        !Number.isNaN(cout.getTime()) &&
        cout <= cin
      );
    });

    if (incIdx >= 0) {
      const s = out[incIdx];
      const cinB = s.clock_in_time ? new Date(s.clock_in_time) : null;
      const coutB = s.clock_out_time ? new Date(s.clock_out_time) : null;
      const bundyOutValid =
        cinB &&
        coutB &&
        !Number.isNaN(cinB.getTime()) &&
        !Number.isNaN(coutB.getTime()) &&
        coutB > cinB;

      const mergedIn = s.clock_in_time || ftl.clock_in_time;
      const mergedOut = bundyOutValid ? s.clock_out_time! : ftl.clock_out_time;
      const nextStatus =
        s.status === "clocked_in" && mergedOut ? "clocked_out" : s.status || ftl.status || "approved";

      out[incIdx] = {
        ...s,
        clock_in_time: mergedIn,
        clock_out_time: mergedOut,
        status: nextStatus,
        clock_in_date_ph: getDateInManila(mergedIn),
        total_hours:
          s.total_hours ??
          ftl.total_hours ??
          Math.round(
            ((new Date(mergedOut).getTime() - new Date(mergedIn).getTime()) / (1000 * 60 * 60)) *
              100
          ) / 100,
        regular_hours: s.regular_hours ?? ftl.regular_hours ?? null,
      };
      continue;
    }

    out.push({
      ...ftl,
      employee_id: ftl.employee_id ?? empId,
      clock_in_date_ph: ftl.clock_in_date_ph || d,
    });
  }

  return out;
}

/**
 * Finds the current open entry: an 'in' that has no matching 'out' (using same pairing as punchesToSessions).
 * If activeBusinessDayKey is provided, only treats as open when clock-in belongs to that Bundy business day
 * (7:00 AM Manila boundary), not calendar midnight.
 */
/** Active Bundy business day for clock UI / open-session checks (punch-aware). */
export function getActiveBundyBusinessDayKey(
  punches: TimeEntryPunch[],
  nowIso: string = new Date().toISOString()
): string {
  const openAny = getOpenEntryFromPunches(punches, getDateInManilaDefault);
  const now = new Date(nowIso);
  if (openAny) {
    const openBiz = getBundyBusinessDayKeyForInPunch(
      openAny.id,
      openAny.clock_in_time,
      punches
    );
    if (isPastBundyAutoClockOut(openAny.clock_in_time, now, openBiz)) {
      return getBundyBusinessDayKeyForClockIn(nowIso, false, null);
    }
    return openBiz;
  }
  return getBundyBusinessDayKeyForClockIn(nowIso, false, null);
}

export function getOpenEntryFromPunches(
  punches: TimeEntryPunch[],
  getDateInManila: (iso: string) => string,
  activeBusinessDayKey?: string
): TimeEntrySession | null {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
  );
  const sessions = punchesToSessions(sorted, getDateInManila);
  const bizMap = assignBundyBusinessDayKeysFromPunches(sorted);
  const now = new Date();
  const punchById = new Map(sorted.map((p) => [p.id, p]));
  const openSessions = sessions.filter((s) => {
    if (s.clock_out_time || isSupersededInPunch(s.id, sorted)) return false;
    const inPunch = punchById.get(s.id);
    if (isStaleAdminManualOpenIn(inPunch, now)) return false;
    if (activeBusinessDayKey == null) return true;
    return (
      (bizMap.get(s.id) ?? getBundyBusinessDayKey(s.clock_in_time)) ===
      activeBusinessDayKey
    );
  });
  return openSessions.length > 0 ? openSessions[openSessions.length - 1] : null;
}

export function getDateInManilaDefault(iso: string): string {
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
  getDateInManila: (iso: string) => string = getDateInManilaDefault
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
  getDateInManila: (iso: string) => string = getDateInManilaDefault
): Promise<TimeEntrySession[]> {
  const punchFetchEnd = extendCutoffPeriodEndForPunchFetch(new Date(endIso)).toISOString();
  const { data: punches } = await supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at, lat, lng, device_info, source, office_location_id")
    .eq("employee_id", employeeId)
    .gte("punched_at", startIso)
    .lte("punched_at", punchFetchEnd)
    .order("punched_at", { ascending: true });
  const list = (punches || []) as TimeEntryPunch[];
  return filterOfficialBundySessions(
    punchesToSessions(list, getDateInManila).map((s) => ({
      ...s,
      employee_id: employeeId,
      regular_hours: s.regular_hours ?? s.total_hours ?? null,
    })),
    (s) => getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, list)
  );
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
  const punchFetchEnd = extendCutoffPeriodEndForPunchFetch(new Date(endIso)).toISOString();
  let query = supabase
    .from("time_entries")
    .select("id, employee_id, punch_type, punched_at, lat, lng, device_info, source, office_location_id")
    .gte("punched_at", startIso)
    .lte("punched_at", punchFetchEnd)
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
    const sessions = filterOfficialBundySessions(
      punchesToSessions(empPunches, (iso) => getDateInManilaDefault(iso)).map(
        (s) => ({ ...s, employee_id: empId })
      ),
      (s) => getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, empPunches)
    );
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
