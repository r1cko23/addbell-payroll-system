import type {
  FundRequestRejectionUndoSnapshot,
  FundRequestRow,
} from "@/types/fund-request";
import { parseTimestampInManila } from "@/utils/business-hours";

const MANILA_TZ = "Asia/Manila";

export type FundRequestHistoryInput = Pick<
  FundRequestRow,
  | "request_date"
  | "created_at"
  | "project_manager_approved_by"
  | "project_manager_approved_at"
  | "purchasing_officer_approved_by"
  | "purchasing_officer_approved_at"
  | "management_approved_by"
  | "management_approved_at"
  | "rejected_by"
  | "rejected_at"
  | "rejection_reason"
>;

export type FundRequestApprovalTrailInput = FundRequestHistoryInput & {
  rejection_undo_snapshot?: FundRequestRejectionUndoSnapshot | null;
};

/** Merge live approval fields with rejection snapshot so rejected requests still show prior steps. */
export function getFundRequestApprovalTrailFields(
  request: FundRequestApprovalTrailInput
): FundRequestHistoryInput {
  const snap = request.rejection_undo_snapshot;
  if (!snap) return request;

  const useSnapshotPo =
    !request.purchasing_officer_approved_at &&
    Boolean(snap.purchasing_officer_approved_at);
  const useSnapshotMgmt =
    !request.management_approved_at && Boolean(snap.management_approved_at);

  if (!useSnapshotPo && !useSnapshotMgmt) return request;

  return {
    ...request,
    purchasing_officer_approved_by: useSnapshotPo
      ? snap.purchasing_officer_approved_by
      : request.purchasing_officer_approved_by,
    purchasing_officer_approved_at: useSnapshotPo
      ? snap.purchasing_officer_approved_at
      : request.purchasing_officer_approved_at,
    management_approved_by: useSnapshotMgmt
      ? snap.management_approved_by
      : request.management_approved_by,
    management_approved_at: useSnapshotMgmt
      ? snap.management_approved_at
      : request.management_approved_at,
  };
}

export function getFundRequestApprovalTrailApproverIds(
  request: FundRequestApprovalTrailInput
): string[] {
  const trail = getFundRequestApprovalTrailFields(request);
  return [
    trail.project_manager_approved_by,
    trail.purchasing_officer_approved_by,
    trail.management_approved_by,
    request.rejected_by,
  ].filter(Boolean) as string[];
}

export function isOperationsManagerSelfSubmission(
  projectManagerApprovedBy: string | null | undefined,
  requesterUserId: string | null | undefined
): boolean {
  return Boolean(
    projectManagerApprovedBy &&
      requesterUserId &&
      projectManagerApprovedBy === requesterUserId
  );
}

export function shouldShowOperationsManagerApproval(
  request: FundRequestHistoryInput,
  options?: {
    requesterUserId?: string | null;
    requesterIsOperationsManager?: boolean;
  }
): boolean {
  if (options?.requesterIsOperationsManager) {
    return false;
  }

  if (!request.project_manager_approved_at || !request.project_manager_approved_by) {
    return false;
  }

  return !isOperationsManagerSelfSubmission(
    request.project_manager_approved_by,
    options?.requesterUserId
  );
}

export function getFundRequestRequesterLabel(
  requesterIsOperationsManager: boolean
): string {
  return requesterIsOperationsManager
    ? "Requested by Operations Manager:"
    : "Requested by:";
}

export function getFundRequestSubmittedAt(request: FundRequestHistoryInput): string {
  return request.created_at || request.request_date;
}

export function fundRequestSubmissionHasTime(
  request: FundRequestHistoryInput
): boolean {
  return Boolean(request.created_at);
}

function toManilaInstant(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseTimestampInManila(`${trimmed}T12:00:00`);
  }
  return parseTimestampInManila(trimmed);
}

export function formatFundRequestSubmittedDate(
  request: FundRequestHistoryInput
): string {
  const date = toManilaInstant(getFundRequestSubmittedAt(request));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatFundRequestSubmittedTime(
  request: FundRequestHistoryInput
): string | null {
  if (!fundRequestSubmissionHasTime(request)) return null;
  const date = toManilaInstant(getFundRequestSubmittedAt(request));
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}

/** e.g. "June 15, 2026 at 9:14 PM" (Manila) when filed timestamp exists. */
export function formatFundRequestSubmittedAtLabel(
  request: FundRequestHistoryInput
): string {
  const dateLabel = formatFundRequestSubmittedDate(request);
  const timeLabel = formatFundRequestSubmittedTime(request);
  return timeLabel ? `${dateLabel} at ${timeLabel}` : dateLabel;
}

/** Compact filing label for tables and inbox rows. */
export function formatFundRequestFiledAtCompact(
  request: FundRequestHistoryInput
): string {
  const date = toManilaInstant(getFundRequestSubmittedAt(request));
  if (fundRequestSubmissionHasTime(request)) {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: MANILA_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
