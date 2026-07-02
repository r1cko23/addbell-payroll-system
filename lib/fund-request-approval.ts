import type { FundRequestRow, FundRequestRejectionUndoSnapshot } from "@/types/fund-request";
import {
  approvalApprovedStatusBadgeClass,
  approvalRejectedStatusBadgeClass,
} from "@/lib/approval-status-badge";
import { fundRequestInOperationsManagerQueue } from "@/lib/fund-request-routing";
import {
  appendFundRequestRejectionHistory,
  markLatestFundRequestRejectionUndone,
} from "@/lib/fund-request-rejection-history";
import { normalizeUserRole } from "@/lib/user-roles";

/**
 * Fund request approval workflow:
 * 1. Requester → Operations Manager: approve → Purchasing Officer; reject (optional reason) → final for requester.
 * 2. Purchasing Officer: approve → Upper Management; reject (optional reason) → final for requester.
 * 3. Upper Management: approve → recorded in history; reject (optional reason) → recorded in history, final for requester;
 *    return to purchasing → back to PO for review (not final, not in history).
 * Rejected requests cannot be edited or resubmitted; requesters must file a new request.
 */
export const FUND_REQUEST_NEXT_STATUS: Partial<
  Record<FundRequestRow["status"], FundRequestRow["status"]>
> = {
  pending: "project_manager_approved",
  project_manager_approved: "purchasing_officer_approved",
  purchasing_officer_approved: "management_approved",
};

const APPROVER_ROLES = new Set([
  "admin",
  "upper_management",
  "operations_manager",
  "purchasing_officer",
]);

export function isFundRequestApproverRole(role: string | null | undefined): boolean {
  if (!role) return false;
  return APPROVER_ROLES.has(role);
}

export function getActionableFundRequestStatuses(
  role: string | null | undefined
): FundRequestRow["status"][] {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === "operations_manager") return ["pending"];
  if (normalizedRole === "purchasing_officer") return ["project_manager_approved"];
  if (normalizedRole === "admin") {
    return ["pending", "project_manager_approved", "purchasing_officer_approved"];
  }
  if (normalizedRole === "upper_management") {
    return ["purchasing_officer_approved"];
  }
  return [];
}

export function canActOnFundRequest(
  role: string | null | undefined,
  status: string,
  options?: {
    request?: Pick<FundRequestRow, "requested_by">;
    managedRequesterIds?: ReadonlySet<string> | string[];
  }
): boolean {
  if (
    !getActionableFundRequestStatuses(role).includes(
      status as FundRequestRow["status"]
    )
  ) {
    return false;
  }

  if (
    normalizeUserRole(role) === "operations_manager" &&
    options?.request &&
    options?.managedRequesterIds
  ) {
    return fundRequestInOperationsManagerQueue(
      {
        status: status as FundRequestRow["status"],
        requested_by: options.request.requested_by,
      },
      options.managedRequesterIds
    );
  }

  return true;
}

export type FundRequestApprovalActionCopy = {
  title: string;
  description: string;
  eyebrow?: string;
  urgent?: boolean;
};

