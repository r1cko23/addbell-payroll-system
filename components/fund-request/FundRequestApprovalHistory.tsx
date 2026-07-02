"use client";

import { format } from "date-fns";
import {
  formatFundRequestActionHistoryEntry,
  getFundRequestActionHistory,
  getFundRequestDispositionLabel,
  isLikelyMislabeledReturnAsRejection,
} from "@/lib/fund-request-action-audit";
import {
  formatFundRequestSubmittedAtLabel,
  getFundRequestApprovalTrailFields,
  getFundRequestRequesterLabel,
  shouldShowOperationsManagerApproval,
  type FundRequestApprovalTrailInput,
} from "@/lib/fund-request-history";

type FundRequestApprovalHistoryProps = {
  request: FundRequestApprovalTrailInput;
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
  const trail = getFundRequestApprovalTrailFields(request);
  const showOperationsManagerApproval = shouldShowOperationsManagerApproval(trail, {
    requesterUserId,
    requesterIsOperationsManager,
  });
  const actionHistory = getFundRequestActionHistory(request);
  const mislabeledReturn = isLikelyMislabeledReturnAsRejection(request);
  const dispositionLabel = getFundRequestDispositionLabel(request);

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
          {requesterName} on {formatFundRequestSubmittedAtLabel(request)}
        </li>

        {showOperationsManagerApproval ? (
          <li>
            <span className="font-medium">Approved by Operations Manager:</span>{" "}
            {approverNames[trail.project_manager_approved_by ?? ""] ?? "—"} on{" "}
            {format(new Date(trail.project_manager_approved_at!), "MMM d, yyyy")}{" "}
            at {format(new Date(trail.project_manager_approved_at!), "h:mm a")}
          </li>
        ) : null}

        {trail.purchasing_officer_approved_at ? (
          <li>
            <span className="font-medium">Approved by Purchasing Officer:</span>{" "}
            {approverNames[trail.purchasing_officer_approved_by ?? ""] ?? "—"} on{" "}
            {format(
              new Date(trail.purchasing_officer_approved_at),
              "MMM d, yyyy"
            )}{" "}
            at {format(new Date(trail.purchasing_officer_approved_at), "h:mm a")}
          </li>
        ) : null}

        {trail.management_approved_at ? (
          <li>
            <span className="font-medium">Approved by Upper Management:</span>{" "}
            {approverNames[trail.management_approved_by ?? ""] ?? "—"} on{" "}
            {format(new Date(trail.management_approved_at), "MMM d, yyyy")} at{" "}
            {format(new Date(trail.management_approved_at), "h:mm a")}
          </li>
        ) : null}

        {actionHistory.length > 0 ? (
          <li>
            <span className="font-medium">Action audit trail:</span>
            <ul className="mt-1 space-y-1 pl-4">
              {actionHistory.map((entry, index) => (
                <li
                  key={`${entry.rejected_at}-${entry.action}-${index}`}
                  className={
                    entry.action === "reject" && !entry.undone_at
                      ? "text-destructive"
                      : "text-amber-900"
                  }
                >
                  {format(new Date(entry.rejected_at), "MMM d, yyyy")} at{" "}
                  {format(new Date(entry.rejected_at), "h:mm a")} —{" "}
                  {formatFundRequestActionHistoryEntry(entry, approverNames)}
                </li>
              ))}
            </ul>
          </li>
        ) : request.rejected_at ? (
          <li className={mislabeledReturn ? "text-amber-900" : "text-destructive"}>
            <span className="font-medium">
              {mislabeledReturn ? "Recorded as rejected (likely a return):" : "Rejected by:"}
            </span>{" "}
            {approverNames[request.rejected_by ?? ""] ?? "—"} on{" "}
            {format(new Date(request.rejected_at), "MMM d, yyyy")} at{" "}
            {format(new Date(request.rejected_at), "h:mm a")}
            {request.rejection_reason ? ` — ${request.rejection_reason}` : ""}
          </li>
        ) : request.returned_at ? (
          <li className="text-amber-900">
            <span className="font-medium">Returned by:</span>{" "}
            {approverNames[request.returned_by ?? ""] ?? "—"} on{" "}
            {format(new Date(request.returned_at), "MMM d, yyyy")} at{" "}
            {format(new Date(request.returned_at), "h:mm a")}
            {request.return_reason ? ` — ${request.return_reason}` : ""}
          </li>
        ) : null}

        {mislabeledReturn && dispositionLabel ? (
          <li className="rounded-md border border-amber-300/60 bg-amber-50 px-2 py-1 text-xs text-amber-950">
            {dispositionLabel}. The reason text suggests this was a return to
            purchasing during a system fix, not a final rejection.
          </li>
        ) : null}
      </ul>
    </div>
  );
}
