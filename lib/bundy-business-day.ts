/**
 * Bundy business day: starts 07:00 Asia/Manila, ends 06:59 the next calendar day.
 * Open sessions from the prior business day stay active until 06:59 (auto clock-out)
 * or a manual clock-out — including between midnight and 06:59.
 */

export const BUNDY_BUSINESS_DAY_START_HOUR = 7;
export const BUNDY_AUTO_CLOCK_OUT_HOUR = 6;
export const BUNDY_AUTO_CLOCK_OUT_MINUTE = 59;

const MANILA_TZ = "Asia/Manila";

export type ManilaWallClock = {
  dateKey: string;
  hour: number;
  minute: number;
};

/** Calendar yyyy-MM-dd and wall clock in Manila. */
export function getManilaWallClock(isoOrDate: string | Date): ManilaWallClock {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
    minute,
  };
}

/** Today's calendar date in Asia/Manila (yyyy-MM-dd). Use for date input max/min. */
export function getManilaTodayYmd(now: Date = new Date()): string {
  return getManilaWallClock(now).dateKey;
}

/** Add calendar days to a yyyy-MM-dd string. */
export function addCalendarDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * Wall-clock business day (7 AM boundary) without session context.
 * Before 7 AM Manila always maps to the previous calendar day — used for overnight
 * tail punches that continue an open session from the prior evening.
 */
export function getBundyBusinessDayKey(isoOrDate: string | Date): string {
  const { dateKey, hour } = getManilaWallClock(isoOrDate);
  if (hour < BUNDY_BUSINESS_DAY_START_HOUR) {
    const [y, m, d] = dateKey.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    const py = prev.getUTCFullYear();
    const pm = String(prev.getUTCMonth() + 1).padStart(2, "0");
    const pd = String(prev.getUTCDate()).padStart(2, "0");
    return `${py}-${pm}-${pd}`;
  }
  return dateKey;
}

export type PunchForBundyBizDay = {
  id: string;
  punch_type: "in" | "out";
  punched_at: string;
};

/**
 * Business day for a clock-IN punch.
 * - At/after 7 AM: calendar date.
 * - Before 7 AM with an open session: same business day as that open session (overnight).
 * - Before 7 AM with no open session: calendar date (early-bird start for today's shift).
 */
export function getBundyBusinessDayKeyForClockIn(
  punchedAtIso: string,
  hasOpenSession: boolean,
  openSessionClockInIso?: string | null
): string {
  const { dateKey, hour } = getManilaWallClock(punchedAtIso);
  if (hour >= BUNDY_BUSINESS_DAY_START_HOUR) {
    return dateKey;
  }
  if (hasOpenSession && openSessionClockInIso) {
    return getBundyBusinessDayKey(openSessionClockInIso);
  }
  return dateKey;
}

/**
 * Assigns a business-day key to each IN punch by walking punches in time order.
 * Used for official-session filtering, auto clock-out deadlines, and open-session checks.
 */
export function assignBundyBusinessDayKeysFromPunches(
  punches: PunchForBundyBizDay[]
): Map<string, string> {
  const sorted = [...punches].sort(
    (a, b) => new Date(a.punched_at).getTime() - new Date(b.punched_at).getTime()
  );
  const inPunchBizDay = new Map<string, string>();
  let openIn: PunchForBundyBizDay | null = null;

  for (const p of sorted) {
    if (p.punch_type === "in") {
      const biz = getBundyBusinessDayKeyForClockIn(
        p.punched_at,
        openIn !== null,
        openIn?.punched_at ?? null
      );
      inPunchBizDay.set(p.id, biz);
      openIn = p;
    } else if (p.punch_type === "out" && openIn) {
      const outMs = new Date(p.punched_at).getTime();
      const inMs = new Date(openIn.punched_at).getTime();
      if (outMs > inMs) {
        openIn = null;
      }
    }
  }
  return inPunchBizDay;
}

/** Business day for a session's clock-in punch id, when punch list is available. */
export function getBundyBusinessDayKeyForInPunch(
  inPunchId: string,
  clockInIso: string,
  punches: PunchForBundyBizDay[]
): string {
  const map = assignBundyBusinessDayKeysFromPunches(punches);
  return map.get(inPunchId) ?? getBundyBusinessDayKey(clockInIso);
}

/** ISO timestamp for auto clock-out: next calendar day after businessDayKey at 06:59 Manila. */
export function getBundyBusinessDayAutoOutIso(businessDayKey: string): string {
  const [y, m, d] = businessDayKey.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  const ny = next.getUTCFullYear();
  const nm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nd = String(next.getUTCDate()).padStart(2, "0");
  const hh = String(BUNDY_AUTO_CLOCK_OUT_HOUR).padStart(2, "0");
  const mm = String(BUNDY_AUTO_CLOCK_OUT_MINUTE).padStart(2, "0");
  return `${ny}-${nm}-${nd}T${hh}:${mm}:00+08:00`;
}

/** True when server time is at or after 06:59 Manila on the day after the session's business day. */
export function isPastBundyAutoClockOut(
  clockInIso: string,
  now: Date = new Date(),
  businessDayKey?: string
): boolean {
  const businessDay = businessDayKey ?? getBundyBusinessDayKey(clockInIso);
  const deadlineMs = new Date(getBundyBusinessDayAutoOutIso(businessDay)).getTime();
  return now.getTime() >= deadlineMs;
}

export const BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO =
  "auto:business-day-close@06:59 Manila";

/**
 * Extend cutoff period end when querying time_entries so clock-outs on the
 * calendar day after the last cutoff day are included (e.g. Tue shift out at Wed 12:00 AM).
 */
export function extendCutoffPeriodEndForPunchFetch(periodEnd: Date): Date {
  const d = new Date(periodEnd);
  d.setDate(d.getDate() + 1);
  d.setHours(23, 59, 59, 999);
  return d;
}
