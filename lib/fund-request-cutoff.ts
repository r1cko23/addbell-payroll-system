import {
  calendarDowFromManilaKey,
  getManilaDateKeyFromIso,
  getManilaHourMinute,
} from "@/utils/business-hours";
import {
  formatWeeklyPeriod,
  type WeeklyCutoffPeriod,
} from "@/utils/weekly";
import type { FundRequestRow } from "@/types/fund-request";
import { isFundRequestReturnedToPurchasing } from "@/lib/fund-request-approval";
import { addDays, subDays, format } from "date-fns";

const FUND_REQUEST_HISTORY_LOOKBACK_DAYS = 180;
const FUND_REQUEST_HISTORY_MAX_WEEKS = 30;
/** How many Fri–Thu cutoffs ahead of today tabs may navigate to (e.g. rolled-forward filings). */
export const FUND_REQUEST_FORWARD_CUTOFF_WEEKS = 1;
const FUND_REQUEST_CUTOFF_START_DOW = 5; // Friday
const FUND_REQUEST_CUTOFF_DEADLINE_DOW = 4; // Thursday
const FUND_REQUEST_CUTOFF_DEADLINE_HOUR = 10; // 10:00 AM Manila

/** Fri-start weeks with no Thu 10:00 AM roll-forward (plain Fri–Thu filing window). */
const FUND_REQUEST_CUTOFF_NO_DEADLINE_ROLLFORWARD_WEEK_START_YMDS = [
  "2026-06-26", // Jun 26 – Jul 2, 2026 recovery week
] as const;

/** Active Fri–Thu cutoff start (yyyy-MM-dd) containing the anchor date. */
export function getActiveFundRequestCutoffStartYmd(
  anchor: Date = new Date()
): string {
  return format(getFundRequestCutoffPeriodStart(anchor), "yyyy-MM-dd");
}

/** Cutoff weeks where Thu 10:00 AM roll-forward is disabled (plain Fri–Thu only). */
export function getFundRequestCutoffGraceWeekStartYmds(
  _anchor: Date = new Date()
): Set<string> {
  return new Set(FUND_REQUEST_CUTOFF_NO_DEADLINE_ROLLFORWARD_WEEK_START_YMDS);
}

/**
 * Skip Thu 10:00 AM roll-forward for explicitly exempt cutoff weeks only
 * (e.g. Jun 26 – Jul 2, 2026 recovery week).
 */
export function shouldSkipFundRequestCutoffDeadlineRollForward(
  calendarCutoffStart: Date,
  anchor: Date = new Date()
): boolean {
  return getFundRequestCutoffGraceWeekStartYmds(anchor).has(
    format(calendarCutoffStart, "yyyy-MM-dd")
  );
}

export function isFundRequestCutoffDeadlineRollForwardActive(
  anchor: Date = new Date()
): boolean {
  return !shouldSkipFundRequestCutoffDeadlineRollForward(
    getFundRequestCutoffPeriodStart(anchor),
    anchor
  );
}

/** Whether the selected cutoff week uses the Thursday 10:00 AM Manila filing deadline. */
export function shouldShowFundRequestCutoffDeadlineTimeForPeriod(
  cutoffStartYmd: string,
  anchor: Date = new Date()
): boolean {
  const start = parseYmd(cutoffStartYmd);
  if (!start) return true;
  return !shouldSkipFundRequestCutoffDeadlineRollForward(start, anchor);
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

/** Friday that starts the Fri–Thu cutoff containing the given date. */
export function getFundRequestCutoffPeriodStart(date: Date = new Date()): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dow = d.getDay();
  const daysBack = (dow + 7 - FUND_REQUEST_CUTOFF_START_DOW) % 7;
  return subDays(d, daysBack);
}

/** Thursday (inclusive) ending a Fri-start cutoff. */
export function getFundRequestCutoffPeriodEnd(periodStartFriday: Date): Date {
  return addDays(
    new Date(
      periodStartFriday.getFullYear(),
      periodStartFriday.getMonth(),
      periodStartFriday.getDate()
    ),
    6
  );
}

function getPreviousFundRequestCutoffPeriod(periodStartFriday: Date): Date {
  return subDays(periodStartFriday, 7);
}

