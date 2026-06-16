/** Shared status badge colors for approval queues (OT, leave, fund request, FTL). */

export const approvalPendingStatusBadgeClass =
  "!border-amber-200 !bg-amber-50 !text-amber-700";

export const approvalApprovedStatusBadgeClass =
  "bg-emerald-600 text-white border-emerald-600";

export const approvalRejectedStatusBadgeClass =
  "bg-red-50 text-red-700 border-red-200";

export const approvalCancelledStatusBadgeClass =
  "bg-slate-100 text-slate-700 border-slate-200";

export function getApprovalPendingStatusBadgeClass(): string {
  return approvalPendingStatusBadgeClass;
}

export function getApprovalApprovedStatusBadgeClass(): string {
  return approvalApprovedStatusBadgeClass;
}

export function getApprovalRejectedStatusBadgeClass(): string {
  return approvalRejectedStatusBadgeClass;
}