export function getFundRequestApprovalActionCopy(
  role: string | null | undefined,
  status: string | null | undefined,
  request?: Pick<
    FundRequestRow,
    | "status"
    | "rejected_at"
    | "rejection_undo_snapshot"
    | "purchasing_officer_approved_at"
    | "rejection_reason"
  >
): FundRequestApprovalActionCopy {
  const normalizedRole = normalizeUserRole(role);

  if (
    normalizedRole === "purchasing_officer" &&
    status === "project_manager_approved" &&
    request &&
    isFundRequestReturnedToPurchasing(request as FundRequestRow)
  ) {
    const reason = request.rejection_reason?.trim();
    return {
      eyebrow: "Purchasing Officer",
      title: "Returned for purchasing officer review",
      description: reason
        ? `Upper management returned this request for your review again. Note: ${reason}`
        : "Upper management returned this request to the purchasing officer for review again.",
      urgent: true,
    };
  }

  if (
    normalizedRole === "purchasing_officer" &&
    status === "project_manager_approved"
  ) {
    return {
      eyebrow: "Purchasing Officer",
      title: "Review and approval required",
      description:
        "Approve to send this request to Upper Management, or reject to decline it. A rejection reason is required; rejections are final and the requester must file again.",
      urgent: true,
    };
  }

  if (normalizedRole === "operations_manager" && status === "pending") {
    return {
      title: "Operations Manager approval required",
      description:
        "Approve to send this request to the Purchasing Officer, or reject to decline it. A rejection reason is required; rejections are final and the requester must file again.",
    };
  }

  if (
    (normalizedRole === "admin" || normalizedRole === "upper_management") &&
    status === "purchasing_officer_approved"
  ) {
    return {
      title: "Final approve required",
      description:
        "Purchasing has approved these for payment. Return to purchasing requires a reason; reject is optional. Approve to record in history.",
      urgent: true,
    };
  }

  return {
    title: "Your approval is required",
    description:
      "Review the details above, then approve or reject. A rejection reason is required unless you are at final upper management review.",
  };
}

export function buildFundRequestApprovalUpdates(
  currentStatus: FundRequestRow["status"],
  currentUserId: string,
  options?: {
    supplierBankDetails?: string | null;
    subcontractorPoAmount?: number | null;
  }
): Record<string, unknown> | null {
  const nextStatus = FUND_REQUEST_NEXT_STATUS[currentStatus];
  if (!nextStatus) return null;

  const updates: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  if (currentStatus === "pending") {
    updates.project_manager_approved_by = currentUserId;
    updates.project_manager_approved_at = new Date().toISOString();
  } else if (currentStatus === "project_manager_approved") {
    updates.purchasing_officer_approved_by = currentUserId;
    updates.purchasing_officer_approved_at = new Date().toISOString();
    updates.supplier_bank_details = options?.supplierBankDetails?.trim() || null;
    if (options?.subcontractorPoAmount !== undefined) {
      updates.subcontractor_po_amount = options.subcontractorPoAmount;
    }
  } else if (currentStatus === "purchasing_officer_approved") {
    updates.management_approved_by = currentUserId;
    updates.management_approved_at = new Date().toISOString();
  }

  return updates;
}

export function canReturnFundRequestToPurchasing(
  role: string | null | undefined,
  status: string
): boolean {
  if (status !== "purchasing_officer_approved") return false;
  const normalizedRole = normalizeUserRole(role);
  return normalizedRole === "upper_management" || normalizedRole === "admin";
}

export type FundRequestRequesterAccessFields = Pick<
  FundRequestRow,
  "status" | "rejected_at" | "rejection_undo_snapshot" | "purchasing_officer_approved_at"
>;

export function isFundRequestRejected(
  request: FundRequestRequesterAccessFields
): boolean {
  return request.status === "rejected";
}

export function getFundRequestRequesterStatus(
  request: FundRequestRequesterAccessFields
): FundRequestRow["status"] {
  if (isFundRequestRejected(request)) return "rejected";
  return request.status;
}

export type FundRequestDisposalAction = "return" | "reject";

/** OM and PO rejections require a reason; UM reject is optional; UM return requires a reason. */
export function isFundRequestDisposalReasonRequired(
  status: FundRequestRow["status"],
  action: FundRequestDisposalAction
): boolean {
  if (action === "return") {
    return status === "purchasing_officer_approved";
  }
  if (status === "pending" || status === "project_manager_approved") {
    return true;
  }
  return false;
}

export function validateFundRequestDisposalReason(
  status: FundRequestRow["status"],
  action: FundRequestDisposalAction,
  reason: string
): { ok: true } | { ok: false; message: string } {
  if (!isFundRequestDisposalReasonRequired(status, action)) {
    return { ok: true };
  }
  if (!reason.trim()) {
    return {
      ok: false,
      message:
        action === "return"
          ? "Please enter a reason for returning to purchasing."
          : "Please enter a rejection reason.",
    };
  }
  return { ok: true };
}

