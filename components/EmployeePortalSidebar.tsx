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
  House,
  X,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { isEmployeePortalNavActive } from "@/lib/employee-portal-nav";
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

const getNavGroups = (_isAccountSupervisor: boolean): NavGroup[] => [
  {
    label: "Time & Attendance",
    icon: Clock,
    defaultOpen: true,
    items: [
      { name: "Home", href: "/employee-portal", icon: House },
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
        name: "Failure To Log",
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
      {
        name: "Project Assignments",
        href: "/employee-portal/project-time",
        icon: Clock,
      },
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
        "flex min-h-10 items-center gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3 text-sm transition-colors",
        isActive
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
      )}
    >
      <Icon
        className="h-5 w-5 shrink-0"
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

        const normalizedPosition = (employeeData.position || "")
          .trim()
          .toUpperCase();
        const hasAccountSupervisor =
          normalizedPosition.includes("ACCOUNT SUPERVISOR");

        const isClientBasedAccountSupervisor =
          employeeData.employment_type === "client-based" && hasAccountSupervisor;

        setIsAccountSupervisor(isClientBasedAccountSupervisor);
      } catch (err) {
        console.error(
          "EmployeePortalSidebar - Exception fetching employee info:",
          err
        );
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

  useEffect(() => {
    if (loadingEmployeeType) return;

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
        "flex h-full w-64 shrink-0 flex-col border-r border-border/80 bg-card/40 backdrop-blur-sm",
        className
      )}
    >
      <div className="relative border-b">
        <div className="flex h-20 items-center justify-center px-4 py-3">
          <div className="flex w-full flex-col items-center justify-center gap-1.5">
            <img
              src="/add-bell-logo-new.png"
              alt="Add-bell Technical Services, Inc."
              className="h-12 w-auto max-w-[180px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="whitespace-nowrap text-center text-xs font-semibold text-muted-foreground">
              Employee Portal
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 z-10 rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
                  "mb-2 flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/70",
                  hasActiveItem ? "text-foreground" : "text-muted-foreground"
                )}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <GroupIcon
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    weight="bold"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-0.5 border-l border-border/60 pl-2">
                  {group.items.map((item) => {
                    const isActive = isEmployeePortalNavActive(
                      pathname,
                      item.href
                    );
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

      <div className="border-t p-4">
        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          © {new Date().getFullYear()} Add-bell Technical Services, Inc.
        </p>
      </div>
    </div>
  );
};
