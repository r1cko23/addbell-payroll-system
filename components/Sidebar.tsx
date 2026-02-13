"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, useCallback, useMemo } from "react";
import {
  ChartPieSlice,
  ChatCircleDots,
  Users,
  ClockClockwise,
  CalendarCheck,
  CalendarBlank,
  ChartLineUp,
  Gear,
  UsersThree,
  MapPin,
  Receipt,
  WarningCircle,
  CaretDown,
  CaretRight,
  X,
  ShieldCheck,
  FileText,
  ArrowsClockwise,
  ClipboardText,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions, type ModuleName } from "@/lib/hooks/usePermissions";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  permissionModule?: ModuleName; // Maps this nav item to a permission module
};

type NavGroup = {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

const HIDDEN_GROUPS = new Set(["Payroll", "Reports"]);

const navGroups: NavGroup[] = [
  {
    label: "Overview",
    icon: ChartPieSlice,
    items: [
      { name: "Executive Dashboard", href: "/dashboard?type=executive", icon: ChartLineUp, permissionModule: "dashboard" },
      { name: "Workforce Overview", href: "/dashboard?type=workforce", icon: UsersThree, permissionModule: "dashboard" },
    ],
  },
  {
    label: "Projects",
    icon: MapPin,
    items: [
      { name: "Clients", href: "/clients", icon: Users, permissionModule: "employees" },
      { name: "Projects", href: "/projects", icon: ChartLineUp, permissionModule: "dashboard" },
      { name: "Vendors", href: "/vendors", icon: Receipt, permissionModule: "dashboard" },
    ],
  },
  {
    label: "People",
    icon: UsersThree,
    items: [
      { name: "Employees", href: "/employees", icon: UsersThree, permissionModule: "employees" },
      { name: "Loans", href: "/loans", icon: Receipt, permissionModule: "loans" },
      { name: "Payslips", href: "/payslips", icon: Receipt, permissionModule: "payslips" },
    ],
  },
  {
    label: "Time & Attendance",
    icon: ClockClockwise,
    defaultOpen: true,
    items: [
      { name: "Time Attendance", href: "/timesheet", icon: CalendarBlank, permissionModule: "timesheet" },
      { name: "Time Entries", href: "/time-entries", icon: MapPin, permissionModule: "time_entries" },
      {
        name: "Failure to Log",
        href: "/failure-to-log-approval",
        icon: WarningCircle,
        permissionModule: "failure_to_log",
      },
    ],
  },
  {
    label: "Requests & Approvals",
    icon: ClipboardText,
    defaultOpen: true,
    items: [
      { name: "Leave Approvals", href: "/leave-approval", icon: CalendarCheck, permissionModule: "leave_approval" },
      {
        name: "OT Approvals",
        href: "/overtime-approval",
        icon: ClockClockwise,
        permissionModule: "overtime_approval",
      },
      {
        name: "Fund Requests",
        href: "/fund-request-approval",
        icon: Receipt,
        permissionModule: "payslips",
      },
      {
        name: "Purchase Order",
        href: "/purchase-order",
        icon: FileText,
        permissionModule: "payslips",
      },
    ],
  },
  {
    label: "Admin",
    icon: ShieldCheck,
    items: [
      { name: "Audit Dashboard", href: "/audit", icon: FileText, permissionModule: "audit" },
      { name: "BIR Reports", href: "/bir-reports", icon: FileText, permissionModule: "bir_reports" },
      { name: "Payroll Register", href: "/reports", icon: Receipt, permissionModule: "reports" },
    ],
  },
  {
    label: "Settings",
    icon: Gear,
    items: [{ name: "Settings", href: "/settings", icon: Gear, permissionModule: "settings" }],
  },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

// Memoized NavItem component to prevent unnecessary re-renders
const NavItem = memo(function NavItem({
  item,
  isActive,
  FallbackIcon,
}: {
  item: NavItem;
  isActive: boolean;
  FallbackIcon: React.ElementType;
}) {
  const Icon = item.icon || FallbackIcon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        isActive
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.name}
    </Link>
  );
});

