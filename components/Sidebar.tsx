"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, useCallback, useMemo } from "react";
import {
  ChartPieSlice,
  ChatCircleDots,
  ClockClockwise,
  CalendarCheck,
  CalendarBlank,
  CurrencyDollarSimple,
  CurrencyDollar,
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
      { name: "Loans", href: "/loans", icon: CurrencyDollar },
      { name: "Payslips", href: "/payslips", icon: Receipt },
    ],
  },
  {
    label: "Time & Attendance",
    icon: ClockClockwise,
    defaultOpen: true,
    items: [
      { name: "Time Attendance", href: "/timesheet", icon: CalendarBlank },
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
    label: "Admin",
    icon: ShieldCheck,
    items: [{ name: "Audit Dashboard", href: "/audit", icon: FileText }],
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
    isAccountManager,
    canAccessSalaryInfo,
    loading: roleLoading,
  } = useUserRole();
  const [openGroup, setOpenGroup] = React.useState<string | null>("People");
  const FallbackIcon = WarningCircle;

  const toggleGroup = useCallback((label: string) => {
    setOpenGroup((prev) => (prev === label ? null : label));
  }, []);

  // Filter navigation items based on user role
  const filteredNavGroups = React.useMemo(() => {
    return navGroups
      .map((group) => {
        if (!roleLoading) {
          // Hide OT Approvals and Failure to Log for HR users only
          if (group.label === "Time & Attendance" && isHR) {
            return {
              ...group,
              items: group.items.filter(
                (item) =>
                  item.href !== "/overtime-approval" &&
                  item.href !== "/failure-to-log-approval"
              ),
            };
          }
          // Hide Employees and Payslips links from Account Managers (to prevent seeing salary info)
          if (group.label === "People" && isAccountManager) {
            return {
              ...group,
              items: group.items.filter(
                (item) =>
                  item.href !== "/employees" && item.href !== "/payslips"
              ),
            };
          }
          // Hide Payslips link from HR users without salary access
          if (group.label === "People" && isHR && !canAccessSalaryInfo) {
            return {
              ...group,
              items: group.items.filter((item) => item.href !== "/payslips"),
            };
          }
          // Hide Admin group if not admin
          if (group.label === "Admin" && !isAdmin) {
            return null;
          }
        }
        return group;
      })
      .filter((group): group is NavGroup => group !== null);
  }, [isHR, isAccountManager, isAdmin, canAccessSalaryInfo, roleLoading]);

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
            className="h-16 w-auto"
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
          .filter((group) => group !== null && !HIDDEN_GROUPS.has(group.label))
          .map((group) => {
            if (!group) return null;
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
          })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center mb-2">
          © 2025 Green Pasture People Management Inc.
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

// Export memoized Sidebar to prevent re-renders when parent updates
export const Sidebar = memo(SidebarComponent);