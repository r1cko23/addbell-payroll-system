"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarBlank, Clock, House, List, Timer } from "phosphor-react";
import { cn } from "@/lib/utils";
import {
  isEmployeePortalMoreNavActive,
  isEmployeePortalNavActive,
} from "@/lib/employee-portal-nav";

type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/employee-portal", icon: House },
  { label: "Bundy", href: "/employee-portal/bundy", icon: Clock },
  { label: "Leave", href: "/employee-portal/leave-request", icon: CalendarBlank },
  { label: "OT", href: "/employee-portal/overtime", icon: Timer },
];

type EmployeePortalMobileNavProps = {
  onOpenMenu: () => void;
};

export function EmployeePortalMobileNav({
  onOpenMenu,
}: EmployeePortalMobileNavProps) {
  const pathname = usePathname();
  const isMoreActive = isEmployeePortalMoreNavActive(pathname);

  return (
    <nav
      aria-label="Employee portal navigation"
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/80 bg-background/90 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5 items-stretch px-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] sm:px-2">
        {PRIMARY_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = isEmployeePortalNavActive(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all duration-200 sm:px-2",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
              )}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" weight={isActive ? "fill" : "regular"} />
              <span className="mt-1 text-[10px] font-medium leading-tight sm:text-xs">
                {label}
              </span>
            </Link>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenu}
          className={cn(
            "flex flex-col items-center justify-center rounded-xl px-1 py-1.5 transition-all duration-200 sm:px-2",
            isMoreActive
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-primary/5 hover:text-foreground"
          )}
          aria-label="Open all portal pages"
          aria-expanded={false}
        >
          <List className="h-5 w-5" weight={isMoreActive ? "bold" : "regular"} />
          <span className="mt-1 text-[10px] font-medium leading-tight sm:text-xs">
            More
          </span>
        </button>
      </div>
    </nav>
  );
}
