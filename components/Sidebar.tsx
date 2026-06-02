"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import React, { memo, Suspense, useCallback } from "react";
import {
  ChartPieSlice,
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
  FileText,
  ArrowsClockwise,
  ClipboardText,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav-match";
import { formatRoleName } from "@/lib/formatRoleName";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions, type ModuleName } from "@/lib/hooks/usePermissions";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
  permissionModule?: ModuleName;
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
      {
        name: "Executive Dashboard",
        href: "/dashboard?type=executive",
        icon: ChartLineUp,
        permissionModule: "dashboard",
      },
      {
        name: "Workforce Overview",
        href: "/dashboard?type=workforce",
        icon: UsersThree,
        permissionModule: "dashboard",
      },
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
      { name: "Payroll", href: "/payroll", icon: Receipt, permissionModule: "payslips" },
      { name: "Loans", href: "/loans", icon: Receipt, permissionModule: "loans" },
      { name: "Payslips", href: "/payslips", icon: Receipt, permissionModule: "payslips" },
      {
        name: "Payroll Register",
        href: "/reports",
        icon: FileText,
        permissionModule: "reports",
      },
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
        name: "Failure To Log",
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
        href: "/fund-request",
        icon: Receipt,
        permissionModule: "fund_requests",
      },
      {
        name: "Purchase Order",
        href: "/purchase-order",
        icon: FileText,
        permissionModule: "purchase_orders",
      },
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

const NavItem = memo(function NavItem({
  item,
  isActive,
  FallbackIcon,
  testId,
}: {
  item: NavItem;
  isActive: boolean;
  FallbackIcon: React.ElementType;
  testId?: string;
}) {
  const Icon = item.icon || FallbackIcon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3 text-sm transition-colors",
        isActive
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-transparent text-muted-foreground hover:bg-primary/10 hover:text-primary"
      )}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" />
      {item.name}
    </Link>
  );
});

function SidebarInner({ className, onClose }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const {
    role,
    isHR,
    isAdmin,
    isApprover,
    isViewer,
    loading: roleLoading,
  } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [openGroup, setOpenGroup] = React.useState<string | null>("People");
  const FallbackIcon = WarningCircle;
  const navItemTestId = (name: string) =>
    `nav-item-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  const toggleGroup = useCallback((label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  }, []);

  const filteredNavGroups = React.useMemo(() => {
    if (roleLoading || permissionsLoading) {
      return navGroups;
    }

    if (isAdmin) {
      return navGroups;
    }

    return navGroups
      .map((group) => {
        if (isHR && group.label === "Projects") return null;

        const filteredItems = group.items.filter((item) => {
          if (item.permissionModule === "employees") {
            const hideForApproverOrViewer = (isApprover && !isHR) || isViewer;
            if (hideForApproverOrViewer) {
              return false;
            }
          }

          if (!item.permissionModule) {
            return true;
          }

          return canRead(item.permissionModule);
        });

        if (group.label === "Overview") {
          const nonExecutiveItems = filteredItems.filter(
            (item) => !item.href.includes("?type=executive")
          );
          return nonExecutiveItems.length > 0
            ? { ...group, items: nonExecutiveItems }
            : null;
        }

        return filteredItems.length > 0 ? { ...group, items: filteredItems } : null;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [isAdmin, isApprover, isViewer, isHR, canRead, roleLoading, permissionsLoading]);

  React.useEffect(() => {
    let matchedGroup: string | null = null;
    let longest = 0;
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        const isMatch = isNavItemActive(pathname, searchKey, item.href);
        if (isMatch && item.href.length > longest) {
          matchedGroup = group.label;
          longest = item.href.length;
        }
      });
    });
    if (matchedGroup) {
      setOpenGroup(matchedGroup);
    }
  }, [pathname, searchKey]);

  return (
    <div
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border/80 bg-card/40 backdrop-blur-sm",
        className
      )}
      style={{
        minWidth: "256px",
        width: "256px",
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
      }}
      data-testid="sidebar-container"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/80 bg-background px-4">
        <div className="flex flex-1 items-center justify-center">
          <img
            src="/add-bell-logo-new.png"
            alt="Add-bell Technical Services, Inc."
            className="h-10 w-auto max-w-full object-contain"
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav
        className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Sidebar navigation"
      >
        {roleLoading || permissionsLoading ? (
          <div className="flex h-32 items-center justify-center">
            <ArrowsClockwise className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : filteredNavGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-center text-sm text-muted-foreground">
            <WarningCircle className="mb-2 h-8 w-8" />
            <p className="font-medium text-foreground">No navigation items available</p>
            <p className="mt-2 text-xs leading-relaxed">
              Your account may have no module access in Settings → Access Control, or
              permissions failed to load.
            </p>
            <Badge variant="outline" className="mt-3 text-xs font-normal">
              {role ? formatRoleName(role) : "Role: not loaded"}
            </Badge>
          </div>
        ) : (
          filteredNavGroups
            .filter((group) => group !== null && !HIDDEN_GROUPS.has(group.label))
            .map((group) => {
              const GroupIcon = group.icon || FallbackIcon;
              const isOpen = openGroup === group.label;

              return (
                <div key={group.label} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.label)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm font-medium text-foreground transition hover:bg-primary/10"
                    aria-expanded={isOpen}
                    data-testid={`nav-group-${group.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                  >
                    <span className="flex items-center gap-2">
                      <GroupIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </span>
                    </span>
                    {isOpen ? (
                      <CaretDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <CaretRight className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="space-y-0.5 border-l border-border/60 pl-2">
                      {group.items.map((item) => {
                        const isActive = isNavItemActive(
                          pathname,
                          searchKey,
                          item.href
                        );

                        return (
                          <NavItem
                            key={item.name}
                            item={item}
                            isActive={isActive}
                            FallbackIcon={FallbackIcon}
                            testId={navItemTestId(item.name)}
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
    </div>
  );
}

function SidebarFallback({ className }: SidebarProps) {
  return (
    <div
      className={cn(
        "flex h-full w-64 shrink-0 flex-col border-r border-border/80 bg-card/40",
        className
      )}
      style={{
        minWidth: "256px",
        width: "256px",
      }}
      aria-hidden
    >
      <div className="h-16 shrink-0 border-b border-border/80 bg-background" />
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<SidebarFallback {...props} />}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
