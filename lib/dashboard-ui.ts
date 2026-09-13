/**
 * Responsive Tailwind bundles for the admin/HR dashboard.
 *
 * Viewport tiers (see lib/dashboard-viewport.ts):
 * - Mobile < 768px: hamburger nav, stacked headers, card lists
 * - Tablet 768–1023px: top navbar, single-column sections
 * - Laptop ≥ 1024px: top navbar, multi-column grids
 */

/** Top bar — same navy as the retired left sidebar. */
export const dbAppBar =
  "app-shell-header app-topbar sticky top-0 z-30 flex items-center border-b border-sidebar-border bg-sidebar px-3 sm:px-6 xl:px-8";

/**
 * Press feedback only — hover stays color. 160ms ease-out, scale 0.97.
 * Reduced motion keeps color, drops transform.
 */
export const dbIosPressClass =
  "transition-[transform,background-color,color,border-color] duration-press ease-out-ui active:scale-[0.97] motion-reduce:transition-colors motion-reduce:duration-150 motion-reduce:active:scale-100";

/** Capsule chrome used by dashboard toolbar buttons. */
export const dbIosButtonClass = `rounded-full font-semibold tracking-tight ${dbIosPressClass}`;

/** Ghost/button hover on navy — do not use muted (white) hover or a light focus ring. */
export const dbAppBarNavInteraction = `min-h-11 h-11 sm:min-h-11 sm:h-11 rounded-full px-3 hover:bg-sidebar-active hover:text-sidebar-foreground data-[state=open]:bg-sidebar-active data-[state=open]:text-sidebar-foreground focus-visible:bg-sidebar-active focus-visible:text-sidebar-foreground focus-visible:ring-0 focus-visible:ring-offset-0 ${dbIosPressClass}`;

export const dbAppBarNavIdle = `text-sidebar-muted ${dbAppBarNavInteraction}`;

export const dbAppBarNavActive = `bg-sidebar-active text-sidebar-foreground ${dbAppBarNavInteraction}`;

export const dbAppBarGhostButton = `text-sidebar-foreground ${dbAppBarNavInteraction}`;

export const dbAppBarOutlineButton = `border-sidebar-foreground/35 bg-sidebar-foreground/10 text-sidebar-foreground ${dbAppBarNavInteraction}`;

/** Light circle on navy — primary fill would disappear into the bar. */
export const dbAppBarAvatarFallback =
  "bg-background text-xs font-medium text-primary";

/**
 * Page wrapper — use instead of VStack gap + space-y (they double up on mobile).
 * Tuned for phones (incl. iPhone 16 Pro Max, Pixel, Galaxy) through desktop.
 */
export const dbPageWrapper =
  "flex w-full min-w-0 flex-col gap-2.5 sm:gap-4 md:gap-5 lg:gap-6";

/** Full-width page chrome — no 7xl cap so tables can use the row after the sidebar was removed. */
export const dbContentShell =
  "dashboard-content mx-auto w-full min-w-0 max-w-none px-3 py-2.5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] sm:px-6 sm:py-6 xl:px-8";

/** @deprecated Prefer dbPageWrapper on the page root */
export const dbPageStack = dbPageWrapper;

/** Page title + toolbar row */
export const dbPageHeaderRow =
  "flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:gap-6";

/** Header action row: full-width grid on mobile, inline on sm+ */
export const dbHeaderActions =
  "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end sm:gap-2";

/** Compact header / toolbar button — iOS 44pt on mobile, capsule press. */
export const dbHeaderButton = `min-h-11 h-11 sm:min-h-11 sm:h-11 w-full gap-1.5 px-4 text-sm sm:w-auto ${dbIosButtonClass}`;

/** KPI / stat card grid — 1 col mobile, 2 tablet, 4 desktop */
export const dbKpiGrid =
  "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4";

/** Two-column section grid on laptop+ */
export const dbSectionGrid = "grid w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6";

/** Horizontal scroll fallback for wide tables */
export const dbTableShell =
  "w-full min-w-0 overflow-x-auto rounded-lg border";

/**
 * Wide masterlist / entity edit dialog — viewport-centered, fixed header/footer, scrollable body.
 */
export const dbDialogWideForm =
  "!flex max-h-[min(90dvh,calc(100vh-2rem))] !w-auto !max-w-none flex-col gap-0 overflow-hidden p-0";

export const dbDialogWideFormStyle = {
  top: "50%",
  left: "50%",
  right: "auto",
  bottom: "auto",
  width: "min(100vw - 2rem, 64rem)",
  maxWidth: "none",
  maxHeight: "min(90dvh, calc(100vh - 2rem))",
  transform: "translate(-50%, -50%)",
} as const;

export const dbDialogWideFormHeader =
  "shrink-0 space-y-1.5 border-b px-6 pb-4 pt-6 pr-14 text-left sm:px-8 sm:pb-5 sm:pt-7";

export const dbDialogWideFormBody =
  "min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5 sm:px-8 sm:py-6";

export const dbDialogWideFormFooter =
  "shrink-0 border-t bg-background px-6 py-4 sm:px-8 sm:py-5";

/** Status / payment pills in tables — never truncate label text */
export const dbStatusBadge = "shrink-0 whitespace-nowrap rounded-full px-2.5";

/** Table cell that hosts status pills */
export const dbStatusBadgeCell = "min-w-0 overflow-visible py-1.5 align-middle";

/** Form / detail card — clip horizontal overflow on phones */
export const dbFormCard = "w-full min-w-0 max-w-full overflow-x-clip";

/** Filter/toolbar select — full width on mobile, fixed from sm */
export const dbFilterSelect = `w-full min-w-0 sm:w-[180px] h-11 min-h-11 sm:h-11 sm:min-h-11 rounded-full px-4 ${dbIosPressClass}`;

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
export const dbPeriodNavButton = `inline-flex h-11 w-11 min-h-11 shrink-0 items-center justify-center rounded-full p-0 sm:w-auto sm:px-3 ${dbIosPressClass}`;
