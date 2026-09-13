"use client";

import Link from "next/link";
import React, { memo, Suspense, useCallback, useEffect, useState } from "react";
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
  Wrench,
  FileText,
  ArrowsClockwise,
  ClipboardText,
  HardDrives,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { isNavItemActive } from "@/lib/nav-match";
import { formatRoleName } from "@/lib/formatRoleName";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useDashboardNavGroups } from "@/lib/hooks/useDashboardNavGroups";
import {
  dashboardNavGroupTestId,
  dashboardNavItemTestId,
  type DashboardNavItem,
} from "@/lib/dashboard-nav";
import { usePathname, useSearchParams } from "next/navigation";

const GROUP_ICONS: Record<string, React.ElementType> = {
  Overview: ChartPieSlice,
  Projects: MapPin,
  People: UsersThree,
  "Time & Attendance": ClockClockwise,
  "Requests & Approvals": ClipboardText,
  Settings: Gear,
};

const ITEM_ICONS: Record<string, React.ElementType> = {
  "/dashboard?type=executive": ChartLineUp,
  "/dashboard?type=workforce": UsersThree,
  "/clients": Users,
  "/projects": ChartLineUp,
  "/vendors": Receipt,
  "/subcontractors": Wrench,
  "/employees": UsersThree,
  "/payroll": Receipt,
  "/loans": Receipt,
  "/payslips": Receipt,
  "/timesheet": CalendarBlank,
  "/time-entries": MapPin,
  "/failure-to-log-approval": WarningCircle,
  "/leave-approval": CalendarCheck,
  "/overtime-approval": ClockClockwise,
  "/fund-request": Receipt,
  "/purchase-order": FileText,
  "/settings": Gear,
  "/admin/storage-monitor": HardDrives,
};

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

const NavItem = memo(function NavItem({
  item,
  isActive,
  onNavigate,
}: {
  item: DashboardNavItem;
  isActive: boolean;
  onNavigate?: () => void;
}) {
  const Icon = ITEM_ICONS[item.href] || WarningCircle;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-r-sm border-l-2 py-2 pl-3 pr-3 text-sm transition-colors",
        isActive
          ? "app-sidebar-nav-active border-l-[hsl(var(--sidebar-accent))] font-medium"
          : "app-sidebar-nav-idle border-transparent"
      )}
      data-testid={dashboardNavItemTestId(item.name)}
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
  const { role } = useUserRole();
  const { groups, activeGroup, loading } = useDashboardNavGroups();
  const [openGroup, setOpenGroup] = useState<string | null>(
    "Requests & Approvals"
  );

  const toggleGroup = useCallback((label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  }, []);

  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup);
  }, [activeGroup]);

  return (
    <div
      className={cn("app-sidebar flex h-full w-64 shrink-0 flex-col", className)}
      data-testid="sidebar-container"
    >
      <div className="app-shell-header sidebar-brand-header flex items-center justify-between border-b px-3">
        <div className="sidebar-logo-plate flex-1">
          <img
            src="/add-bell-logo-sidebar.png?v=2"
            alt="Add-bell Technical Services, Inc."
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-md p-2 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <nav
        className="app-sidebar-body flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Sidebar navigation"
      >
        {loading ? (
          <div className="flex h-32 items-center justify-center">
            <ArrowsClockwise className="h-4 w-4 animate-spin text-sidebar-muted" />
          </div>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-center text-sm text-sidebar-muted">
            <WarningCircle className="mb-2 h-8 w-8" />
            <p className="font-medium text-sidebar-foreground">
              No navigation items available
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Your account may have no module access in Settings → Access Control, or
              permissions failed to load.
            </p>
            <Badge variant="outline" className="mt-3 text-xs font-normal">
              {role ? formatRoleName(role) : "Role: not loaded"}
            </Badge>
          </div>
        ) : (
          groups.map((group) => {
            const GroupIcon = GROUP_ICONS[group.label] || WarningCircle;
            const isOpen = openGroup === group.label;

            return (
              <div key={group.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className="flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm font-medium text-sidebar-muted transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground"
                  aria-expanded={isOpen}
                  data-testid={dashboardNavGroupTestId(group.label)}
                >
                  <span className="flex items-center gap-2">
                    <GroupIcon className="h-4 w-4 shrink-0 text-sidebar-muted" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-sidebar-muted">
                      {group.label}
                    </span>
                  </span>
                  {isOpen ? (
                    <CaretDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <CaretRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                {isOpen ? (
                  <div className="app-sidebar-divider-l space-y-0.5 border-l pl-2">
                    {group.items.map((item) => (
                      <NavItem
                        key={item.name}
                        item={item}
                        isActive={isNavItemActive(pathname, searchKey, item.href)}
                        onNavigate={onClose}
                      />
                    ))}
                  </div>
                ) : null}
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
      className={cn("app-sidebar flex h-full w-64 shrink-0 flex-col", className)}
      aria-hidden
    >
      <div className="app-shell-header sidebar-brand-header shrink-0 border-b" />
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
