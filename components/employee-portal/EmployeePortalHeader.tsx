"use client";

import Link from "next/link";
import { List, SignOut } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import {
  EpDesktopBlock,
  EpMobileBlock,
} from "@/components/employee-portal/EmployeePortalViewport";
import { epTouchIconButton } from "@/lib/employee-portal-ui";
import { cn } from "@/lib/utils";

type EmployeePortalHeaderProps = {
  displayName: string;
  employeeId: string;
  profilePictureUrl: string | null;
  onLogout: () => void;
  onOpenMenu?: () => void;
};

function profileInitials(displayName: string) {
  return displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function EmployeePortalHeader({
  displayName,
  employeeId,
  profilePictureUrl,
  onLogout,
  onOpenMenu,
}: EmployeePortalHeaderProps) {
  const initials = profileInitials(displayName);

  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border/80 bg-background/90 pt-[max(0px,env(safe-area-inset-top,0px))] shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
      {/* Mobile: compact single row */}
      <EpMobileBlock className="px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {onOpenMenu ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onOpenMenu}
              className={cn(epTouchIconButton, "rounded-xl")}
              aria-label="Open menu"
            >
              <List className="h-5 w-5" weight="bold" />
            </Button>
          ) : null}
          <Link
            href="/employee-portal"
            className="flex min-w-0 flex-1 items-center gap-2.5 transition-opacity hover:opacity-90"
          >
            <Avatar className="h-9 w-9 shrink-0 border border-primary/30">
              <AvatarImage src={profilePictureUrl || undefined} alt={displayName} />
              <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold leading-tight text-foreground">
                {displayName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                ID: {employeeId}
              </p>
            </div>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <ChangePasswordDialog employeeId={employeeId} compactBelow="md" />
            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              className={cn(epTouchIconButton, "rounded-xl md:hidden")}
              aria-label="Log out"
            >
              <SignOut className="h-4 w-4 shrink-0" weight="bold" />
            </Button>
          </div>
        </div>
      </EpMobileBlock>

      {/* Laptop/desktop: profile left, actions far right */}
      <EpDesktopBlock className="px-4 py-3 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/employee-portal"
              className="flex min-w-0 items-center gap-3 transition-opacity hover:opacity-90"
            >
              <Avatar className="h-10 w-10 shrink-0 border-2 border-primary shadow-sm transition-shadow hover:shadow-md md:h-12 md:w-12">
                <AvatarImage src={profilePictureUrl || undefined} alt={displayName} />
                <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground md:text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 text-left">
                <p className="truncate text-base font-semibold text-foreground md:text-lg">
                  {displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground md:text-sm">
                  ID: {employeeId}
                </p>
              </div>
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <ChangePasswordDialog employeeId={employeeId} />
            <Button
              variant="secondary"
              size="sm"
              onClick={onLogout}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium"
              aria-label="Log out"
            >
              <SignOut className="h-4 w-4 shrink-0" weight="bold" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </EpDesktopBlock>
    </header>
  );
}
