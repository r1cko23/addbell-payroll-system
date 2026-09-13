"use client";

import Link from "next/link";
import { Suspense } from "react";
import { CaretDown } from "phosphor-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  dashboardNavGroupTestId,
  dashboardNavItemTestId,
} from "@/lib/dashboard-nav";
import { useDashboardNavGroups } from "@/lib/hooks/useDashboardNavGroups";
import { cn } from "@/lib/utils";
import { dbAppBarNavActive, dbAppBarNavIdle } from "@/lib/dashboard-ui";

function DashboardTopNavInner({ className }: { className?: string }) {
  const { groups, activeGroup, loading } = useDashboardNavGroups();

  if (loading || groups.length === 0) {
    return <nav aria-label="Main" className={className} />;
  }

  return (
    <nav
      aria-label="Main"
      data-testid="dashboard-top-nav"
      className={cn(
        "min-w-0 items-center gap-0.5 overflow-x-auto",
        className
      )}
    >
      {groups.map((group) => {
        const isActive = activeGroup === group.label;
        return (
          <DropdownMenu key={group.label}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  "shrink-0 gap-1 px-2.5 text-xs font-semibold uppercase tracking-wide",
                  isActive ? dbAppBarNavActive : dbAppBarNavIdle
                )}
                aria-current={isActive ? "true" : undefined}
                data-testid={dashboardNavGroupTestId(group.label)}
              >
                {group.label}
                <CaretDown className="h-3 w-3" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[12rem]">
              {group.items.map((item) => (
                <DropdownMenuItem key={item.href} asChild>
                  <Link
                    href={item.href}
                    data-testid={dashboardNavItemTestId(item.name)}
                  >
                    {item.name}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        );
      })}
    </nav>
  );
}

export function DashboardTopNav({ className }: { className?: string }) {
  return (
    <Suspense fallback={<nav aria-label="Main" className={className} />}>
      <DashboardTopNavInner className={className} />
    </Suspense>
  );
}
