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
const FUND_REQUEST_CUTOFF_START_DOW = 5; // Friday
const FUND_REQUEST_CUTOFF_DEADLINE_DOW = 4; // Thursday
const FUND_REQUEST_CUTOFF_DEADLINE_HOUR = 10; // 10:00 AM Manila

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

export function fundRequestBelongsToHistoryCutoff(
  request: FundRequestRow,
  cutoff: WeeklyCutoffPeriod
): boolean {
  const decisionYmd = getFundRequestFinalDecisionDateYmd(request);
  if (!decisionYmd) return false;
  return decisionYmd >= cutoff.start_ymd && decisionYmd <= cutoff.end_ymd;
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

export function getFundRequestFiledDateYmd(request: FundRequestRow): string | null {
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
  const manilaYmd = getManilaDateKeyFromIso(filingIso) || fallbackRequestDateYmd?.trim() || null;
  if (!manilaYmd) return null;

  const anchorDate = parseYmd(manilaYmd);
  if (!anchorDate) return null;

  let cutoffStart = getFundRequestCutoffPeriodStart(anchorDate);
  if (isAfterFundRequestCutoffDeadline(manilaYmd, filingIso)) {
    cutoffStart = addDays(cutoffStart, 7);
  }

  return format(cutoffStart, "yyyy-MM-dd");
}

/** Cutoff period start for a fund request (uses created_at when available). */
export function getFundRequestCutoffStartYmd(request: FundRequestRow): string | null {
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

export function isPoFundRequestRejection(request: FundRequestRow): boolean {
  return (
    request.status === "rejected" &&
    Boolean(request.project_manager_approved_at) &&
    !request.purchasing_officer_approved_at &&
    Boolean(request.rejected_at)
  );
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

export function getFundRequestHistoryCutoffs(anchorYmd: string): {
  fetch_from: string;
  fetch_to: string;
  span_label: string;
  cutoffs: WeeklyCutoffPeriod[];
} | null {
  const anchor = parseYmd(anchorYmd);
  if (!anchor) return null;

  const rangeStart = subDays(anchor, FUND_REQUEST_HISTORY_LOOKBACK_DAYS - 1);
  let weekStart = getFundRequestCutoffPeriodStart(anchor);
  const fetchTo = format(getFundRequestCutoffPeriodEnd(weekStart), "yyyy-MM-dd");

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

export function fundRequestBelongsToApproverCutoff(
  request: FundRequestRow,
  cutoff: WeeklyCutoffPeriod,
  _role: FundRequestApproverHistoryRole
): boolean {
  return getFundRequestCutoffStartYmd(request) === cutoff.start_ymd;
}

/** @deprecated Use fundRequestBelongsToApproverCutoff */
export function fundRequestBelongsToCutoff(
  request: FundRequestRow,
  cutoff: WeeklyCutoffPeriod
): boolean {
  return fundRequestBelongsToApproverCutoff(request, cutoff, "upper_management");
}