export function formatFundRequestCutoffPeriod(
  periodStartFriday: Date,
  periodEndThursday: Date
): string {
  const startFormatted = format(periodStartFriday, "MMM d");
  const endFormatted = format(periodEndThursday, "MMM d, yyyy");
  return `${startFormatted} – ${endFormatted}`;
}

export type FundRequestHistoryOutcome = "approved" | "rejected";

/** @deprecated Use FundRequestHistoryOutcome */
export type UmHistoryOutcome = "approved" | "returned" | "rejected";
/** @deprecated Use FundRequestHistoryOutcome */
export type PoHistoryOutcome = "approved" | "rejected";
/** @deprecated History is no longer role-specific */
export type ApproverHistoryOutcome = FundRequestHistoryOutcome;
/** @deprecated History is no longer role-specific */
export type FundRequestApproverHistoryRole = "upper_management" | "purchasing_officer";

/** Upper management rejected after purchasing had approved (final decision). */
export function isFundRequestUpperManagementFinalRejection(
  request: FundRequestRow
): boolean {
  if (request.status !== "rejected" || !request.rejected_at) return false;
  if (isFundRequestReturnedToPurchasing(request)) return false;
  if (request.purchasing_officer_approved_at) return true;
  const snapshot = request.rejection_undo_snapshot;
  return snapshot?.status === "purchasing_officer_approved";
}

/** History includes only upper management final approve or final reject. */
export function isFundRequestFinalDecisionHistoryEntry(
  request: FundRequestRow
): boolean {
  if (request.status === "management_approved" && request.management_approved_at) {
    return true;
  }
  return isFundRequestUpperManagementFinalRejection(request);
}

export function getFundRequestHistoryOutcome(
  request: FundRequestRow
): FundRequestHistoryOutcome | null {
  if (!isFundRequestFinalDecisionHistoryEntry(request)) return null;
  if (request.status === "management_approved") return "approved";
  return "rejected";
}

export function getFundRequestFinalDecisionDateYmd(
  request: FundRequestRow
): string | null {
  if (request.status === "management_approved" && request.management_approved_at) {
    return getManilaDateKeyFromIso(request.management_approved_at);
  }
  if (isFundRequestUpperManagementFinalRejection(request) && request.rejected_at) {
    return getManilaDateKeyFromIso(request.rejected_at);
  }
  return null;
}

/** History and requester views use the filing-date cutoff bucket. */
export function fundRequestBelongsToHistoryCutoff(
  request: FundRequestRow,
  cutoff: WeeklyCutoffPeriod
): boolean {
  return getFundRequestFilingCutoffStartYmd(request) === cutoff.start_ymd;
}

export const FUND_REQUEST_HISTORY_FETCH_OR =
  "status.eq.management_approved,and(status.eq.rejected,purchasing_officer_approved_at.not.is.null)";

export function getUmFundRequestDecisionDateYmd(request: FundRequestRow): string | null {
  return getFundRequestFinalDecisionDateYmd(request);
}

/** @deprecated Use getFundRequestFinalDecisionDateYmd */
export function getFundRequestDecisionDateYmd(request: FundRequestRow): string | null {
  return getFundRequestFinalDecisionDateYmd(request);
}

export function getFundRequestFiledDateYmd(
  request: Pick<FundRequestRow, "request_date">
): string | null {
  const raw = request.request_date?.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (raw.includes("T")) return getManilaDateKeyFromIso(raw);
  return raw.slice(0, 10);
}

function isAfterFundRequestCutoffDeadline(
  manilaYmd: string,
  filingIso: string
): boolean {
  if (calendarDowFromManilaKey(manilaYmd) !== FUND_REQUEST_CUTOFF_DEADLINE_DOW) {
    return false;
  }
  const { hour, minute } = getManilaHourMinute(filingIso);
  return (
    hour > FUND_REQUEST_CUTOFF_DEADLINE_HOUR ||
    (hour === FUND_REQUEST_CUTOFF_DEADLINE_HOUR && minute > 0)
  );
}

/**
 * Fri–Thu cutoff start (yyyy-MM-dd) for when a request was filed.
 * Filings are eligible through Thursday 10:00 AM Manila; after that they roll to the next cutoff.
 */
