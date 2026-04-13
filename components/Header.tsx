"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";

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

    async function getUser() {
      try {
        // Use optimized hook that uses /api/auth/me endpoint
        const { useCurrentUser } = await import("@/lib/hooks/useCurrentUser");
        // Note: We can't use hooks conditionally, so we'll fetch directly
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
          setUser(null);
          setUserRole("");
          setUserFullName("");
          setProfilePictureUrl(null);
          return;
        }

        const data = await response.json();
        const userData = data.user;

        if (!userData && isMounted) {
          setUser(null);
          setUserRole("");
          setUserFullName("");
          setProfilePictureUrl(null);
          return;
        }

        if (userData && isMounted) {
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

    // Listen for auth state changes to refresh user data
    // Only refresh on SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED events
    // This prevents excessive calls on every auth state change
    const {
      data: { subscription: authSubscription },
    } = supabase.auth.onAuthStateChange((event) => {
      // Only refresh on meaningful auth events
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "TOKEN_REFRESHED") {
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

  const getInitials = () => {
    if (userFullName) {
      const parts = userFullName.trim().split(" ");
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return userFullName.substring(0, 2).toUpperCase();
    }
    if (user?.email) {
      return user.email.substring(0, 2).toUpperCase();
    }
    return "U";
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="flex h-16 w-full items-center justify-between gap-3 px-4 sm:px-6 xl:px-8">
        <div className="flex items-center gap-3">
        {onMenuClick ? (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        ) : (
          <div className="lg:hidden" aria-hidden="true" />
        )}
          <div className="hidden min-w-0 lg:block">
            <p className="text-sm font-medium text-foreground">Staff workspace</p>
            <p className="text-xs text-muted-foreground">
              Manage payroll, approvals, time, and employee records.
            </p>
          </div>
        </div>
        <div className="ml-auto">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-auto rounded-xl px-2 py-1.5 sm:px-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage
                    src={profilePictureUrl || undefined}
                    alt={userFullName || user?.email || "User"}
                  />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-sm font-medium text-foreground">
                    {userFullName || user?.email}
                  </span>
                  <Badge variant="secondary" className="mt-1 h-5 rounded-md px-2 text-[11px] font-normal">
                    {formatRoleName(userRole)}
                  </Badge>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
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