function SidebarComponent({ className, onClose }: SidebarProps) {
  const pathname = usePathname();
  const {
    role,
    isHR,
    isAdmin,
    isApprover,
    isViewer,
    canAccessSalaryInfo,
    loading: roleLoading,
  } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [openGroup, setOpenGroup] = React.useState<string | null>("People");
  const FallbackIcon = WarningCircle;

  const toggleGroup = useCallback((label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  }, []);

  // Filter navigation items based on user permissions (ACL/RBAC)
  const filteredNavGroups = React.useMemo(() => {
    // If still loading, return all groups to prevent empty sidebar
    if (roleLoading || permissionsLoading) {
      return navGroups;
    }

    // Admin always sees everything
    if (isAdmin) {
      return navGroups;
    }

    // Filter based on permissions
    return navGroups
      .map((group) => {
        // Filter items based on read permission
        const filteredItems = group.items.filter((item) => {
          // Account managers (approvers) and viewers must not see Employees in nav.
          // HR (e.g. April Gammad) is both HR and approver for her department; she should still see Employees.
          if (item.permissionModule === "employees") {
            const hideForApproverOrViewer = (isApprover && !isHR) || isViewer;
            if (hideForApproverOrViewer) {
              return false;
            }
          }

          // If no permission module specified, use legacy role-based logic
          if (!item.permissionModule) {
            return true;
          }

          // Check if user has read permission for this module
          return canRead(item.permissionModule);
        });

        // Special case: Executive Dashboard only for admin (even if dashboard read is enabled)
        if (group.label === "Overview") {
          const nonExecutiveItems = filteredItems.filter(
            (item) => !item.href.includes("?type=executive")
          );
          return nonExecutiveItems.length > 0
            ? { ...group, items: nonExecutiveItems }
            : null;
        }

        // Return group with filtered items, or null if no items
        return filteredItems.length > 0
          ? { ...group, items: filteredItems }
          : null;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [isAdmin, isApprover, isViewer, canRead, roleLoading, permissionsLoading]);

  // Auto-open the group that matches the current route
  React.useEffect(() => {
    let matchedGroup: string | null = null;
    let longest = 0;
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        const isMatch =
          pathname === item.href || pathname?.startsWith(item.href + "/");
        if (isMatch && item.href.length > longest) {
          matchedGroup = group.label;
          longest = item.href.length;
        }
      });
    });
    if (matchedGroup) {
      setOpenGroup(matchedGroup);
    }
  }, [pathname]);

  // Prevent sidebar from disappearing - ensure it always renders
  if (!filteredNavGroups || filteredNavGroups.length === 0) {
    console.warn("Sidebar: filteredNavGroups is empty!", { roleLoading, role, filteredNavGroups });
  }

  // Always render sidebar, even if no groups
  // Force render with explicit styles to prevent disappearing
  return (
    <div
      className={cn(
        "flex h-full flex-col w-64 border-r bg-muted/10 flex-shrink-0",
        className
      )}
      style={{
        minWidth: '256px',
        width: '256px',
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column'
      }}
      data-testid="sidebar-container"
    >
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <div className="flex-1 flex items-center justify-center min-h-[64px]">
          <img
            src="/addbell-logo.jpg"
            alt="Addbell Technical Services, Inc."
            className="h-16 w-auto object-contain"
            style={{
              display: 'block',
              visibility: 'visible',
              opacity: 1,
            }}
            onLoad={() => console.log('Logo loaded successfully')}
            onError={(e) => {
              console.error('Logo failed to load:', e);
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {(roleLoading || permissionsLoading) ? (
          <div className="flex items-center justify-center h-32">
            <ArrowsClockwise className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNavGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-sm text-muted-foreground p-4">
            <WarningCircle className="h-8 w-8 mb-2" />
            <p>No navigation items available</p>
            <p className="text-xs mt-1">Role: {role || 'loading...'}</p>
          </div>
        ) : (
          filteredNavGroups
            .filter((group) => group !== null && !HIDDEN_GROUPS.has(group.label))
            .map((group) => {
            if (!group) return null;
            const GroupIcon = group.icon || FallbackIcon;
            const isOpen = openGroup === group.label;

            // Render all groups with collapsible structure
            return (
              <div key={group.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent transition"
                  aria-expanded={isOpen}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="h-4 w-4" />
                    {group.label}
                  </span>
                  {isOpen ? (
                    <CaretDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <CaretRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen && (
                  <div className="space-y-1 pl-3">
                    {group.items.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname?.startsWith(item.href + "/");

                      return (
                        <NavItem
                          key={item.name}
                          item={item}
                          isActive={isActive}
                          FallbackIcon={FallbackIcon}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center mb-2">
          © 2025 Addbell Technical Services, Inc.
          <br />
          All rights reserved
        </p>
        <div className="text-center">
          <a
            href="/privacy"
            className="text-xs text-primary hover:underline transition-colors"
          >
            Privacy Notice
          </a>
        </div>
      </div>
    </div>
  );
}

// Export Sidebar (removed memo to prevent rendering issues)
export const Sidebar = SidebarComponent;