export function getFundRequestCutoffStartYmdForFiling(
  filingIso: string,
  fallbackRequestDateYmd?: string | null
): string | null {
  const requestDateYmd = fallbackRequestDateYmd?.trim() || null;
  const submittedYmd = getManilaDateKeyFromIso(filingIso);
  // Cutoff week follows the requestor's filing date; submission time only affects Thu 10 AM roll-forward.
  const filingCalendarYmd = requestDateYmd || submittedYmd || null;
  if (!filingCalendarYmd) return null;

  const anchorDate = parseYmd(filingCalendarYmd);
  if (!anchorDate) return null;

  let cutoffStart = getFundRequestCutoffPeriodStart(anchorDate);
  const cutoffEndYmd = format(getFundRequestCutoffPeriodEnd(cutoffStart), "yyyy-MM-dd");
  if (
    !shouldSkipFundRequestCutoffDeadlineRollForward(cutoffStart) &&
    submittedYmd === cutoffEndYmd &&
    isAfterFundRequestCutoffDeadline(submittedYmd, filingIso)
  ) {
    cutoffStart = addDays(cutoffStart, 7);
  }

  return format(cutoffStart, "yyyy-MM-dd");
}

/** Fri–Thu cutoff start from request_date only (ignores Thu 10 AM roll-forward). */
export function getFundRequestCalendarCutoffStartYmd(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): string | null {
  const ymd = getFundRequestFiledDateYmd(request);
  if (!ymd) return null;
  const anchorDate = parseYmd(ymd);
  if (!anchorDate) return null;
  return format(getFundRequestCutoffPeriodStart(anchorDate), "yyyy-MM-dd");
}

/**
 * True when a request was filed after the Thu 10:00 AM deadline and assigned to the next cutoff.
 * Uses filing time only (ignores later approval/rejection).
 */
export function isFundRequestInSucceedingCutoff(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): boolean {
  const assignedCutoffStartYmd = getFundRequestFilingCutoffStartYmd(
    request as FundRequestRow
  );
  const calendarCutoffStartYmd = getFundRequestCalendarCutoffStartYmd(request);
  if (!assignedCutoffStartYmd || !calendarCutoffStartYmd) return false;

  const calendarStart = parseYmd(calendarCutoffStartYmd);
  if (!calendarStart) return false;

  const succeedingCutoffStartYmd = format(addDays(calendarStart, 7), "yyyy-MM-dd");
  return assignedCutoffStartYmd === succeedingCutoffStartYmd;
}

/**
 * Cutoff Upper Management is still reviewing: the Fri–Thu week whose Thursday
 * 10:00 AM Manila deadline most recently passed. After that deadline, new
 * filings go to the next week; "Move to Current Cutoff" pulls them back here.
 */
export function getFundRequestCurrentProcessingCutoffStartYmd(
  now: Date = new Date()
): string {
  const nowYmd = getManilaDateKeyFromIso(now.toISOString());
  const anchor = (nowYmd ? parseYmd(nowYmd) : null) ?? now;
  const calendarStart = getFundRequestCutoffPeriodStart(anchor);
  const thursdayYmd = format(
    getFundRequestCutoffPeriodEnd(calendarStart),
    "yyyy-MM-dd"
  );
  const pastDeadline =
    Boolean(nowYmd) &&
    (nowYmd > thursdayYmd ||
      (nowYmd === thursdayYmd &&
        isAfterFundRequestCutoffDeadline(nowYmd, now.toISOString())));
  if (pastDeadline) {
    return format(calendarStart, "yyyy-MM-dd");
  }
  return format(subDays(calendarStart, 7), "yyyy-MM-dd");
}

/** True when the request sits in the week after the current UM processing batch. */
export function isFundRequestInCurrentProcessingSucceedingCutoff(
  request: Pick<FundRequestRow, "request_date" | "created_at">,
  now: Date = new Date()
): boolean {
  const filingStartYmd = getFundRequestFilingCutoffStartYmd(request);
  if (!filingStartYmd) return false;
  const currentStart = parseYmd(getFundRequestCurrentProcessingCutoffStartYmd(now));
  if (!currentStart) return false;
  return filingStartYmd === format(addDays(currentStart, 7), "yyyy-MM-dd");
}

/**
 * Fri–Thu cutoff for when the request was filed (created_at + request_date roll-forward).
 * Cutoff moves and “succeeding cutoff” checks use this.
 */
export function getFundRequestFilingCutoffStartYmd(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): string | null {
  if (request.created_at) {
    return getFundRequestCutoffStartYmdForFiling(
      request.created_at,
      getFundRequestFiledDateYmd(request)
    );
  }

  const ymd = getFundRequestFiledDateYmd(request);
  if (!ymd) return null;
  const anchorDate = parseYmd(ymd);
  if (!anchorDate) return null;
  return format(getFundRequestCutoffPeriodStart(anchorDate), "yyyy-MM-dd");
}

