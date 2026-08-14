import { format, parse } from "date-fns";
import type { FundRequestCutoffAdjustmentEntry, FundRequestRow } from "@/types/fund-request";
import {
  appendFundRequestCutoffAdjustmentHistory,
  getActiveFundRequestCutoffAdjustment,
  markLatestFundRequestCutoffAdjustmentUndone,
} from "@/lib/fund-request-cutoff-adjustment-history";
import {
  formatFundRequestCutoffPeriod,
  getFundRequestCurrentProcessingCutoffStartYmd,
  getFundRequestCutoffPeriodEnd,
  getFundRequestFiledDateYmd,
  getFundRequestFilingCutoffStartYmd,
  isFundRequestInCurrentProcessingSucceedingCutoff,
} from "@/lib/fund-request-cutoff";
import { normalizeUserRole } from "@/lib/user-roles";

const CUTOFF_SAFE_FILING_UTC_OFFSET = "+00:00";
const CUTOFF_SAFE_FILING_UTC_HOUR = 1;
const CUTOFF_SAFE_FILING_UTC_MINUTE = 0;

function parseYmd(ymd: string): Date | null {
  const parsed = parse(ymd, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Place a request into a Fri–Thu cutoff: keep request_date when it already
 * falls in that week; otherwise use that week's Thursday before 10:00 AM.
 */
export function buildFundRequestPlacementForCutoff(
  request: Pick<FundRequestRow, "request_date" | "created_at">,
  cutoffStartYmd: string
): { requestDate: string; createdAt: string } | null {
  const cutoffStart = parseYmd(cutoffStartYmd);
  if (!cutoffStart) return null;

  const cutoffEndYmd = format(getFundRequestCutoffPeriodEnd(cutoffStart), "yyyy-MM-dd");
  const requestDateYmd = getFundRequestFiledDateYmd(request);
  const filingYmd =
    requestDateYmd &&
    requestDateYmd >= cutoffStartYmd &&
    requestDateYmd <= cutoffEndYmd
      ? requestDateYmd
      : cutoffEndYmd;

  const hour = String(CUTOFF_SAFE_FILING_UTC_HOUR).padStart(2, "0");
  const minute = String(CUTOFF_SAFE_FILING_UTC_MINUTE).padStart(2, "0");
  return {
    requestDate: filingYmd,
    createdAt: `${filingYmd}T${hour}:${minute}:00.000${CUTOFF_SAFE_FILING_UTC_OFFSET}`,
  };
}

/** Timestamp on the filing Thursday (or request date) before the 10:00 AM Manila deadline. */
export function buildFundRequestCreatedAtForCalendarCutoff(
  request: Pick<FundRequestRow, "request_date" | "created_at">,
  now: Date = new Date()
): string | null {
  const cutoffStartYmd = getFundRequestCurrentProcessingCutoffStartYmd(now);
  return buildFundRequestPlacementForCutoff(request, cutoffStartYmd)?.createdAt ?? null;
}

export function getFundRequestProcessingCutoffStartYmd(
  _request?: Pick<FundRequestRow, "request_date" | "created_at">,
  now: Date = new Date()
): string | null {
  return getFundRequestCurrentProcessingCutoffStartYmd(now);
}

export function formatFundRequestCutoffStartLabel(cutoffStartYmd: string): string {
  const start = parseYmd(cutoffStartYmd);
  if (!start) return cutoffStartYmd;
  return formatFundRequestCutoffPeriod(start, getFundRequestCutoffPeriodEnd(start));
}

function isFundRequestCutoffMoveEligibleStatus(
  status: FundRequestRow["status"] | null | undefined
): boolean {
  return status !== "management_approved" && status !== "rejected";
}

export function canMoveFundRequestToCurrentCutoff(
  request: Pick<FundRequestRow, "request_date" | "created_at" | "status">,
  role: string | null | undefined,
  now: Date = new Date()
): boolean {
  if (normalizeUserRole(role) !== "upper_management") return false;
  if (!isFundRequestCutoffMoveEligibleStatus(request.status)) return false;
  return isFundRequestInCurrentProcessingSucceedingCutoff(request, now);
}

export function canUndoFundRequestCutoffMove(
  request: Pick<
    FundRequestRow,
    "request_date" | "created_at" | "status" | "cutoff_adjustment_history"
  >,
  role: string | null | undefined
): boolean {
  if (normalizeUserRole(role) !== "upper_management") return false;
  if (!isFundRequestCutoffMoveEligibleStatus(request.status)) return false;
  return getActiveFundRequestCutoffAdjustment(request) !== null;
}

export function buildFundRequestMoveToCurrentCutoffUpdates(
  request: FundRequestRow,
  actorUserId: string,
  movedAt: string = new Date().toISOString(),
  now: Date = new Date()
): { updates: Record<string, unknown>; adjustment: FundRequestCutoffAdjustmentEntry } | null {
  if (!canMoveFundRequestToCurrentCutoff(request, "upper_management", now)) {
    return null;
  }

  const fromCutoffStartYmd = getFundRequestFilingCutoffStartYmd(request);
  const toCutoffStartYmd = getFundRequestCurrentProcessingCutoffStartYmd(now);
  const placement = buildFundRequestPlacementForCutoff(request, toCutoffStartYmd);

  if (!fromCutoffStartYmd || !toCutoffStartYmd || !placement) {
    return null;
  }

  const adjustment: FundRequestCutoffAdjustmentEntry = {
    moved_by: actorUserId,
    moved_at: movedAt,
    from_cutoff_start_ymd: fromCutoffStartYmd,
    to_cutoff_start_ymd: toCutoffStartYmd,
    from_created_at: request.created_at,
    to_created_at: placement.createdAt,
    from_request_date: request.request_date,
    to_request_date: placement.requestDate,
  };

  const updates: Record<string, unknown> = {
    created_at: placement.createdAt,
    updated_at: movedAt,
    cutoff_adjustment_history: appendFundRequestCutoffAdjustmentHistory(
      request.cutoff_adjustment_history,
      adjustment
    ),
  };
  if (placement.requestDate !== request.request_date) {
    updates.request_date = placement.requestDate;
  }

  return { adjustment, updates };
}

export function buildFundRequestUndoCutoffMoveUpdates(
  request: FundRequestRow,
  actorUserId: string,
  undoneAt: string = new Date().toISOString()
): { updates: Record<string, unknown>; adjustment: FundRequestCutoffAdjustmentEntry } | null {
  if (!canUndoFundRequestCutoffMove(request, "upper_management")) {
    return null;
  }

  const adjustment = getActiveFundRequestCutoffAdjustment(request);
  if (!adjustment) return null;

  const updates: Record<string, unknown> = {
    created_at: adjustment.from_created_at,
    updated_at: undoneAt,
    cutoff_adjustment_history: markLatestFundRequestCutoffAdjustmentUndone(
      request.cutoff_adjustment_history,
      actorUserId,
      undoneAt
    ),
  };
  if (adjustment.from_request_date) {
    updates.request_date = adjustment.from_request_date;
  }

  return {
    adjustment,
    updates,
  };
}

export function getFundRequestSucceedingCutoffStartYmd(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): string | null {
  return getFundRequestFilingCutoffStartYmd(request);
}

export function formatFundRequestCutoffAdjustmentEntry(
  entry: FundRequestCutoffAdjustmentEntry,
  actorName: string,
  approverNames: Record<string, string> = {}
): string {
  const movedAt = format(new Date(entry.moved_at), "MMM d, yyyy 'at' h:mm a");
  const fromLabel = formatFundRequestCutoffStartLabel(entry.from_cutoff_start_ymd);
  const toLabel = formatFundRequestCutoffStartLabel(entry.to_cutoff_start_ymd);
  const undoneSuffix = entry.undone_at
    ? ` (undone by ${approverNames[entry.undone_by ?? ""] ?? "upper management"} on ${format(new Date(entry.undone_at), "MMM d, yyyy 'at' h:mm a")})`
    : "";
  return `Moved from ${fromLabel} to ${toLabel} by ${actorName} on ${movedAt}${undoneSuffix}`;
}
