/**
 * Responsive Tailwind bundles for the admin/HR dashboard.
 *
 * Viewport tiers (see lib/dashboard-viewport.ts):
 * - Mobile < 768px: hamburger nav, stacked headers, card lists
 * - Tablet 768–1023px: narrow content beside sidebar overlay trigger
 * - Laptop ≥ 1024px: fixed sidebar, multi-column grids
 */

/**
 * Page wrapper — use instead of VStack gap + space-y (they double up on mobile).
 * Tuned for phones (incl. iPhone 16 Pro Max, Pixel, Galaxy) through desktop.
 */
export const dbPageWrapper =
  "flex w-full min-w-0 flex-col gap-2.5 sm:gap-4 md:gap-5 lg:gap-6";

/** @deprecated Prefer dbPageWrapper on the page root */
export const dbPageStack = dbPageWrapper;

/** Page title + toolbar row */
export const dbPageHeaderRow =
  "flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:gap-6";

/** Header action row: full-width grid on mobile, inline on sm+ */
export const dbHeaderActions =
  "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end sm:gap-2";

/** Compact header / toolbar button */
export const dbHeaderButton =
  "min-h-10 h-10 w-full gap-1.5 px-3 text-sm font-medium sm:min-h-9 sm:h-9 sm:w-auto";

/** KPI / stat card grid — 1 col mobile, 2 tablet, 4 desktop */
export const dbKpiGrid =
  "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4";

/** Two-column section grid on laptop+ */
export const dbSectionGrid = "grid w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6";

/** Horizontal scroll fallback for wide tables */
export const dbTableShell =
  "w-full min-w-0 overflow-x-auto rounded-lg border";

/** Form / detail card — clip horizontal overflow on phones */
export const dbFormCard = "w-full min-w-0 max-w-full overflow-x-clip";

/** Filter/toolbar select — full width on mobile, fixed from sm */
export const dbFilterSelect = "w-full min-w-0 sm:w-[180px]";

/** Standard dialog — near full-width on mobile, scrollable */
export const dbDialogContent =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-2rem)] max-w-none gap-3 overflow-y-auto overscroll-contain p-4 sm:max-w-2xl sm:w-full sm:p-6";

/** Wider dialog for multi-field forms (vendors, subcontractors). */
export const dbDialogContentWide =
  "max-h-[min(90dvh,90vh)] w-[min(100vw-2rem,48rem)] max-w-3xl gap-3 overflow-y-auto overscroll-contain p-4 sm:w-full sm:p-6";

/**
 * Tall form dialog — top-anchored, capped height, fixed header/footer, scrollable body.
 * Overrides centered translate so the modal fits at 100% browser zoom.
 */
export const dbDialogTallForm =
  "!top-[max(0.75rem,1.5dvh)] left-[50%] flex max-h-[min(85dvh,calc(100vh-1.5rem))] w-[calc(100vw-2rem)] max-w-2xl -translate-x-1/2 !translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:w-full";

export const dbDialogTallFormHeader =
  "shrink-0 space-y-1.5 border-b px-6 pb-4 pt-6 pr-12 text-left";

export const dbDialogTallFormBody =
  "max-h-[calc(100dvh-12.5rem)] space-y-4 overflow-y-auto overscroll-contain px-6 py-4 pr-4";

export const dbDialogTallFormFooter =
  "shrink-0 border-t bg-background px-6 py-4";

/** Dialog footer — stacked full-width actions on mobile */
export const dbDialogFooter =
  "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2 [&>button]:w-full sm:[&>button]:w-auto";

/** Mobile list card inside dashboard sections */
export const dbMobileListCard =
  "rounded-lg border border-border/80 bg-card p-3 space-y-1";

/** Stacked full-width form/toolbar actions on mobile */
export const dbToolbarActions =
  "flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end";

/** Cutoff / week prev-next row — stays inside cards on narrow screens */
export const dbPeriodNavRow =
  "flex w-full min-w-0 max-w-full items-center justify-between gap-1 sm:gap-2";

/** Compact prev/next control for period navigation */
export const dbPeriodNavButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 sm:h-9 sm:w-auto sm:px-3";
