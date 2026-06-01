/**
 * Shared layout and status styling for employee portal request history cards.
 * Matches the live OT request history card format (spacing, placement, typography).
 */

/** Outer list section (My OT / Leave / FTL requests) */
export const epRequestHistorySectionContent = "w-full p-4 sm:p-6";

/** Gap between history cards */
export const epRequestHistoryList = "space-y-4";

export const epRequestHistoryCardContent = "w-full p-4 sm:p-6";

export const epRequestHistoryCardLayout =
  "mb-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between";

/** basis-0 + min-w-0 prevents the status column from crushing this to ~0 width */
export const epRequestHistoryCardMain =
  "min-w-0 flex-1 basis-0 sm:pr-4";

export const epRequestHistoryStatusColumn =
  "flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:max-w-[220px] sm:items-end";

export const epRequestHistoryHeaderRow =
  "mb-2 flex flex-wrap items-center gap-3";

export const epRequestHistoryTitle = "text-lg font-bold";

export const epRequestHistoryMetric = "text-lg font-bold text-primary";

export const epRequestHistoryCategoryBadge =
  "shrink-0 border-primary/30 bg-primary/5 font-sans normal-case tracking-normal text-primary";

/** Time / reason rows */
export const epRequestHistoryBodyRow = "mb-2 text-sm";

export const epRequestHistoryReasonText = "mt-1 text-muted-foreground";

/** Supporting document block */
export const epRequestHistorySupportingDocs = "mt-2";

export const epRequestStatusBadgeClass =
  "flex w-full items-center justify-center gap-2 text-center lg:w-auto";

export const epRequestStatusStyles = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-600 text-white border-emerald-600",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
} as const;

export const epRequestStatusBadgePending = `${epRequestStatusBadgeClass} ${epRequestStatusStyles.pending}`;

export const epRequestStatusBadgeApproved = `${epRequestStatusBadgeClass} ${epRequestStatusStyles.approved}`;

export const epRequestStatusBadgeRejected = `${epRequestStatusBadgeClass} ${epRequestStatusStyles.rejected}`;

export const epRequestStatusBadgeCancelled = `${epRequestStatusBadgeClass} border-slate-200 bg-slate-100 text-slate-800`;

export const epRequestStatusBadgeOpsManager =
  "flex w-full items-center justify-center gap-2 text-center bg-emerald-600 text-white border-emerald-600 lg:w-auto";

/** @deprecated Use epRequestHistoryStatusColumn */
export const epRequestStatusColumn = epRequestHistoryStatusColumn;

export const epRequestApprovalBoxEmerald =
  "w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900 lg:max-w-[220px] lg:text-right";

export const epRequestApprovalBoxEmeraldHr =
  "w-full rounded-md border bg-emerald-50 px-3 py-2 text-left text-xs text-emerald-900 lg:max-w-[220px] lg:text-right";

export const epRequestFiledLine = "mt-2 text-xs text-muted-foreground";

export function requestHistoryCardBorderClass(status: string): string {
  switch (status) {
    case "pending":
      return "border-yellow-300";
    case "approved":
    case "approved_by_hr":
    case "approved_by_manager":
      return "border-emerald-300";
    case "rejected":
      return "border-destructive";
    default:
      return "border-border";
  }
}

export function ftlEntryTypeLabel(
  entryType: "in" | "out" | "both"
): string {
  if (entryType === "both") return "Time in & out";
  if (entryType === "in") return "Time in";
  return "Time out";
}
