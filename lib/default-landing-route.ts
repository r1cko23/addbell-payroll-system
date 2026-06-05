import {
  mergePermissions,
  type ModuleName,
  type UserPermissions,
} from "@/lib/permissions";
import { normalizeUserRole } from "@/lib/user-roles";

type LandingCandidate = {
  href: string;
  module: ModuleName;
  /** Only admin / upper_management may use this landing page */
  executiveOnly?: boolean;
};

const LANDING_CANDIDATES: LandingCandidate[] = [
  { href: "/dashboard?type=executive", module: "dashboard", executiveOnly: true },
  { href: "/dashboard?type=workforce", module: "dashboard" },
  { href: "/employees", module: "employees" },
  { href: "/projects", module: "projects" },
  { href: "/leave-approval", module: "leave_approval" },
  { href: "/overtime-approval", module: "overtime_approval" },
  { href: "/failure-to-log-approval", module: "failure_to_log" },
  { href: "/timesheet", module: "timesheet" },
  { href: "/time-entries", module: "time_entries" },
  { href: "/fund-request", module: "fund_requests" },
  { href: "/purchase-order", module: "purchase_orders" },
  { href: "/payslips", module: "payslips" },
  { href: "/loans", module: "loans" },
  { href: "/settings", module: "settings" },
];

export function resolveDefaultLandingRoute(
  role: string,
  permissions: UserPermissions
): string {
  const normalizedRole = normalizeUserRole(role) ?? role.trim().toLowerCase();

  if (normalizedRole === "approver" || normalizedRole === "viewer") {
    return "/overtime-approval";
  }

  const isExecutive =
    normalizedRole === "admin" || normalizedRole === "upper_management";

  for (const candidate of LANDING_CANDIDATES) {
    if (candidate.executiveOnly && !isExecutive) {
      continue;
    }
    if (permissions[candidate.module]?.read) {
      return candidate.href;
    }
  }

  return "/employees";
}

export function getDefaultLandingRoute(
  role: string,
  customPermissions: Partial<UserPermissions> | null | undefined
): string {
  const normalizedRole = normalizeUserRole(role) ?? role.trim().toLowerCase();
  const merged = mergePermissions(normalizedRole, customPermissions ?? null);
  return resolveDefaultLandingRoute(normalizedRole, merged);
}