export function getFundRequestDisposalReasonLabel(
  status: FundRequestRow["status"],
  action: FundRequestDisposalAction
): string {
  const required = isFundRequestDisposalReasonRequired(status, action);
  if (action === "return") {
    return required
      ? "Reason for returning to purchasing"
      : "Reason for returning to purchasing (optional)";
  }
  return required ? "Rejection reason" : "Rejection reason (optional)";
}

export function getFundRequestDisposalReasonPlaceholder(
  status: FundRequestRow["status"],
  action: FundRequestDisposalAction
): string {
  if (action === "return") {
    return isFundRequestDisposalReasonRequired(status, action)
      ? "What needs to be corrected?"
      : "What needs to be corrected? (optional)";
  }
  return isFundRequestDisposalReasonRequired(status, action)
    ? "Reason"
    : "Reason (optional)";
}

export function buildFundRequestUpperManagementReturnUpdates(
  currentUserId: string,
  reason: string,
  undoSnapshot: FundRequestRejectionUndoSnapshot
): Record<string, unknown> {
  return {
    status: "project_manager_approved",
    purchasing_officer_approved_by: null,
    purchasing_officer_approved_at: null,
    supplier_bank_details: null,
    rejection_reason: reason.trim() || null,
    rejected_by: currentUserId,
    rejected_at: new Date().toISOString(),
    rejection_undo_snapshot: undoSnapshot,
    updated_at: new Date().toISOString(),
  };
}

export function buildFundRequestRejectionUndoSnapshot(
  request: FundRequestRow
): FundRequestRejectionUndoSnapshot {
  return {
    status: request.status,
    purchasing_officer_approved_by: request.purchasing_officer_approved_by,
    purchasing_officer_approved_at: request.purchasing_officer_approved_at,
    supplier_bank_details: request.supplier_bank_details,
    management_approved_by: request.management_approved_by,
    management_approved_at: request.management_approved_at,
  };
}

export function isFundRequestReturnedToPurchasing(request: FundRequestRow): boolean {
  return (
    request.status === "project_manager_approved" &&
    Boolean(request.rejected_at) &&
    Boolean(request.rejection_undo_snapshot) &&
    !request.purchasing_officer_approved_at
  );
}

export function isFundRequestRejectionUndoable(request: FundRequestRow): boolean {
  if (request.status === "rejected") return true;
  if (isFundRequestReturnedToPurchasing(request)) {
    return Boolean(request.rejection_undo_snapshot);
  }
  return false;
}

export function canUndoFundRequestRejection(
  role: string | null | undefined,
  userId: string | null | undefined,
  request: FundRequestRow
): boolean {
  if (!userId || !isFundRequestRejectionUndoable(request)) return false;

  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === "admin") return true;
  if (request.rejected_by === userId) return true;

  if (
    isFundRequestReturnedToPurchasing(request) &&
    (normalizedRole === "upper_management" || normalizedRole === "admin")
  ) {
    return true;
  }

  return false;
}

export function getFundRequestUndoRejectionLabel(request: FundRequestRow): string {
  return isFundRequestReturnedToPurchasing(request)
    ? "Undo return to purchasing"
    : "Undo rejection";
}

export function canUndoFundRequestManagementApproval(
  role: string | null | undefined,
  userId: string | null | undefined,
  request: FundRequestRow
): boolean {
  if (!userId || request.status !== "management_approved") return false;
  if (!request.management_approved_at || !request.purchasing_officer_approved_at) {
    return false;
  }

  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === "admin" || normalizedRole === "upper_management") {
    return true;
  }

  return request.management_approved_by === userId;
}

export function buildFundRequestUndoManagementApprovalUpdates(
  request: FundRequestRow
): Record<string, unknown> | null {
  if (request.status !== "management_approved") return null;
  if (!request.purchasing_officer_approved_at) return null;

  return {
    status: "purchasing_officer_approved",
    management_approved_by: null,
    management_approved_at: null,
    updated_at: new Date().toISOString(),
  };
}

function inferFundRequestStatusBeforeRejection(
  request: FundRequestRow
): FundRequestRow["status"] {
  if (request.purchasing_officer_approved_at) return "purchasing_officer_approved";
  if (request.project_manager_approved_at) return "project_manager_approved";
  return "pending";
}

