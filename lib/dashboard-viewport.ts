/**
 * Admin/HR dashboard viewport tiers (Tailwind breakpoints):
 *
 * | Tier    | Width      | Chrome                          |
 * |---------|------------|---------------------------------|
 * | Mobile  | < 768px    | Hamburger nav, compact padding  |
 * | Tablet  | 768–1023px | Top navbar, single col          |
 * | Laptop+ | ≥ 1024px   | Top navbar, multi-column        |
 *
 * The dashboard chrome is a top navbar. Use DbMobileView / DbDesktopView for split layouts.
 */

export const DASHBOARD_MD_BREAKPOINT_PX = 768;

export type DashboardViewportTier = "mobile" | "desktop";

export function dashboardViewportTier(
  width: number
): DashboardViewportTier {
  return width < DASHBOARD_MD_BREAKPOINT_PX ? "mobile" : "desktop";
}

/**
 * CSS `md:hidden` still mounts children. Portaled overlays (Select, Dropdown)
 * escape that hide, so the hidden tree must not mount editors/menus.
 */
export function shouldMountDashboardViewportTree(
  tree: DashboardViewportTier,
  viewport: DashboardViewportTier
): boolean {
  return tree === viewport;
}

/** Show only below md (< 768px). */
export const dbViewportMobileOnly = "flex w-full min-w-0 flex-col md:hidden";

/** Show only at md+ (≥ 768px). */
export const dbViewportDesktopOnly = "hidden w-full min-w-0 flex-col md:flex";

/** Block-level mobile-only wrapper (tables vs card stacks). */
export const dbViewportBlockMobileOnly = "block w-full min-w-0 md:hidden";

/** Block-level desktop-only wrapper. */
export const dbViewportBlockDesktopOnly = "hidden w-full min-w-0 md:block";
