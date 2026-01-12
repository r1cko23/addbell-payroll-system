"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, useCallback, useState, useEffect, useMemo } from "react";
import {
  Clock,
  User,
  WarningCircle,
  CalendarBlank,
  Timer,
  FileArrowDown,
  X,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { createClient } from "@/lib/supabase/client";

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

// Note: Schedule link will be conditionally shown based on employee type
const getNavGroups = (isAccountSupervisor: boolean): NavGroup[] => [
  {
    label: "Time & Attendance",
    icon: Clock,
    defaultOpen: true,
    items: [
      { name: "Bundy Clock", href: "/employee-portal/bundy", icon: Clock },
      ...(isAccountSupervisor
        ? [
            {
              name: "Schedule",
              href: "/employee-portal/schedule",
              icon: CalendarBlank,
            },
          ]
        : []),
    ],
  },
  {
    label: "Requests",
    icon: WarningCircle,
    defaultOpen: true,
    items: [
      {
        name: "Leave Request",
        href: "/employee-portal/leave-request",
        icon: CalendarBlank,
      },
      { name: "OT Filing", href: "/employee-portal/overtime", icon: Timer },
      {
        name: "Failure to Log",
        href: "/employee-portal/failure-to-log",
        icon: WarningCircle,
      },
    ],
  },
  {
    label: "Information",
    icon: User,
    defaultOpen: true,
    items: [
      { name: "My Information", href: "/employee-portal/info", icon: User },
      {
        name: "Payslips",
        href: "/employee-portal/payslips",
        icon: FileArrowDown,
      },
    ],
  },
];

interface EmployeePortalSidebarProps {
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
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon
        className="h-5 w-5 flex-shrink-0"
        weight={isActive ? "fill" : "regular"}
      />
      <span>{item.name}</span>
    </Link>
  );
});

export function EmployeePortalSidebar({
  className,
  onClose,
}: EmployeePortalSidebarProps) {
  const pathname = usePathname();
  const { employee } = useEmployeeSession();
  const supabase = createClient();
  const [isAccountSupervisor, setIsAccountSupervisor] = useState<boolean>(false);
  const [loadingEmployeeType, setLoadingEmployeeType] = useState(true);
  const FallbackIcon = WarningCircle;

  // Fetch employee type and position to determine if they're an Account Supervisor
  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      if (!employee?.id) {
        console.log("EmployeePortalSidebar - No employee ID available");
        setLoadingEmployeeType(false);
        return;
      }

      try {
        console.log("EmployeePortalSidebar - Fetching employee info via RPC:", {
          uuid: employee.id,
          employeeId: employee.employee_id,
        });

        // Use RPC function to bypass RLS (same approach as get_employee_profile)
        const { data, error } = await supabase.rpc("get_employee_type_and_position", {
          p_employee_uuid: employee.id,
        } as any);

        if (error) {
          console.error("EmployeePortalSidebar - Error fetching employee via RPC:", {
            error,
            uuid: employee.id,
            employeeId: employee.employee_id,
            errorCode: error.code,
            errorMessage: error.message,
          });
          setLoadingEmployeeType(false);
          return;
        }

        // RPC returns array, get first result
        const employeeData = Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (!employeeData) {
          console.warn("EmployeePortalSidebar - No employee data returned from RPC");
          setLoadingEmployeeType(false);
          return;
        }

        // Normalize position for comparison (trim and uppercase)
        const normalizedPosition = (employeeData.position || "").trim().toUpperCase();
        const hasAccountSupervisor = normalizedPosition.includes("ACCOUNT SUPERVISOR");

        // Check if employee is client-based AND Account Supervisor
        const isClientBasedAccountSupervisor =
          employeeData.employee_type === "client-based" && hasAccountSupervisor;

        console.log("EmployeePortalSidebar - Employee check:", {
          employeeId: employee.id,
          employeeIdFromSession: employee.employee_id,
          employeeName: employeeData.full_name,
          employeeType: employeeData.employee_type,
          position: employeeData.position,
          normalizedPosition,
          hasAccountSupervisor,
          isClientBasedAccountSupervisor,
        });

        setIsAccountSupervisor(isClientBasedAccountSupervisor);
      } catch (err) {
        console.error("EmployeePortalSidebar - Exception fetching employee info:", err);
      } finally {
        setLoadingEmployeeType(false);
      }
    };

    fetchEmployeeInfo();
  }, [employee?.id, employee?.employee_id, supabase]);

  const navGroups = useMemo(() => {
    console.log("EmployeePortalSidebar - Rendering nav groups, isAccountSupervisor:", isAccountSupervisor);
    return getNavGroups(isAccountSupervisor);
  }, [isAccountSupervisor]);

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Initialize with default open groups - use a stable set of groups
    return new Set(["Time & Attendance", "Requests", "Information"]);
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  // Auto-open the group that matches the current route
  useEffect(() => {
    if (loadingEmployeeType) return; // Wait for employee type to load

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
      setOpenGroups((prev) => new Set([...prev, matchedGroup!]));
    }
  }, [pathname, navGroups, loadingEmployeeType]);

  return (
    <div
      className={cn(
        "flex h-full flex-col w-64 border-r bg-background",
        className
      )}
    >
      <div className="relative border-b">
        <div className="flex items-center justify-center h-20 px-4 py-3">
          <div className="flex flex-col items-center justify-center gap-1.5 w-full">
            <img
              src="/gp-logo.webp"
              alt="Green Pasture People Management Inc."
              className="h-12 w-auto max-w-[180px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-xs font-semibold text-muted-foreground text-center whitespace-nowrap">
              Employee Portal
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors z-10"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navGroups.map((group) => {
          const GroupIcon = group.icon || FallbackIcon;
          const isOpen = openGroups.has(group.label);
          const hasActiveItem = group.items.some(
            (item) =>
              pathname === item.href || pathname?.startsWith(item.href + "/")
          );

          return (
            <div key={group.label} className="mb-4">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition-colors mb-2",
                  hasActiveItem
                    ? "text-foreground bg-accent"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4" weight="bold" />
                  <span>{group.label}</span>
                </div>
                <span className="text-xs text-gray-500">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-1 pl-4">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname?.startsWith(item.href + "/");
                    return (
                      <NavItem
                        key={item.href}
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
          <Link
            href="/privacy"
            className="text-xs text-primary hover:underline transition-colors"
          >
            Privacy Notice
          </Link>
        </div>
      </div>
    </div>
  );
}