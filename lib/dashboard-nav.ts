import { isFundRequestApproverRole } from "@/lib/fund-request-approval";
import { isNavItemActive } from "@/lib/nav-match";
import type { ModuleName } from "@/lib/permissions";

export type DashboardNavItem = {
  name: string;
  href: string;
  permissionModule?: ModuleName;
  approverOnly?: boolean;
  adminOnly?: boolean;
};

export type DashboardNavGroup = {
  label: string;
  items: DashboardNavItem[];
};

export type DashboardNavFilterContext = {
  role: string | null;
  isHR: boolean;
  isManagement: boolean;
  isOperationsManager: boolean;
  isApprover: boolean;
  isViewer: boolean;
  isAdmin: boolean;
  canRead: (module: ModuleName) => boolean;
};

const HIDDEN_GROUPS = new Set(["Payroll", "Reports"]);

export const DASHBOARD_NAV_GROUPS: readonly DashboardNavGroup[] = [
  {
    label: "Overview",
    items: [
      {
        name: "Executive Dashboard",
        href: "/dashboard?type=executive",
        permissionModule: "dashboard",
      },
      {
        name: "Workforce Overview",
        href: "/dashboard?type=workforce",
        permissionModule: "dashboard",
      },
    ],
  },
  {
    label: "Projects",
    items: [
      { name: "Clients", href: "/clients", permissionModule: "clients" },
      { name: "Projects", href: "/projects", permissionModule: "projects" },
      { name: "Vendors", href: "/vendors", permissionModule: "vendors" },
      {
        name: "Subcontractors",
        href: "/subcontractors",
        permissionModule: "vendors",
      },
    ],
  },
  {
    label: "People",
    items: [
      { name: "Employees", href: "/employees", permissionModule: "employees" },
      { name: "Payroll", href: "/payroll", permissionModule: "payslips" },
      { name: "Loans", href: "/loans", permissionModule: "loans" },
      { name: "Payslips", href: "/payslips", permissionModule: "payslips" },
    ],
  },
  {
    label: "Time & Attendance",
    items: [
      {
        name: "Time Attendance",
        href: "/timesheet",
        permissionModule: "timesheet",
      },
      {
        name: "Time Entries",
        href: "/time-entries",
        permissionModule: "time_entries",
      },
      {
        name: "Failure To Log",
        href: "/failure-to-log-approval",
        permissionModule: "failure_to_log",
      },
    ],
  },
  {
    label: "Requests & Approvals",
    items: [
      {
        name: "Leave Approvals",
        href: "/leave-approval",
        permissionModule: "leave_approval",
      },
      {
        name: "OT Approvals",
        href: "/overtime-approval",
        permissionModule: "overtime_approval",
      },
      {
        name: "Fund Requests",
        href: "/fund-request",
        permissionModule: "fund_requests",
      },
      {
        name: "Purchase Order",
        href: "/purchase-order",
        permissionModule: "purchase_orders",
      },
    ],
  },
  {
    label: "Settings",
    items: [
      { name: "Settings", href: "/settings", permissionModule: "settings" },
      {
        name: "Storage Monitor",
        href: "/admin/storage-monitor",
        adminOnly: true,
      },
    ],
  },
];

export function dashboardNavItemTestId(name: string): string {
  return `nav-item-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function dashboardNavGroupTestId(label: string): string {
  return `nav-group-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function filterDashboardNavGroups(
  groups: readonly DashboardNavGroup[],
  ctx: DashboardNavFilterContext
): DashboardNavGroup[] {
  if (ctx.isManagement) {
    return groups
      .filter((group) => !HIDDEN_GROUPS.has(group.label))
      .map((group) => ({ ...group, items: [...group.items] }));
  }

  return groups
    .map((group) => {
      if (ctx.isHR && group.label === "Projects") return null;
      if (ctx.isOperationsManager && group.label === "People") return null;

      const filteredItems = group.items.filter((item) => {
        if (item.adminOnly && !ctx.isAdmin) return false;
        if (item.approverOnly && !isFundRequestApproverRole(ctx.role)) {
          return false;
        }
        if (item.permissionModule === "employees") {
          const hideForApproverOrViewer =
            (ctx.isApprover && !ctx.isHR) || ctx.isViewer;
          if (hideForApproverOrViewer) return false;
        }
        if (!item.permissionModule) return true;
        return ctx.canRead(item.permissionModule);
      });

      if (group.label === "Overview") {
        const nonExecutiveItems = filteredItems.filter(
          (item) => !item.href.includes("?type=executive")
        );
        return nonExecutiveItems.length > 0
          ? { ...group, items: nonExecutiveItems }
          : null;
      }

      return filteredItems.length > 0
        ? { ...group, items: filteredItems }
        : null;
    })
    .filter((group): group is DashboardNavGroup => group !== null)
    .filter((group) => !HIDDEN_GROUPS.has(group.label));
}

export function findActiveDashboardNavGroup(
  pathname: string,
  searchString: string,
  groups: readonly DashboardNavGroup[]
): string | null {
  let matchedGroup: string | null = null;
  let longest = 0;
  for (const group of groups) {
    for (const item of group.items) {
      if (
        isNavItemActive(pathname, searchString, item.href) &&
        item.href.length > longest
      ) {
        matchedGroup = group.label;
        longest = item.href.length;
      }
    }
  }
  return matchedGroup;
}
