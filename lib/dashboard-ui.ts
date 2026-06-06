/**
 * Responsive Tailwind bundles for the admin/HR dashboard.
 *
 * Viewport tiers (see lib/dashboard-viewport.ts):
 * - Mobile < 768px: hamburger nav, stacked headers, card lists
 * - Tablet 768–1023px: narrow content beside sidebar overlay trigger
 * - Laptop ≥ 1024px: fixed sidebar, multi-column grids
 */

/** Vertical rhythm between dashboard sections */
export const dbPageStack = "w-full space-y-4 sm:space-y-5 lg:space-y-6";

/** Page title + toolbar row */
export const dbPageHeaderRow =
  "flex w-full flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6";

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
