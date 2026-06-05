"use client";

import { VStack } from "@/components/ui/stack";
import { Caption } from "@/components/ui/typography";
import {
  type ApprovalLabelFields,
  formatApprovalTimestamp,
  resolveApproverName,
} from "@/lib/dual-approval-display";

export type RequestApprovalLabelsProps = {
  fields: ApprovalLabelFields;
  names: Record<string, string>;
  className?: string;
};

/**
 * Consistent manager / HR approver and rejection labels for approval queue cards and detail modals.
 * Uses stored actor IDs — not role-masked viewer status.
 */
export function RequestApprovalLabels({
  fields,
  names,
  className,
}: RequestApprovalLabelsProps) {
  const {
    managerId,
    managerApprovedAt,
    hrId,
    hrApprovedAt,
    rejectedById,
    rejectedAt,
    rejectionReason,
    rejectedByRole,
    status,
  } = fields;

  const hasContent =
    managerId || hrId || (status === "rejected" && rejectedById);
  if (!hasContent) return null;

  const managerTimestamp = formatApprovalTimestamp(managerApprovedAt);
  const hrTimestamp = formatApprovalTimestamp(hrApprovedAt);
  const rejectedTimestamp = formatApprovalTimestamp(rejectedAt);

  return (
    <VStack
      gap="1"
      align="start"
      className={className ?? "mt-2 text-xs text-muted-foreground"}
    >
      {managerId && (
        <Caption>
          Approved by Manager:{" "}
          {resolveApproverName(names, managerId, "Manager")}
          {managerTimestamp && ` on ${managerTimestamp}`}
        </Caption>
      )}

      {status === "rejected" && rejectedById && rejectedByRole === "manager" && (
        <Caption className="text-destructive">
          Rejected by Manager:{" "}
          {resolveApproverName(names, rejectedById, "Manager")}
          {rejectedTimestamp && ` on ${rejectedTimestamp}`}
          {rejectionReason && ` - ${rejectionReason}`}
        </Caption>
      )}

      {status === "rejected" && rejectedById && rejectedByRole === "hr" && (
        <Caption className="text-destructive">
          Rejected by HR:{" "}
          {resolveApproverName(names, rejectedById, "HR")}
          {rejectedTimestamp && ` on ${rejectedTimestamp}`}
          {rejectionReason && ` - ${rejectionReason}`}
        </Caption>
      )}

      {status !== "rejected" && hrId && (
        <Caption>
          Approved by HR:{" "}
          {resolveApproverName(names, hrId, "HR")}
          {hrTimestamp && ` on ${hrTimestamp}`}
        </Caption>
      )}
    </VStack>
  );
}
