/**
 * Shared layout and status styling for employee portal request history cards.
 * Mobile-first: stacked layout and full-width status on small screens; side-by-side from sm+.
 */

/** Outer list section (My OT / Leave / FTL requests) */
export const epRequestHistorySectionContent = "w-full p-4 sm:p-6";

/** Gap between history cards */
export const epRequestHistoryList = "space-y-3 sm:space-y-4";

export const epRequestHistoryCardContent =
  "w-full overflow-x-hidden p-4 sm:p-6";

/** Mobile: stack content then status; sm+: OT-style two columns */
export const epRequestHistoryCardLayout =
  "mb-2 flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4";

/** Full width on mobile; shares row with status from sm+ */
export const epRequestHistoryCardMain =
  "w-full min-w-0 sm:flex-1 sm:basis-0 sm:pr-4";

/** Mobile: full-width status stack; sm+: right column */
export const epRequestHistoryStatusColumn =
  "flex w-full shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:max-w-[220px] sm:items-end";

export const epRequestHistoryHeaderRow =
  "mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-2 sm:gap-x-3";

export const epRequestHistoryTitle =
  "min-w-0 break-words text-base font-bold leading-snug sm:text-lg";

export const epRequestHistoryMetric =
  "shrink-0 text-base font-bold text-primary sm:text-lg";

export const epRequestHistoryCategoryBadge =
  "max-w-full shrink-0 whitespace-normal border-primary/30 bg-primary/5 text-center font-sans normal-case tracking-normal text-primary";

/** Time / reason rows */
export const epRequestHistoryBodyRow = "mb-2 text-sm leading-relaxed";

export const epRequestHistoryReasonText =
  "mt-1 break-words text-muted-foreground";

export const epRequestHistorySubtitle =
  "mb-2 break-words text-xs font-medium text-muted-foreground sm:text-sm";

/** Supporting document block */
export const epRequestHistorySupportingDocs = "mt-2 w-full min-w-0";

/** ~44px touch target on mobile; compact from sm+ */
export const epRequestStatusBadgeClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 py-2 text-center text-xs font-medium sm:min-h-9 sm:w-auto sm:py-1";

export const epRequestStatusStyles = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-emerald-600 text-white border-emerald-600",
  rejected: "bg-rose-100 text-rose-900 border-rose-200",
} as const;

export const epRequestStatusBadgePending = `${epRequestStatusBadgeClass} ${epRequestStatusStyles.pending}`;

export const epRequestStatusBadgeApproved = `${epRequestStatusBadgeClass} ${epRequestStatusStyles.approved}`;

export const epRequestStatusBadgeRejected = `${epRequestStatusBadgeClass} ${epRequestStatusStyles.rejected}`;

export const epRequestStatusBadgeCancelled = `${epRequestStatusBadgeClass} border-slate-200 bg-slate-100 text-slate-800`;

export const epRequestStatusBadgeOpsManager = `${epRequestStatusBadgeClass} leading-tight ${epRequestStatusStyles.approved}`;

/** @deprecated Use epRequestHistoryStatusColumn */
export const epRequestStatusColumn = epRequestHistoryStatusColumn;

export const epRequestApprovalBoxEmerald =
  "w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left text-xs leading-relaxed text-emerald-900 sm:max-w-[220px] sm:py-2 sm:text-right";

export const epRequestApprovalBoxEmeraldHr =
  "w-full rounded-md border bg-emerald-50 px-3 py-2.5 text-left text-xs leading-relaxed text-emerald-900 sm:max-w-[220px] sm:py-2 sm:text-right";

export const epRequestFiledLine =
  "mt-3 break-words text-xs text-muted-foreground sm:mt-2";

/** Tap-friendly filename link in supporting-doc list */
export const epRequestHistoryDocLink =
  "inline-flex min-h-11 max-w-full items-center py-2 text-left text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50 sm:min-h-0 sm:py-0";

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
