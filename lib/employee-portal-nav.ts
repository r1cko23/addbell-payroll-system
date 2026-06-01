/** Active state for employee portal nav links (Home is exact-match only). */
export function isEmployeePortalNavActive(
  pathname: string | null,
  href: string
): boolean {
  if (!pathname) return false;
  if (href === "/employee-portal") {
    return pathname === "/employee-portal";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
