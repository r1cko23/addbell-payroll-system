"use client";

import { format } from "date-fns";
import {
  fundRequestSubmissionHasTime,
  getFundRequestRequesterLabel,
  getFundRequestSubmittedAt,
  shouldShowOperationsManagerApproval,
  type FundRequestHistoryInput,
} from "@/lib/fund-request-history";

type FundRequestApprovalHistoryProps = {
  request: FundRequestHistoryInput;
  requesterName: string;
  requesterUserId?: string | null;
  requesterIsOperationsManager?: boolean;
  approverNames: Record<string, string>;
  className?: string;
};

export function FundRequestApprovalHistory({
  request,
  requesterName,
  requesterUserId,
  requesterIsOperationsManager = false,
  approverNames,
  className,
}: FundRequestApprovalHistoryProps) {
  const submittedAt = getFundRequestSubmittedAt(request);
  const showSubmittedTime = fundRequestSubmissionHasTime(request);
  const showOperationsManagerApproval = shouldShowOperationsManagerApproval(request, {
    requesterUserId,
    requesterIsOperationsManager,
  });

  return (
    <div className={className ?? "rounded-lg border bg-muted/20 p-4"}>
      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Approval history
      </h4>
      <ul className="space-y-2 text-sm">
        <li>
          <span className="font-medium">
            {getFundRequestRequesterLabel(requesterIsOperationsManager)}
          </span>{" "}
          {requesterName} on {format(new Date(submittedAt), "MMM d, yyyy")}
          {showSubmittedTime ? (
            <> at {format(new Date(submittedAt), "h:mm a")}</>
          ) : null}
        </li>

        {showOperationsManagerApproval ? (
          <li>
            <span className="font-medium">Approved by Operations Manager:</span>{" "}
            {approverNames[request.project_manager_approved_by ?? ""] ?? "—"} on{" "}
            {format(new Date(request.project_manager_approved_at!), "MMM d, yyyy")}{" "}
            at {format(new Date(request.project_manager_approved_at!), "h:mm a")}
          </li>
        ) : null}

        {request.purchasing_officer_approved_at ? (
          <li>
            <span className="font-medium">Approved by Purchasing Officer:</span>{" "}
            {approverNames[request.purchasing_officer_approved_by ?? ""] ?? "—"} on{" "}
            {format(
              new Date(request.purchasing_officer_approved_at),
              "MMM d, yyyy"
            )}{" "}
            at {format(new Date(request.purchasing_officer_approved_at), "h:mm a")}
          </li>
        ) : null}

        {request.management_approved_at ? (
          <li>
            <span className="font-medium">Approved by Upper Management:</span>{" "}
            {approverNames[request.management_approved_by ?? ""] ?? "—"} on{" "}
            {format(new Date(request.management_approved_at), "MMM d, yyyy")} at{" "}
            {format(new Date(request.management_approved_at), "h:mm a")}
          </li>
        ) : null}

        {request.rejected_at ? (
          <li className="text-destructive">
            <span className="font-medium">Rejected by:</span>{" "}
            {approverNames[request.rejected_by ?? ""] ?? "—"} on{" "}
            {format(new Date(request.rejected_at), "MMM d, yyyy")} at{" "}
            {format(new Date(request.rejected_at), "h:mm a")}
            {request.rejection_reason ? ` — ${request.rejection_reason}` : ""}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
