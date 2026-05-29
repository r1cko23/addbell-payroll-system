/**
 * Weekly period utilities (cutoff Wednesday to Tuesday, Sunday = rest day)
 */

import { addDays, subDays, format, endOfDay } from "date-fns";

const WEDNESDAY_DOW = 3; // 0 = Sunday, 3 = Wednesday

/**
 * Get the Wednesday that starts the week containing the given date.
 * Week runs Wed (inclusive) to Tue (inclusive).
 */
export function getWeeklyPeriodStart(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  // If Tue (2), go back 6 days; Mon (1) back 5; Sun (0) back 4; Sat (6) back 3; Fri (5) back 2; Thu (4) back 1; Wed (3) stay
  const daysBack = (dow + 7 - WEDNESDAY_DOW) % 7;
  return subDays(d, daysBack);
}

/**
 * Get the Tuesday that ends the week (day after period start + 6).
 */
export function getWeeklyPeriodEnd(periodStart: Date): Date {
  return endOfDay(addDays(periodStart, 6));
}

/**
 * Format for display: "Wed, Mar 12 – Tue, Mar 18, 2025"
 */
export function formatWeeklyPeriod(periodStart: Date, periodEnd: Date): string {
  return `${format(periodStart, "EEE, MMM d")} – ${format(periodEnd, "EEE, MMM d, yyyy")}`;
}

/**
 * Next week (next Wednesday).
 */
export function getNextWeeklyPeriod(periodStart: Date): Date {
  return addDays(periodStart, 7);
}

/**
 * Previous week (previous Wednesday).
 */
export function getPreviousWeeklyPeriod(periodStart: Date): Date {
  return subDays(periodStart, 7);
}

/** Tuesday (inclusive end) for a Wed-start cutoff, as a calendar date. */
export function getWeeklyCutoffEndDate(weekStartWednesday: Date): Date {
  return addDays(
    new Date(
      weekStartWednesday.getFullYear(),
      weekStartWednesday.getMonth(),
      weekStartWednesday.getDate()
    ),
    6
  );
}

/**
 * Default payroll run week: last completed Wed–Tue cutoff.
 * On Tuesday, uses the week ending that day; otherwise the prior week.
 */
export function getDefaultPayrollRunWeek(referenceDate: Date = new Date()) {
  const today = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate()
  );
  const thisWeekStart = getWeeklyPeriodStart(today);
  const weekStart =
    today.getDay() === 2 ? thisWeekStart : getPreviousWeeklyPeriod(thisWeekStart);
  const weekEnd = getWeeklyCutoffEndDate(weekStart);
  const suggestedPayDate = addDays(weekEnd, 3);
  return { weekStart, weekEnd, suggestedPayDate };
}

export function buildPayrollRunFormFromWeekStart(weekStartWednesday: Date) {
  const start = new Date(
    weekStartWednesday.getFullYear(),
    weekStartWednesday.getMonth(),
    weekStartWednesday.getDate()
  );
  const weekEnd = getWeeklyCutoffEndDate(start);
  const suggestedPayDate = addDays(weekEnd, 3);
  return {
    cutoff_start: format(start, "yyyy-MM-dd"),
    cutoff_end: format(weekEnd, "yyyy-MM-dd"),
    pay_date: format(suggestedPayDate, "yyyy-MM-dd"),
  };
}

export function buildDefaultPayrollRunForm(referenceDate?: Date) {
  return buildPayrollRunFormFromWeekStart(
    getDefaultPayrollRunWeek(referenceDate).weekStart
  );
}

function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(y, mo - 1, d);
}

/** Wed–Tue cutoff week containing anchorYmd (yyyy-MM-dd). */
export function getWeeklyCutoffWindowForOtFiling(anchorYmd: string) {
  const anchor = parseYmd(anchorYmd);
  if (!anchor) return null;
  const weekStart = getWeeklyPeriodStart(anchor);
  const weekEnd = getWeeklyCutoffEndDate(weekStart);
  return {
    start_ymd: format(weekStart, "yyyy-MM-dd"),
    end_ymd: format(weekEnd, "yyyy-MM-dd"),
    label: formatWeeklyPeriod(weekStart, weekEnd),
  };
}

export type WeeklyCutoffPeriod = {
  start_ymd: string;
  end_ymd: string;
  label: string;
};

const OT_HISTORY_LOOKBACK_DAYS = 30;

/**
 * Wed–Tue cutoffs overlapping the last ~30 days (newest first).
 * Used for employee OT history grouped by payroll cutoff.
 */
export function getOtHistoryCutoffs(anchorYmd: string): {
  fetch_from: string;
  fetch_to: string;
  span_label: string;
  cutoffs: WeeklyCutoffPeriod[];
} | null {
  const anchor = parseYmd(anchorYmd);
  if (!anchor) return null;

  const rangeStart = subDays(anchor, OT_HISTORY_LOOKBACK_DAYS - 1);
  let weekStart = getWeeklyPeriodStart(anchor);
  const fetchTo = format(getWeeklyCutoffEndDate(weekStart), "yyyy-MM-dd");

  const cutoffsNewestFirst: WeeklyCutoffPeriod[] = [];
  for (let i = 0; i < 8; i++) {
    const weekEnd = getWeeklyCutoffEndDate(weekStart);
    if (weekEnd >= rangeStart) {
      cutoffsNewestFirst.push({
        start_ymd: format(weekStart, "yyyy-MM-dd"),
        end_ymd: format(weekEnd, "yyyy-MM-dd"),
        label: formatWeeklyPeriod(weekStart, weekEnd),
      });
    }
    if (weekEnd < rangeStart) break;
    weekStart = getPreviousWeeklyPeriod(weekStart);
  }

  const oldestStart =
    cutoffsNewestFirst[cutoffsNewestFirst.length - 1]?.start_ymd ??
    format(rangeStart, "yyyy-MM-dd");

  return {
    fetch_from: oldestStart,
    fetch_to: fetchTo,
    span_label: `${format(rangeStart, "MMM d")} – ${format(anchor, "MMM d, yyyy")}`,
    cutoffs: cutoffsNewestFirst,
  };
}

/** Map ot_date (yyyy-MM-dd) to cutoff start_ymd key, if it falls in a listed period. */
export function cutoffKeyForOtDate(
  otDateYmd: string,
  cutoffs: WeeklyCutoffPeriod[]
): string | null {
  for (const c of cutoffs) {
    if (otDateYmd >= c.start_ymd && otDateYmd <= c.end_ymd) {
      return c.start_ymd;
    }
  }
  return null;
}

/** @deprecated Use getOtHistoryCutoffs */
export function getOtHistoryWindow(anchorYmd: string) {
  const history = getOtHistoryCutoffs(anchorYmd);
  if (!history || history.cutoffs.length === 0) return null;
  const oldest = history.cutoffs[history.cutoffs.length - 1];
  const newest = history.cutoffs[0];
  return {
    start_ymd: history.fetch_from,
    end_ymd: history.fetch_to,
    label: `${oldest.label} – ${newest.label}`,
  };
}
