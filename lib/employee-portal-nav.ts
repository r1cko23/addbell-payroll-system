/** Pages reached via mobile "More" menu (not in the 4 primary bottom tabs). */
export const EMPLOYEE_PORTAL_MORE_PATHS = [
  "/employee-portal/failure-to-log",
  "/employee-portal/fund-request",
  "/employee-portal/payslips",
  "/employee-portal/project-time",
  "/employee-portal/info",
] as const;

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

export function isEmployeePortalMoreNavActive(
  pathname: string | null
): boolean {
  if (!pathname) return false;
  return EMPLOYEE_PORTAL_MORE_PATHS.some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}