export function buildFundRequestUndoRejectionUpdates(
  request: FundRequestRow,
  undoneBy?: string | null
): Record<string, unknown> | null {
  const snapshot = request.rejection_undo_snapshot;
  const undoneAt = new Date().toISOString();
  const rejectionHistory = undoneBy
    ? markLatestFundRequestRejectionUndone(request.rejection_history, undoneBy, undoneAt)
    : request.rejection_history;

  if (snapshot) {
    return {
      status: snapshot.status,
      purchasing_officer_approved_by: snapshot.purchasing_officer_approved_by,
      purchasing_officer_approved_at: snapshot.purchasing_officer_approved_at,
      supplier_bank_details: snapshot.supplier_bank_details,
      management_approved_by: snapshot.management_approved_by,
      management_approved_at: snapshot.management_approved_at,
      rejected_by: null,
      rejected_at: null,
      rejection_reason: null,
      rejection_undo_snapshot: null,
      rejection_history: rejectionHistory,
      updated_at: undoneAt,
    };
  }

  if (request.status !== "rejected") return null;

  return {
    status: inferFundRequestStatusBeforeRejection(request),
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    rejection_undo_snapshot: null,
    rejection_history: rejectionHistory,
    updated_at: undoneAt,
  };
}

export function buildFundRequestRejectUpdates(
  currentUserId: string,
  reason: string,
  request: FundRequestRow
): Record<string, unknown> {
  const rejectedAt = new Date().toISOString();
  return {
    status: "rejected",
    rejected_by: currentUserId,
    rejected_at: rejectedAt,
    rejection_reason: reason.trim() || null,
    rejection_undo_snapshot: buildFundRequestRejectionUndoSnapshot(request),
    rejection_history: appendFundRequestRejectionHistory(request.rejection_history, {
      rejected_by: currentUserId,
      rejected_at: rejectedAt,
      rejection_reason: reason.trim() || null,
    }),
    updated_at: rejectedAt,
  };
}

export function getFundRequestStatusBadgeClass(
  status: FundRequestRow["status"] | string
): string {
  if (status === "management_approved") {
    return approvalApprovedStatusBadgeClass;
  }
  if (status === "rejected") {
    return approvalRejectedStatusBadgeClass;
  }
  // Amber styling comes from Badge variant="pending".
  return "";
}

export function getFundRequestStatusBadgeVariant(
  status: FundRequestRow["status"] | string
): "pending" | "default" | "destructive" | "outline" {
  if (status === "management_approved") return "default";
  if (status === "rejected") return "destructive";
  return "pending";
}

const REQUESTER_MANAGEABLE_STATUSES = new Set<FundRequestRow["status"]>([
  "pending",
  "project_manager_approved",
  "purchasing_officer_approved",
]);

export function canRequesterDeleteFundRequest(
  request:
    | FundRequestRequesterAccessFields
    | FundRequestRow["status"]
    | string
): boolean {
  if (typeof request === "object" && request !== null) {
    if (isFundRequestRejected(request)) return false;
    if (isFundRequestReturnedToPurchasing(request as FundRequestRow)) return false;
    return REQUESTER_MANAGEABLE_STATUSES.has(request.status);
  }
  if (request === "rejected") return false;
  return REQUESTER_MANAGEABLE_STATUSES.has(request as FundRequestRow["status"]);
}

/** Edit fields, delete, and add documents before the next approver acts. */
export function canRequesterEditFundRequest(
  request:
    | FundRequestRequesterAccessFields
    | FundRequestRow["status"]
    | string
): boolean {
  if (typeof request === "object" && request !== null) {
    if (isFundRequestRejected(request)) return false;
    if (isFundRequestReturnedToPurchasing(request as FundRequestRow)) return false;
    return REQUESTER_MANAGEABLE_STATUSES.has(request.status);
  }
  if (request === "rejected") return false;
  return REQUESTER_MANAGEABLE_STATUSES.has(request as FundRequestRow["status"]);
}
