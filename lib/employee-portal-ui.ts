/**
 * Responsive Tailwind bundles for the employee portal.
 *
 * Viewport tiers (see lib/employee-portal-viewport.ts):
 * - Mobile < 768px: single-column forms, bottom nav, compact header
 * - Tablet 768–1023px: sidebar, single-column forms (narrow content area)
 * - Laptop ≥ 1024px: sidebar, two-column forms, full padding
 *
 * Separate mobile vs desktop markup: EpMobileView / EpDesktopView (split at md).
 */

/** ~44px touch target on mobile; compact width/height from sm upward */
export const epTouchButton =
  "min-h-11 h-11 w-full gap-1.5 px-3 text-sm font-medium sm:min-h-9 sm:h-9 sm:w-auto";

/** Full-width primary submit on OT / leave / failure-to-log forms */
export const epSubmitRequestButton =
  "min-h-11 h-11 w-full gap-1.5 px-3 text-sm font-medium";

/** Header action row: equal two-column grid on mobile, inline on md+ */
export const epHeaderActions =
  "grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0 md:gap-2";

/** Compact header / toolbar button (matches form primary actions). */
export const epHeaderButton =
  "h-9 shrink-0 gap-1.5 px-2 text-sm font-medium sm:px-3";

/** Standard dialog: near full-width on mobile, scrollable */
export const epDialogContent =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-2rem)] max-w-none gap-3 overflow-y-auto overscroll-contain rounded-xl p-4 sm:max-w-md sm:w-full sm:gap-4 sm:p-6";

/** Password / compact forms — room for the dialog close control on narrow screens */
export const epDialogContentForm =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-2rem)] max-w-none gap-3 overflow-y-auto overscroll-contain rounded-xl p-4 sm:max-w-sm sm:w-full sm:gap-4 sm:p-6";

/** Wide dialog (e.g. payslip preview) */
export const epDialogContentWide =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-lg p-4 sm:max-w-4xl sm:w-full sm:p-6";

/** Vertical rhythm between page sections */
export const epPageStack = "w-full space-y-3 md:space-y-4 lg:space-y-6";

/** Home / quick-link cards — dense rows on mobile, roomier from sm */
export const epQuickLinkCard =
  "border-border/80 bg-card";

export const epQuickLinkCardContent =
  "flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4";

export const epQuickLinkIcon =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-10 sm:w-10";

/** Card list item — avoid hover motion on touch; enable from md */
export const epCardInteractive =
  "transition-colors duration-150 motion-safe:md:hover:border-primary/25 motion-safe:md:hover:bg-muted/30";

/** Stacked full-width form actions on mobile */
export const epFormActions =
  "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3";

export const epFormActionButton = "min-h-11 w-full sm:min-h-9 sm:w-auto";

/** Page title + toolbar row */
export const epPageHeaderRow =
  "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";

/** Inline label + control (e.g. month filter) */
export const epInlineField =
  "flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-2 sm:w-auto";

/** Single column on phone/tablet; two columns on laptop+ (room beside sidebar) */
export const epFormGrid = "grid w-full grid-cols-1 gap-4 lg:grid-cols-2";

/** Single labeled field block */
export const epFormField = "w-full min-w-0 space-y-2";

/** Vertical rhythm inside forms */
export const epFormStack = "flex w-full flex-col gap-4 sm:gap-6";

/** File input — ~44px touch target on mobile */
export const epFileInput =
  "flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:mr-3 file:border-0 file:bg-transparent file:py-2.5 file:text-sm file:font-medium";

/** Centered modal panel (confirm/cancel) */
export const epModalPanel =
  "mx-4 w-[calc(100vw-2rem)] max-w-sm rounded-lg bg-background p-4 shadow-lg sm:mx-auto sm:p-6";

/** Icon-only nav control — square touch target on mobile */
export const epTouchIconButton =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center p-0 sm:h-9 sm:w-auto sm:px-3";

/** Cutoff / period prev-next row — stays inside cards on narrow screens */
export const epPeriodNavRow =
  "mb-6 flex w-full min-w-0 max-w-full items-center justify-between gap-1 sm:gap-2";

/** Compact prev/next control for period navigation (not full 44px squares) */
export const epPeriodNavButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 sm:h-9 sm:w-auto sm:px-3";

/** Category labels on request cards (leave type, subtype, OT) — plain muted text */
export const epRequestCategoryText =
  "text-xs font-normal text-muted-foreground";

/** Filed / created — pill container, same typography as category labels (SIL, Others) */
export const epRequestFiledPill =
  "inline-flex w-fit items-center rounded-md border border-border bg-muted px-3 py-1 text-xs font-normal text-muted-foreground";
