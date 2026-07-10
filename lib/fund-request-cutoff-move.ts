import { addDays, format, parse } from "date-fns";
import type { FundRequestCutoffAdjustmentEntry, FundRequestRow } from "@/types/fund-request";
import {
  appendFundRequestCutoffAdjustmentHistory,
  getActiveFundRequestCutoffAdjustment,
  markLatestFundRequestCutoffAdjustmentUndone,
} from "@/lib/fund-request-cutoff-adjustment-history";
import {
  formatFundRequestCutoffPeriod,
  getFundRequestCalendarCutoffStartYmd,
  getFundRequestCutoffPeriodEnd,
  getFundRequestCutoffStartYmd,
  getFundRequestFiledDateYmd,
  isFundRequestInSucceedingCutoff,
} from "@/lib/fund-request-cutoff";
import { normalizeUserRole } from "@/lib/user-roles";

const CUTOFF_SAFE_FILING_UTC_OFFSET = "+00:00";
const CUTOFF_SAFE_FILING_UTC_HOUR = 1;
const CUTOFF_SAFE_FILING_UTC_MINUTE = 0;

function parseYmd(ymd: string): Date | null {
  const parsed = parse(ymd, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Timestamp on the filing Thursday (or request date) before the 10:00 AM Manila deadline. */
export function buildFundRequestCreatedAtForCalendarCutoff(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): string | null {
  const calendarCutoffStartYmd = getFundRequestCalendarCutoffStartYmd(request);
  if (!calendarCutoffStartYmd) return null;

  const calendarStart = parseYmd(calendarCutoffStartYmd);
  if (!calendarStart) return null;

  const cutoffEndYmd = format(getFundRequestCutoffPeriodEnd(calendarStart), "yyyy-MM-dd");
  const requestDateYmd = getFundRequestFiledDateYmd(request);
  const filingYmd =
    requestDateYmd &&
    requestDateYmd >= calendarCutoffStartYmd &&
    requestDateYmd <= cutoffEndYmd
      ? requestDateYmd
      : cutoffEndYmd;

  const hour = String(CUTOFF_SAFE_FILING_UTC_HOUR).padStart(2, "0");
  const minute = String(CUTOFF_SAFE_FILING_UTC_MINUTE).padStart(2, "0");
  return `${filingYmd}T${hour}:${minute}:00.000${CUTOFF_SAFE_FILING_UTC_OFFSET}`;
}

export function getFundRequestProcessingCutoffStartYmd(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): string | null {
  return getFundRequestCalendarCutoffStartYmd(request);
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
  role: string | null | undefined
): boolean {
  if (normalizeUserRole(role) !== "upper_management") return false;
  if (!isFundRequestCutoffMoveEligibleStatus(request.status)) return false;
  if (!isFundRequestInSucceedingCutoff(request)) return false;
  return true;
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
  movedAt: string = new Date().toISOString()
): { updates: Record<string, unknown>; adjustment: FundRequestCutoffAdjustmentEntry } | null {
  if (!canMoveFundRequestToCurrentCutoff(request, "upper_management")) {
    return null;
  }

  const fromCutoffStartYmd = getFundRequestCutoffStartYmd(request);
  const toCutoffStartYmd = getFundRequestProcessingCutoffStartYmd(request);
  const toCreatedAt = buildFundRequestCreatedAtForCalendarCutoff(request);

  if (!fromCutoffStartYmd || !toCutoffStartYmd || !toCreatedAt) {
    return null;
  }

  const adjustment: FundRequestCutoffAdjustmentEntry = {
    moved_by: actorUserId,
    moved_at: movedAt,
    from_cutoff_start_ymd: fromCutoffStartYmd,
    to_cutoff_start_ymd: toCutoffStartYmd,
    from_created_at: request.created_at,
    to_created_at: toCreatedAt,
  };

  return {
    adjustment,
    updates: {
      created_at: toCreatedAt,
      updated_at: movedAt,
      cutoff_adjustment_history: appendFundRequestCutoffAdjustmentHistory(
        request.cutoff_adjustment_history,
        adjustment
      ),
    },
  };
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

  return {
    adjustment,
    updates: {
      created_at: adjustment.from_created_at,
      updated_at: undoneAt,
      cutoff_adjustment_history: markLatestFundRequestCutoffAdjustmentUndone(
        request.cutoff_adjustment_history,
        actorUserId,
        undoneAt
      ),
    },
  };
}

export function getFundRequestSucceedingCutoffStartYmd(
  request: Pick<FundRequestRow, "request_date" | "created_at">
): string | null {
  const calendarCutoffStartYmd = getFundRequestCalendarCutoffStartYmd(request);
  if (!calendarCutoffStartYmd) return null;
  const calendarStart = parseYmd(calendarCutoffStartYmd);
  if (!calendarStart) return null;
  return format(addDays(calendarStart, 7), "yyyy-MM-dd");
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
