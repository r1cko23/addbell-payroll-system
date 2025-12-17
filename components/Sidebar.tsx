"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";
import {
  ChartPieSlice,
  ChatCircleDots,
  ClockClockwise,
  CalendarCheck,
  CalendarBlank,
  CurrencyDollarSimple,
  ChartLineUp,
  Gear,
  UsersThree,
  MapPin,
  Receipt,
  WarningCircle,
  CaretDown,
  CaretRight,
  X,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
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
    label: "Dashboard",
    icon: ChartPieSlice,
    items: [{ name: "Overview", href: "/dashboard", icon: ChartPieSlice }],
  },
  {
    label: "People",
    icon: UsersThree,
    items: [
      { name: "Employees", href: "/employees", icon: UsersThree },
      { name: "Schedules", href: "/schedules", icon: CalendarBlank },
    ],
  },
  {
    label: "Time & Attendance",
    icon: ClockClockwise,
    defaultOpen: true,
    items: [
      { name: "Time Entries", href: "/time-entries", icon: MapPin },
      { name: "Leave Approvals", href: "/leave-approval", icon: CalendarCheck },
      {
        name: "OT Approvals",
        href: "/overtime-approval",
        icon: ClockClockwise,
      },
      {
        name: "Failure to Log",
        href: "/failure-to-log-approval",
        icon: WarningCircle,
      },
    ],
  },
  {
    label: "Settings",
    icon: Gear,
    items: [{ name: "Settings", href: "/settings", icon: Gear }],
  },
];

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

export function Sidebar({ className, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { role, isHR, loading: roleLoading } = useUserRole();
  const [openGroup, setOpenGroup] = React.useState<string | null>("People");
  const FallbackIcon = WarningCircle;

  const toggleGroup = (label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  };

  // Filter navigation items based on user role
  // Hide items immediately if loading (assume HR to prevent flash) or if confirmed HR
  // Also hide if currently on a restricted route to prevent flash during navigation
  const isOnRestrictedRoute =
    pathname === "/overtime-approval" ||
    pathname === "/failure-to-log-approval";

  const filteredNavGroups = React.useMemo(() => {
    return navGroups.map((group) => {
      if (
        group.label === "Time & Attendance" &&
        (roleLoading || isHR || isOnRestrictedRoute)
      ) {
        // Hide OT Approvals and Failure to Log for HR users, while loading, or when on restricted route
        return {
          ...group,
          items: group.items.filter(
            (item) =>
              item.href !== "/overtime-approval" &&
              item.href !== "/failure-to-log-approval"
          ),
        };
      }
      return group;
    });
  }, [isHR, roleLoading, isOnRestrictedRoute]);

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

  return (
    <div
      className={cn(
        "flex h-full flex-col w-64 border-r bg-muted/10",
        className
      )}
    >
      <div className="flex items-center justify-between h-16 px-4 border-b">
        <div className="flex-1 flex items-center justify-center">
          <img
            src="/gp-logo.webp"
            alt="Green Pasture People Management Inc."
            className="h-12 w-auto"
            onError={(e) => {
              e.currentTarget.style.display = "none";
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
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNavGroups
          .filter((group) => !HIDDEN_GROUPS.has(group.label))
          .map((group) => {
            const GroupIcon = group.icon || FallbackIcon;
            const isOpen = openGroup === group.label;

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
                      const Icon = item.icon || FallbackIcon;

                      return (
                        <Link
                          key={item.name}
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
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center">
          © 2025 Green Pasture People Management Inc.
          <br />
          All rights reserved
        </p>
      </div>
    </div>
  );
}
