/**
 * Employee portal viewport tiers (Tailwind breakpoints):
 *
 * | Tier    | Width      | Chrome                          |
 * |---------|------------|---------------------------------|
 * | Mobile  | < 768px    | Bottom nav, compact header      |
 * | Tablet  | 768–1023px | Sidebar, desktop header         |
 * | Laptop+ | ≥ 1024px   | Sidebar, full padding & grids     |
 *
 * Use EpMobileView / EpDesktopView for wholly separate layouts (split at md).
 */

/** Show only below md (< 768px). Stacks page sections vertically. */
export const epViewportMobileOnly = "flex w-full flex-col md:hidden";

/** Show only at md+ (≥ 768px). Stacks page sections vertically. */
export const epViewportDesktopOnly = "hidden w-full flex-col md:flex";

/** Block-level mobile-only wrapper (cards, sections). */
export const epViewportBlockMobileOnly = "block md:hidden";

/** Block-level desktop-only wrapper (cards, sections). */
export const epViewportBlockDesktopOnly = "hidden md:block";
