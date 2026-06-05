/**
 * Shared layout and status styling for employee portal request history cards.
 * Original OT card layout from md+; compact stacked layout below md (mobile).
 */

/** Outer list section (My OT / Leave / FTL requests) */
export const epRequestHistorySectionContent = "w-full p-4 sm:p-6 max-md:p-3";

/** Gap between history cards */
export const epRequestHistoryList = "space-y-3 sm:space-y-4 max-md:space-y-2.5";

export const epRequestHistoryCardContent =
  "w-full overflow-x-hidden p-4 sm:p-6";

/** Mobile: stack content then status; md+: original two-column OT layout */
export const epRequestHistoryCardLayout =
  "mb-2 flex w-full flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4";

/** Full width on mobile; shares row with status from md+ */
export const epRequestHistoryCardMain =
  "w-full min-w-0 md:flex-1 md:basis-0 md:pr-4";

/** Mobile: full-width status stack; md+: right column */
export const epRequestHistoryStatusColumn =
  "flex w-full shrink-0 flex-col items-stretch gap-2 md:w-auto md:max-w-[220px] md:items-end";

export const epRequestHistoryHeaderRow =
  "mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-2 md:items-center md:gap-x-8";

/** Category badge + day/hour count — grouped with space from the date title on md+. */
export const epRequestHistoryHeaderBadgeGroup =
  "inline-flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 md:gap-x-5";

export const epRequestHistoryTitle =
  "min-w-0 break-words text-sm font-bold leading-snug md:text-lg";

export const epRequestHistoryMetric =
  "shrink-0 text-sm font-bold text-primary md:text-lg";

export const epRequestHistoryCategoryBadge =
  "max-w-full shrink-0 whitespace-normal border-primary/30 bg-primary/5 px-2.5 text-center font-sans normal-case tracking-normal text-primary max-md:py-0.5 max-md:text-xs max-md:font-medium md:px-3";

/** —— Mobile-only stacked card helpers —— */
export const epRequestHistoryCardLayoutMobile = "flex w-full flex-col gap-3";

export const epRequestHistoryTitleRow =
  "flex w-full items-start justify-between gap-2";

export const epRequestHistoryTitleMobile =
  "min-w-0 flex-1 break-words text-sm font-bold leading-snug";

export const epRequestHistoryMetricMobile =
  "shrink-0 text-sm font-bold text-primary";

export const epRequestHistoryTagsRow =
  "flex w-full flex-wrap items-center gap-2";

export const epRequestHistoryCategoryBadgeMobile =
  "max-w-full shrink-0 whitespace-normal border-primary/30 bg-primary/5 px-2 py-0.5 text-xs font-medium normal-case tracking-normal text-primary";

export const epRequestHistoryStatusBlock =
  "flex w-full flex-col gap-2";

export const epRequestHistoryDetailsSection =
  "flex w-full min-w-0 flex-col gap-3 border-t border-border/50 pt-3";

export const epRequestHistorySubtitle =
  "mb-2 break-words text-xs font-medium text-muted-foreground md:text-sm";

/** —— Desktop aliases (same as responsive constants above) —— */
export const epRequestHistoryDesktopRow = epRequestHistoryCardLayout;
export const epRequestHistoryCardMainDesktop = epRequestHistoryCardMain;
export const epRequestHistoryHeaderRowDesktop = epRequestHistoryHeaderRow;
export const epRequestHistoryTitleDesktop = epRequestHistoryTitle;
export const epRequestHistoryMetricDesktop = epRequestHistoryMetric;
export const epRequestHistoryCategoryBadgeDesktop = epRequestHistoryCategoryBadge;
export const epRequestHistorySubtitleDesktop = epRequestHistorySubtitle;
export const epRequestHistoryStatusColumnDesktop = epRequestHistoryStatusColumn;

/** Time / reason rows */
export const epRequestHistoryBodyRow = "mb-2 text-sm leading-relaxed max-md:text-xs max-md:mb-0";

export const epRequestHistoryReasonText =
  "mt-1 break-words text-muted-foreground max-md:mt-1.5 max-md:text-xs";

/** OT bundy clock reference panel */
export const epRequestClockReferenceBox =
  "mt-3 space-y-1 rounded-md border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground max-md:mt-0 max-md:space-y-2";

export const epRequestClockReferenceLine =
  "break-words [&_strong]:font-medium [&_strong]:text-foreground";

/** Supporting document block */
export const epRequestHistorySupportingDocs = "mt-2 w-full min-w-0";

/** ~44px touch target on mobile; compact from md+ */
export const epRequestStatusBadgeClass =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 py-2 text-center text-xs font-medium md:min-h-9 md:w-auto md:py-1";

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
  "w-full rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-left text-xs leading-relaxed text-emerald-900 md:max-w-[220px] md:py-2 md:text-right";

export const epRequestApprovalBoxEmeraldHr =
  "w-full rounded-md border bg-emerald-50 px-3 py-2.5 text-left text-xs leading-relaxed text-emerald-900 md:max-w-[220px] md:py-2 md:text-right";

export const epRequestFiledLine =
  "mt-3 break-words text-xs text-muted-foreground md:mt-2 max-md:mt-2.5 max-md:border-t max-md:border-border/60 max-md:pt-2.5";

/** @deprecated Use epRequestFiledLine */
export const epRequestFiledLineDesktop = epRequestFiledLine;
export const epRequestFiledLineMobile = epRequestFiledLine;

/** Tap-friendly filename link in supporting-doc list */
export const epRequestHistoryDocLink =
  "inline-flex min-h-11 max-w-full items-center py-2 text-left text-muted-foreground underline-offset-2 hover:underline disabled:opacity-50 md:min-h-0 md:py-0";

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
