/**
 * Admin/HR dashboard viewport tiers (Tailwind breakpoints):
 *
 * | Tier    | Width      | Chrome                          |
 * |---------|------------|---------------------------------|
 * | Mobile  | < 768px    | Hamburger nav, compact padding  |
 * | Tablet  | 768–1023px | Sidebar overlay at lg; single col |
 * | Laptop+ | ≥ 1024px   | Fixed sidebar, multi-column     |
 *
 * Sidebar is shown at lg (1024px). Use DbMobileView / DbDesktopView for split layouts.
 */

/** Show only below md (< 768px). */
export const dbViewportMobileOnly = "flex w-full min-w-0 flex-col md:hidden";

/** Show only at md+ (≥ 768px). */
export const dbViewportDesktopOnly = "hidden w-full min-w-0 flex-col md:flex";

/** Block-level mobile-only wrapper (tables vs card stacks). */
export const dbViewportBlockMobileOnly = "block w-full min-w-0 md:hidden";

/** Block-level desktop-only wrapper. */
export const dbViewportBlockDesktopOnly = "hidden w-full min-w-0 md:block";
