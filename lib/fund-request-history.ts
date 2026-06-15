import type { FundRequestRow } from "@/types/fund-request";

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
