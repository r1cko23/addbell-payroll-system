import type { FundRequestRow } from "@/types/fund-request";
import {
  approvalApprovedStatusBadgeClass,
  approvalPendingStatusBadgeClass,
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
      title: "Upper Management approval required",
      description:
        "Operations and Purchasing have reviewed this request. Your final approval is required to release the funds.",
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

export function getFundRequestStatusBadgeClass(
  status: FundRequestRow["status"] | string
): string {
  if (status === "management_approved") {
    return approvalApprovedStatusBadgeClass;
  }
  if (status === "rejected") {
    return approvalRejectedStatusBadgeClass;
  }
  return approvalPendingStatusBadgeClass;
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
