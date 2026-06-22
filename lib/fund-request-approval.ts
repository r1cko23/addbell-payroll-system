import type { FundRequestRow, FundRequestRejectionUndoSnapshot } from "@/types/fund-request";
import {
  approvalApprovedStatusBadgeClass,
  approvalRejectedStatusBadgeClass,
} from "@/lib/approval-status-badge";

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

import { normalizeUserRole } from "@/lib/user-roles";

export function getActionableFundRequestStatuses(
  role: string | null | undefined
): FundRequestRow["status"][] {
  const normalizedRole = normalizeUserRole(role);
  if (normalizedRole === "operations_manager") return ["pending"];
  if (normalizedRole === "purchasing_officer") return ["project_manager_approved"];
  if (normalizedRole === "admin" || normalizedRole === "upper_management") {
    return ["purchasing_officer_approved"];
  }
  return [];
}

export function canActOnFundRequest(
  role: string | null | undefined,
  status: string
): boolean {
  return getActionableFundRequestStatuses(role).includes(
    status as FundRequestRow["status"]
  );
}

export type FundRequestApprovalActionCopy = {
  title: string;
  description: string;
  eyebrow?: string;
  urgent?: boolean;
};

export function getFundRequestApprovalActionCopy(
  role: string | null | undefined,
  status: string | null | undefined
): FundRequestApprovalActionCopy {
  const normalizedRole = normalizeUserRole(role);

  if (
    normalizedRole === "purchasing_officer" &&
    status === "project_manager_approved"
  ) {
    return {
      eyebrow: "Purchasing Officer",
      title: "Review and approval required",
      description: "",
      urgent: true,
    };
  }

  if (normalizedRole === "operations_manager" && status === "pending") {
    return {
      title: "Operations Manager approval required",
      description:
        "This request is waiting for your approval before it can move to the Purchasing Officer.",
    };
  }

  if (
    (normalizedRole === "admin" || normalizedRole === "upper_management") &&
    status === "purchasing_officer_approved"
  ) {
    return {
      title: "Final approval required",
      description:
        "Purchasing has approved these for payment. Return any line to purchasing if needed, then approve all when your review is complete.",
    };
  }

  return {
    title: "Your approval is required",
    description: "Review the details above, then approve or reject this request.",
  };
}

export function buildFundRequestApprovalUpdates(
  currentStatus: FundRequestRow["status"],
  currentUserId: string,
  options?: { supplierBankDetails?: string | null }
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
  request: FundRequestRow
): Record<string, unknown> | null {
  const snapshot = request.rejection_undo_snapshot;

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
      updated_at: new Date().toISOString(),
    };
  }

  if (request.status !== "rejected") return null;

  return {
    status: inferFundRequestStatusBeforeRejection(request),
    rejected_by: null,
    rejected_at: null,
    rejection_reason: null,
    rejection_undo_snapshot: null,
    updated_at: new Date().toISOString(),
  };
}

export function buildFundRequestRejectUpdates(
  currentUserId: string,
  reason: string,
  request: FundRequestRow
): Record<string, unknown> {
  return {
    status: "rejected",
    rejected_by: currentUserId,
    rejected_at: new Date().toISOString(),
    rejection_reason: reason.trim(),
    rejection_undo_snapshot: buildFundRequestRejectionUndoSnapshot(request),
    updated_at: new Date().toISOString(),
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

const REQUESTER_DELETABLE_STATUSES = new Set<FundRequestRow["status"]>([
  "pending",
  "project_manager_approved",
]);

export function canRequesterDeleteFundRequest(
  status: FundRequestRow["status"] | string
): boolean {
  return REQUESTER_DELETABLE_STATUSES.has(status as FundRequestRow["status"]);
}
