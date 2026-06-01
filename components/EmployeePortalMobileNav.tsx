"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  CalendarBlank,
  Clock,
  FileArrowDown,
  House,
  Receipt,
  Timer,
  User,
  WarningCircle,
} from "phosphor-react";
import { isEmployeePortalNavActive } from "@/lib/employee-portal-nav";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const NAV_ITEMS: NavItem[] = [
  {
    label: "Home",
    href: "/employee-portal",
    icon: House,
  },
  {
    label: "Bundy",
    href: "/employee-portal/bundy",
    icon: Clock,
  },
  {
    label: "Leave",
    href: "/employee-portal/leave-request",
    icon: CalendarBlank,
  },
  {
    label: "OT",
    href: "/employee-portal/overtime",
    icon: Timer,
  },
  {
    label: "F2L",
    href: "/employee-portal/failure-to-log",
    icon: WarningCircle,
  },
  {
    label: "Funds",
    href: "/employee-portal/fund-request",
    icon: Receipt,
  },
  {
    label: "Projects",
    href: "/employee-portal/project-time",
    icon: Clock,
  },
  {
    label: "Info",
    href: "/employee-portal/info",
    icon: User,
  },
  {
    label: "Payslips",
    href: "/employee-portal/payslips",
    icon: FileArrowDown,
  },
];

export function EmployeePortalMobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Employee portal navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/90 backdrop-blur md:hidden"
    >
      <div className="flex items-stretch gap-1 px-2 py-2 overflow-x-auto">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = isEmployeePortalNavActive(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-w-[72px] flex-col items-center justify-center rounded-xl px-2 py-1.5 transition-all duration-200",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" weight={isActive ? "fill" : "regular"} />
              <span className="mt-1 text-[11px] font-medium leading-tight">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