/**
 * Cutoff period for inbox / history / list bucketing — always the filing week
 * (created_at / request_date), including after final approval for audit.
 */
export function getFundRequestCutoffStartYmd(request: FundRequestRow): string | null {
  return getFundRequestFilingCutoffStartYmd(request);
}

/** Statuses auto-cancelled when their own approval deadline has passed. */
export const FUND_REQUEST_CUTOFF_EXPIRABLE_STATUSES = [
  "pending",
  "project_manager_approved",
] as const;

export type FundRequestCutoffExpirableStatus =
  (typeof FUND_REQUEST_CUTOFF_EXPIRABLE_STATUSES)[number];

export function isFundRequestCutoffExpirableStatus(
  status: FundRequestRow["status"] | string | null | undefined
): status is FundRequestCutoffExpirableStatus {
  return (
    status === "pending" || status === "project_manager_approved"
  );
}

function manilaDateTime(ymd: string, hour: number, minute: number): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${ymd}T${hh}:${mm}:00+08:00`);
}

/** Thursday YMD of a Fri-start cutoff week. */
export function getFundRequestCutoffThursdayYmd(
  cutoffStartFridayYmd: string
): string | null {
  const start = parseYmd(cutoffStartFridayYmd);
  if (!start) return null;
  return format(getFundRequestCutoffPeriodEnd(start), "yyyy-MM-dd");
}

/**
 * Saturday 00:00 Manila after the Friday that follows the filing week's Thursday.
 * First instant Purchasing is past end-of-Friday.
 */
export function getFundRequestPoExpiryInstant(
  cutoffStartFridayYmd: string
): Date | null {
  const thursdayYmd = getFundRequestCutoffThursdayYmd(cutoffStartFridayYmd);
  const thursday = thursdayYmd ? parseYmd(thursdayYmd) : null;
  if (!thursday) return null;
  const saturdayYmd = format(addDays(thursday, 2), "yyyy-MM-dd");
  return manilaDateTime(saturdayYmd, 0, 0);
}

export function isFundRequestPastOperationsManagerCutoff(
  request: Pick<
    FundRequestRow,
    "request_date" | "created_at" | "status" | "returned_at"
  >,
  now: Date = new Date()
): boolean {
  if (request.status !== "pending") return false;
  if (request.returned_at) return false;
  const filingStart = getFundRequestFilingCutoffStartYmd(request);
  if (!filingStart) return false;
  const thursdayYmd = getFundRequestCutoffThursdayYmd(filingStart);
  if (!thursdayYmd) return false;
  return now.getTime() >= manilaDateTime(thursdayYmd, 10, 0).getTime();
}

export function isFundRequestPastPurchasingOfficerCutoff(
  request: Pick<
    FundRequestRow,
    "request_date" | "created_at" | "status" | "returned_at"
  >,
  now: Date = new Date()
): boolean {
  if (request.status !== "project_manager_approved") return false;
  if (request.returned_at) return false;
  const filingStart = getFundRequestFilingCutoffStartYmd(request);
  if (!filingStart) return false;
  const poExpiry = getFundRequestPoExpiryInstant(filingStart);
  if (!poExpiry) return false;
  return now.getTime() >= poExpiry.getTime();
}

/**
 * True when an OM- or PO-stage request missed its own deadline.
 * - Operations (`pending`): Thursday 10:00 AM Manila of the filing week.
 * - Purchasing (`project_manager_approved`): end of the Friday after that Thursday.
 * UM (`purchasing_officer_approved`) never expires.
 * Returned-to-purchasing (`returned_at`) also never expires.
 */
export function isFundRequestPastCutoffForOmPoExpiry(
  request: Pick<
    FundRequestRow,
    "request_date" | "created_at" | "status" | "returned_at"
  >,
  now: Date = new Date()
): boolean {
  return (
    isFundRequestPastOperationsManagerCutoff(request, now) ||
    isFundRequestPastPurchasingOfficerCutoff(request, now)
  );
}

/** Stable actor id for cutoff auto-cancellations (not a real auth user). */
export const FUND_REQUEST_CUTOFF_EXPIRY_SYSTEM_ACTOR_ID =
  "00000000-0000-4000-8000-0000000000f1";

export const FUND_REQUEST_CUTOFF_EXPIRY_REASON_OM =
  "Auto-cancelled: Operations Manager did not approve before Thursday 10:00 AM. Please file a new request.";
export const FUND_REQUEST_CUTOFF_EXPIRY_REASON_PO =
  "Auto-cancelled: Purchasing Officer did not approve before the end of Friday. Please file a new request.";
/** Historical expiry copy (pre OM/PO split). Still treated as cutoff auto-cancel. */
export const FUND_REQUEST_CUTOFF_EXPIRY_REASON =
  "Auto-cancelled: the weekly cutoff ended before Operations/Purchasing approval. Please file a new request.";

export function isFundRequestCutoffExpirySystemActor(
  userId: string | null | undefined
): boolean {
  return userId === FUND_REQUEST_CUTOFF_EXPIRY_SYSTEM_ACTOR_ID;
}

const FUND_REQUEST_CUTOFF_EXPIRY_REASONS = new Set([
  FUND_REQUEST_CUTOFF_EXPIRY_REASON,
  FUND_REQUEST_CUTOFF_EXPIRY_REASON_OM,
  FUND_REQUEST_CUTOFF_EXPIRY_REASON_PO,
]);

/** True when a rejection was produced by weekly cutoff auto-cancel. */
export function isFundRequestCutoffExpiryRejection(
  request: Pick<FundRequestRow, "rejected_by" | "rejection_reason">
): boolean {
  if (isFundRequestCutoffExpirySystemActor(request.rejected_by)) return true;
  return (
    typeof request.rejection_reason === "string" &&
    FUND_REQUEST_CUTOFF_EXPIRY_REASONS.has(request.rejection_reason)
  );
}

export function isPoFundRequestRejection(request: FundRequestRow): boolean {
  if (request.status !== "rejected" || !request.rejected_at) return false;
  if (request.purchasing_officer_approved_at) return false;

  const priorStatus = request.rejection_undo_snapshot?.status;
  if (priorStatus === "pending") return false;
  if (priorStatus === "purchasing_officer_approved") return false;
  if (priorStatus === "project_manager_approved") return true;
  if (Boolean(request.project_manager_approved_at)) return true;

  return false;
}

export function getPoFundRequestDecisionDateYmd(request: FundRequestRow): string | null {
  if (request.purchasing_officer_approved_at) {
    return getManilaDateKeyFromIso(request.purchasing_officer_approved_at);
  }
  if (isPoFundRequestRejection(request) && request.rejected_at) {
    return getManilaDateKeyFromIso(request.rejected_at);
  }
  return null;
}

export function getFundRequestApproverDecisionDateYmd(
  request: FundRequestRow,
  role: FundRequestApproverHistoryRole
): string | null {
  if (role === "purchasing_officer") {
    return getPoFundRequestDecisionDateYmd(request);
  }
  return getUmFundRequestDecisionDateYmd(request);
}

export function isFundRequestUmHistoryEntry(request: FundRequestRow): boolean {
  if (request.status === "management_approved") {
    return Boolean(request.management_approved_at);
  }
  if (request.status === "rejected") {
    return Boolean(request.rejected_at);
  }
  if (isFundRequestReturnedToPurchasing(request)) {
    return true;
  }
  return false;
}

export function getUmHistoryOutcome(request: FundRequestRow): UmHistoryOutcome | null {
  if (!isFundRequestUmHistoryEntry(request)) return null;
  if (request.status === "management_approved") return "approved";
  if (isFundRequestReturnedToPurchasing(request)) return "returned";
  return "rejected";
}

export function isFundRequestPoHistoryEntry(request: FundRequestRow): boolean {
  if (request.purchasing_officer_approved_at) return true;
  return isPoFundRequestRejection(request);
}

export function getPoHistoryOutcome(request: FundRequestRow): PoHistoryOutcome | null {
  if (!isFundRequestPoHistoryEntry(request)) return null;
  if (request.purchasing_officer_approved_at) return "approved";
  return "rejected";
}

export function isFundRequestApproverHistoryEntry(
  request: FundRequestRow,
  _role?: FundRequestApproverHistoryRole
): boolean {
  return isFundRequestFinalDecisionHistoryEntry(request);
}

export function getApproverHistoryOutcome(
  request: FundRequestRow,
  _role?: FundRequestApproverHistoryRole
): ApproverHistoryOutcome | null {
  return getFundRequestHistoryOutcome(request);
}

export function getFundRequestHistoryCutoffs(
  anchorYmd: string,
  options?: { forwardWeeks?: number }
): {
  fetch_from: string;
  fetch_to: string;
  span_label: string;
  cutoffs: WeeklyCutoffPeriod[];
} | null {
  const anchor = parseYmd(anchorYmd);
  if (!anchor) return null;

  const forwardWeeks = Math.max(0, options?.forwardWeeks ?? 0);
  const rangeStart = subDays(anchor, FUND_REQUEST_HISTORY_LOOKBACK_DAYS - 1);
  let weekStart = getFundRequestCutoffPeriodStart(anchor);
  let fetchTo = format(getFundRequestCutoffPeriodEnd(weekStart), "yyyy-MM-dd");

  const cutoffsNewestFirst: WeeklyCutoffPeriod[] = [];
  for (let i = 0; i < FUND_REQUEST_HISTORY_MAX_WEEKS; i++) {
    const weekEnd = getFundRequestCutoffPeriodEnd(weekStart);
    if (weekEnd >= rangeStart) {
      cutoffsNewestFirst.push({
        start_ymd: format(weekStart, "yyyy-MM-dd"),
        end_ymd: format(weekEnd, "yyyy-MM-dd"),
        label: formatWeeklyPeriod(weekStart, weekEnd),
      });
    }
    if (weekEnd < rangeStart) break;
    weekStart = getPreviousFundRequestCutoffPeriod(weekStart);
  }

  if (forwardWeeks > 0) {
    let futureStart = addDays(getFundRequestCutoffPeriodStart(anchor), 7);
    for (let i = 0; i < forwardWeeks; i++) {
      const weekEnd = getFundRequestCutoffPeriodEnd(futureStart);
      cutoffsNewestFirst.unshift({
        start_ymd: format(futureStart, "yyyy-MM-dd"),
        end_ymd: format(weekEnd, "yyyy-MM-dd"),
        label: formatWeeklyPeriod(futureStart, weekEnd),
      });
      fetchTo = format(weekEnd, "yyyy-MM-dd");
      futureStart = addDays(futureStart, 7);
    }
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

/** Index of the active Fri–Thu cutoff in a newest-first cutoff list. */
export function getActiveFundRequestCutoffIndex(
  cutoffs: readonly WeeklyCutoffPeriod[],
  anchor: Date = new Date()
): number {
  const activeStart = getActiveFundRequestCutoffStartYmd(anchor);
  const index = cutoffs.findIndex((cutoff) => cutoff.start_ymd === activeStart);
  return index >= 0 ? index : 0;
}

export function cutoffKeyForFundRequestFiledDate(
  request: FundRequestRow,
  cutoffs: WeeklyCutoffPeriod[]
): string | null {
  const cutoffStartYmd = getFundRequestCutoffStartYmd(request);
  if (!cutoffStartYmd) return null;
  return cutoffs.some((cutoff) => cutoff.start_ymd === cutoffStartYmd)
    ? cutoffStartYmd
    : null;
}

/** @deprecated Use cutoffKeyForFundRequestFiledDate */
export function cutoffKeyForFundRequestDecision(
  request: FundRequestRow,
  cutoffs: WeeklyCutoffPeriod[],
  _role: FundRequestApproverHistoryRole = "upper_management"
): string | null {
  return cutoffKeyForFundRequestFiledDate(request, cutoffs);
}

/**
 * Whether a request belongs to a cutoff for inbox / All Requests bucketing.
 * Always uses the filing cutoff only — requests stay in the week they were filed.
 */
export function fundRequestBelongsToApproverCutoff(
  request: FundRequestRow,
  cutoff: WeeklyCutoffPeriod,
  _role?: FundRequestApproverHistoryRole | string | null,
  _now?: Date
): boolean {
  return getFundRequestFilingCutoffStartYmd(request) === cutoff.start_ymd;
}

/** @deprecated Use fundRequestBelongsToApproverCutoff */
export function fundRequestBelongsToCutoff(
  request: FundRequestRow,
  cutoff: WeeklyCutoffPeriod
): boolean {
  return fundRequestBelongsToApproverCutoff(request, cutoff, "upper_management");
}
