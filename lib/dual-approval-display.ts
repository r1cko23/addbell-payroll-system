import { format, parseISO, isValid } from "date-fns";

export type ApprovalLabelFields = {
  status: string;
  managerId?: string | null;
  managerApprovedAt?: string | null;
  hrId?: string | null;
  hrApprovedAt?: string | null;
  rejectedById?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  /** When rejected, whether to label as HR vs Manager rejection. */
  rejectedByRole?: "manager" | "hr" | null;
};

export function formatApprovalTimestamp(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  try {
    const date = parseISO(value);
    if (!isValid(date)) return null;
    return format(date, "MMM dd, yyyy h:mm a");
  } catch {
    return null;
  }
}

export function resolveApproverName(
  names: Record<string, string>,
  id: string | null | undefined,
  fallback: string
): string {
  if (!id) return fallback;
  return names[id] || fallback;
}

type OtLike = {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
  project_manager_approved_at?: string | null;
  hr_approved_by?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
};

export function otToApprovalFields(request: OtLike): ApprovalLabelFields {
  let rejectedByRole: ApprovalLabelFields["rejectedByRole"] = null;
  if (request.status === "rejected") {
    rejectedByRole = request.hr_approved_by ? "hr" : "manager";
  }

  const managerRejectedAtStage =
    request.status === "rejected" && rejectedByRole === "manager";

  const managerId = managerRejectedAtStage
    ? null
    : request.project_manager_id || request.account_manager_id || null;

  const hrId =
    request.status === "approved"
      ? request.hr_approved_by || request.approved_by || null
      : null;

  return {
    status: request.status,
    managerId,
    managerApprovedAt: managerRejectedAtStage
      ? null
      : request.project_manager_approved_at || null,
    hrId,
    hrApprovedAt: request.status === "approved" ? request.approved_at : null,
    rejectedById:
      request.status === "rejected"
        ? request.hr_approved_by || request.approved_by || null
        : null,
    rejectedAt: request.status === "rejected" ? request.approved_at : null,
    rejectedByRole,
  };
}

type FtlLike = {
  status: string;
  account_manager_id?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  updated_at?: string | null;
  rejection_reason?: string | null;
};

export function ftlToApprovalFields(request: FtlLike): ApprovalLabelFields {
  const managerIdRaw = request.account_manager_id || null;
  const hrId =
    request.status === "approved" ? request.approved_by || null : null;

  let rejectedByRole: ApprovalLabelFields["rejectedByRole"] = null;
  if (request.status === "rejected" && request.approved_by) {
    rejectedByRole =
      managerIdRaw && request.approved_by !== managerIdRaw ? "hr" : "manager";
  }

  const managerRejectedAtStage =
    request.status === "rejected" && rejectedByRole === "manager";

  return {
    status: request.status,
    managerId: managerRejectedAtStage ? null : managerIdRaw,
    managerApprovedAt:
      managerRejectedAtStage || request.status !== "pending" || !managerIdRaw
        ? null
        : request.updated_at || null,
    hrId,
    hrApprovedAt: request.status === "approved" ? request.approved_at : null,
    rejectedById:
      request.status === "rejected" ? request.approved_by || null : null,
    rejectedAt:
      request.status === "rejected"
        ? request.approved_at || request.updated_at || null
        : null,
    rejectionReason: request.rejection_reason || null,
    rejectedByRole,
  };
}

type LeaveLike = {
  status: string;
  project_manager_id?: string | null;
  account_manager_id?: string | null;
  project_manager_approved_at?: string | null;
  account_manager_approved_at?: string | null;
  hr_approver_id?: string | null;
  hr_approved_by?: string | null;
  hr_approved_at?: string | null;
  rejected_by?: string | null;
  rejected_at?: string | null;
  rejection_reason?: string | null;
};

export function leaveToApprovalFields(request: LeaveLike): ApprovalLabelFields {
  const managerId =
    request.project_manager_id || request.account_manager_id || null;
  const hasManagerEndorsement = Boolean(managerId);

  let rejectedByRole: ApprovalLabelFields["rejectedByRole"] = null;
  if (request.status === "rejected" && request.rejected_by) {
    rejectedByRole = hasManagerEndorsement ? "hr" : "manager";
  }

  return {
    status: request.status,
    managerId,
    managerApprovedAt:
      request.project_manager_approved_at ||
      request.account_manager_approved_at ||
      null,
    hrId:
      request.status !== "rejected"
        ? request.hr_approver_id || request.hr_approved_by || null
        : null,
    hrApprovedAt: request.hr_approved_at || null,
    rejectedById: request.rejected_by || null,
    rejectedAt: request.rejected_at || null,
    rejectionReason: request.rejection_reason || null,
    rejectedByRole,
  };
}
