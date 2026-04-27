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
  Receipt,
  X,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { createClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";

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

// Schedule functionality removed - not relevant for Addbell
const getNavGroups = (_isAccountSupervisor: boolean): NavGroup[] => [
  {
    label: "Time & Attendance",
    icon: Clock,
    defaultOpen: true,
    items: [
      { name: "Bundy Clock", href: "/employee-portal/bundy", icon: Clock },
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
      {
        name: "Fund Request",
        href: "/employee-portal/fund-request",
        icon: Receipt,
      },
    ],
  },
  {
    label: "Information",
    icon: User,
    defaultOpen: true,
    items: [
      { name: "Project Assignments", href: "/employee-portal/project-time", icon: Clock },
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
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
        isActive
          ? "bg-gradient-to-r from-primary/15 to-accent-secondary/10 text-primary shadow-card"
          : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
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
        setLoadingEmployeeType(false);
        return;
      }

      try {
        const { data: employeeData, error } = await supabase
          .from("employees")
          .select("position, employment_type, full_name")
          .eq("id", employee.id)
          .maybeSingle();

        if (error) {
          console.error("EmployeePortalSidebar - Error fetching employee:", {
            error,
            uuid: employee.id,
            employeeId: employee.employee_id,
            errorCode: error.code,
            errorMessage: error.message,
          });
          setLoadingEmployeeType(false);
          return;
        }

        if (!employeeData) {
          setLoadingEmployeeType(false);
          return;
        }

        // Normalize position for comparison (trim and uppercase)
        const normalizedPosition = (employeeData.position || "").trim().toUpperCase();
        const hasAccountSupervisor = normalizedPosition.includes("ACCOUNT SUPERVISOR");

        // Check if employee is client-based AND Account Supervisor (employment_type = DB column)
        const isClientBasedAccountSupervisor =
          employeeData.employment_type === "client-based" && hasAccountSupervisor;

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
        "flex h-full w-72 flex-col border-r border-border/80 bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/80",
        className
      )}
    >
      <div className="relative border-b border-border/80 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-3 w-full">
            <img
              src="/add-bell-logo-new.png"
              alt="Add-bell Technical Services, Inc."
              className="h-12 w-auto max-w-[180px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="space-y-1">
              <p className="font-mono text-xs uppercase tracking-[0.14em] text-primary">Employee portal</p>
              <p className="text-xs text-muted-foreground">
                Time, requests, payslips, and your work information.
              </p>
            </div>
            <Badge variant="secondary" className="w-fit font-normal">
              {employee.employee_id}
            </Badge>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors z-10"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
        {navGroups.map((group) => {
          const GroupIcon = group.icon || FallbackIcon;
          const isOpen = openGroups.has(group.label);
          const hasActiveItem = group.items.some(
            (item) =>
              pathname === item.href || pathname?.startsWith(item.href + "/")
          );

          return (
            <div key={group.label} className="mb-4 rounded-2xl border border-transparent px-1 py-1">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold transition-colors",
                  hasActiveItem
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
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
      <div className="border-t border-border/80 p-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-center">
          <p className="text-xs text-muted-foreground mb-2">
            © {new Date().getFullYear()} Add-bell Technical Services, Inc.
          </p>
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