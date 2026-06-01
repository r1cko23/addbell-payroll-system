const MANILA_OFFSET = "+08:00";

/** Wall-clock yyyy-MM-dd + HH:mm as an instant in Asia/Manila (matches Bundy punches). */
function manilaYmdHmToEpochMs(
  y: number,
  m: number,
  d: number,
  h: number,
  min: number
): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(
    `${y}-${pad(m)}-${pad(d)}T${pad(h)}:${pad(min)}:00${MANILA_OFFSET}`
  ).getTime();
}

function nextManilaCalendarDay(y: number, m: number, d: number) {
  const ms = manilaYmdHmToEpochMs(y, m, d, 12, 0) + 86_400_000;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  return {
    y: Number(parts.find((p) => p.type === "year")?.value),
    m: Number(parts.find((p) => p.type === "month")?.value),
    d: Number(parts.find((p) => p.type === "day")?.value),
  };
}

/** Raw (uncredited) hours between claimed OT start/end — used for max-hours validation. */
export function computeRawOtSpanHours(params: {
  otDate: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
}): number | null {
  const sd = parseYmd(params.otDate);
  const st = parseHm(params.startTime);
  const et = parseHm(params.endTime);
  if (!sd || !st || !et) return null;

  const startMs = manilaYmdHmToEpochMs(sd.y, sd.m, sd.d, st.h, st.m);

  let endY = sd.y;
  let endM = sd.m;
  let endD = sd.d;

  if (params.endDate) {
    const ed = parseYmd(params.endDate);
    if (!ed) return null;
    endY = ed.y;
    endM = ed.m;
    endD = ed.d;
  } else if (et.h < st.h || (et.h === st.h && et.m <= st.m)) {
    const next = nextManilaCalendarDay(sd.y, sd.m, sd.d);
    endY = next.y;
    endM = next.m;
    endD = next.d;
  }

  const endMs = manilaYmdHmToEpochMs(endY, endM, endD, et.h, et.m);
  const diffMs = endMs - startMs;
  if (diffMs <= 0) return 0;

  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
}

export function getClaimedOtRangeEpochMs(params: {
  otDate: string;
  endDate?: string | null;
  startTime: string;
  endTime: string;
}): { startMs: number; endMs: number } | null {
  const sd = parseYmd(params.otDate);
  const st = parseHm(params.startTime);
  const et = parseHm(params.endTime);
  if (!sd || !st || !et) return null;

  const startMs = manilaYmdHmToEpochMs(sd.y, sd.m, sd.d, st.h, st.m);

  let endY = sd.y;
  let endM = sd.m;
  let endD = sd.d;

  if (params.endDate) {
    const ed = parseYmd(params.endDate);
    if (!ed) return null;
    endY = ed.y;
    endM = ed.m;
    endD = ed.d;
  } else if (et.h < st.h || (et.h === st.h && et.m <= st.m)) {
    const next = nextManilaCalendarDay(sd.y, sd.m, sd.d);
    endY = next.y;
    endM = next.m;
    endD = next.d;
  }

  const endMs = manilaYmdHmToEpochMs(endY, endM, endD, et.h, et.m);
  if (endMs <= startMs) return null;
  return { startMs, endMs };
}

/** Claimed OT period must fall within a linked Bundy in/out pair. */
export function isClaimedOtWithinBundySession(
  session: { clock_in_time: string; clock_out_time: string },
  claimed: {
    otDate: string;
    endDate?: string | null;
    startTime: string;
    endTime: string;
  }
): boolean {
  const range = getClaimedOtRangeEpochMs(claimed);
  if (!range) return false;
  const bundyIn = new Date(session.clock_in_time).getTime();
  const bundyOut = new Date(session.clock_out_time).getTime();
  return range.startMs >= bundyIn && range.endMs <= bundyOut;
}

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return { y, m: mo, d };
}

function parseHm(hm: string): { h: number; m: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mi)) return null;
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
  return { h, m: mi };
}
