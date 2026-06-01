/**
 * Mobile-first Tailwind class bundles for the employee portal.
 * Default (unprefixed) styles target small screens; sm/md+ refine for larger viewports.
 */

/** ~44px touch target on mobile; compact width/height from sm upward */
export const epTouchButton =
  "min-h-11 h-11 w-full gap-1.5 px-3 text-sm font-medium sm:min-h-9 sm:h-9 sm:w-auto";

/** Header action row: equal two-column grid on mobile, inline on md+ */
export const epHeaderActions =
  "grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0 md:gap-2";

/** Compact header / toolbar button (matches form primary actions). */
export const epHeaderButton =
  "h-9 shrink-0 gap-1.5 px-2 text-sm font-medium sm:px-3";

/** Standard dialog: near full-width on mobile, scrollable */
export const epDialogContent =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-1.5rem)] max-w-[calc(100vw-1.5rem)] overflow-y-auto overscroll-contain rounded-lg p-4 sm:max-w-md sm:w-full sm:p-6";

/** Wide dialog (e.g. payslip preview) */
export const epDialogContentWide =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-lg p-4 sm:max-w-4xl sm:w-full sm:p-6";

/** Vertical rhythm between page sections */
export const epPageStack = "w-full space-y-3 sm:space-y-4";

/** Card list item — avoid hover motion on touch; enable from md */
export const epCardInteractive =
  "transition-shadow duration-200 motion-safe:md:hover:-translate-y-0.5 motion-safe:md:hover:shadow-hover";

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
