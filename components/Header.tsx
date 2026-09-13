"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { List, CaretDown } from "phosphor-react";
import { Button } from "@/components/ui/button";
import { DashboardTopNav } from "@/components/DashboardTopNav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatRoleName } from "@/lib/formatRoleName";
import { formatProfileDisplayName } from "@/lib/format-profile-display-name";
import { Badge } from "@/components/ui/badge";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import {
  dbAppBar,
  dbAppBarAvatarFallback,
  dbAppBarGhostButton,
  dbAppBarOutlineButton,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [userFullName, setUserFullName] = useState<string>("");
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    let userSubscription: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    let currentUserId: string | null = null;

    async function getUser() {
      try {
        const response = await fetch("/api/auth/me", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          cache: "no-store",
        });

        if (!isMounted) return;

        if (!response.ok) {
          // 401 or other error = not authenticated, clear state
          currentUserId = null;
          setUser(null);
          setUserRole("");
          setUserFullName("");
          setProfilePictureUrl(null);
          return;
        }

        const data = await response.json();
        const userData = data.user;

        if (!userData && isMounted) {
          currentUserId = null;
          setUser(null);
          setUserRole("");
          setUserFullName("");
          setProfilePictureUrl(null);
          return;
        }

        if (userData && isMounted) {
          currentUserId = userData.id;
          // Set auth user for compatibility
          setUser({
            id: userData.id,
            email: userData.email,
          } as User);

          setUserRole(userData.role);
          setUserFullName(userData.full_name || "");
          setProfilePictureUrl(userData.profile_picture_url);

          // Set up real-time subscription for user profile changes
          // Only subscribe once when we have a user
          if (!userSubscription && userData.id) {
            userSubscription = supabase
              .channel(`user-profile-${userData.id}`)
              .on(
                "postgres_changes",
                {
                  event: "UPDATE",
                  schema: "public",
                  table: "users",
                  filter: `id=eq.${userData.id}`,
                },
                (payload) => {
                  if (!isMounted) return;
                  const newData = payload.new as {
                    profile_picture_url?: string | null;
                    full_name?: string;
                    role?: string;
                  };
                  if (newData.profile_picture_url !== undefined) {
                    setProfilePictureUrl(newData.profile_picture_url);
                  }
                  if (newData.full_name !== undefined) {
                    setUserFullName(newData.full_name || "");
                  }
                  if (newData.role !== undefined) {
                    setUserRole(newData.role);
                  }
                }
              )
              .subscribe();
          }
        }
      } catch (error) {
        console.error("Error fetching user in Header:", error);
      }
    }

    // Initial fetch
    getUser();

    // Auth sync from other tabs fires TOKEN_REFRESHED / SIGNED_IN here.
    // Skip no-op refreshes so we don't churn header state on every new tab.
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        currentUserId = null;
        getUser();
        return;
      }
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
        return;
      }
      if (event === "SIGNED_IN") {
        const nextId = session?.user?.id ?? null;
        // Same session already shown — ignore cross-tab sync.
        if (currentUserId && nextId && currentUserId === nextId) {
          return;
        }
        getUser();
      }
    });

    return () => {
      isMounted = false;
      authSubscription.unsubscribe();
      if (userSubscription) {
        userSubscription.unsubscribe();
      }
    };
  }, [supabase]);

  const handleLogout = async () => {
    const { invalidateSessionCache } = await import("@/lib/session-cache");
    invalidateSessionCache();
    // Clear all auth caches before signOut so no stale data when switching accounts
    const { clearSessionCache } = await import("@/lib/session-utils");
    clearSessionCache();
    const { clearCurrentUserCache } = await import("@/lib/hooks/useCurrentUser");
    clearCurrentUserCache();
    const { clearPermissionsCache } = await import("@/lib/hooks/usePermissions");
    clearPermissionsCache();

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const displayName = formatProfileDisplayName(userFullName);

  const getInitials = () => {
    if (displayName) {
      const parts = displayName.trim().split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return displayName.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <header className={cn(dbAppBar, "bg-sidebar text-sidebar-foreground")}>
      <div className="flex w-full items-center gap-2 sm:gap-3">
        {onMenuClick ? (
          <Button
            variant="ghost"
            size="icon"
            className={cn("shrink-0 md:hidden", dbAppBarGhostButton)}
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <List className="h-5 w-5" weight="bold" aria-hidden />
          </Button>
        ) : null}
        <Link href="/dashboard" className="flex shrink-0 items-center">
          <img
            src="/add-bell-logo-on-dark.png?v=9"
            alt="Add-bell Technical Services, Inc."
            className="h-9 w-auto max-w-[9rem] object-contain"
          />
        </Link>
        <DashboardTopNav className="hidden min-w-0 flex-1 md:flex" />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <ChangePasswordDialog
            variant="dashboard"
            className={dbAppBarOutlineButton}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={cn(
                  dbAppBarGhostButton,
                  "h-auto min-h-11 border border-transparent px-2 py-1.5 sm:px-3"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={profilePictureUrl || undefined}
                    alt={displayName || user?.email || "User"}
                  />
                  <AvatarFallback className={dbAppBarAvatarFallback}>
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-sm font-medium text-sidebar-foreground">
                    {displayName || user?.email}
                  </span>
                  {userRole ? (
                    <Badge
                      variant="secondary"
                      className="mt-1 h-5 rounded-md px-2 text-[11px] font-normal"
                    >
                      {formatRoleName(userRole)}
                    </Badge>
                  ) : null}
                </div>
                <CaretDown className="h-4 w-4 shrink-0 text-sidebar-muted" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <Icon name="SignOut" size={IconSizes.sm} className="mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}