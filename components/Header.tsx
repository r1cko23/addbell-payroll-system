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

  function getRoleBadgeClass(role?: string | null) {
    const r = (role || "").trim().toLowerCase();
    if (r === "upper_management") return "bg-indigo-50 text-indigo-700 border-indigo-200";
    if (r === "operations_manager") return "bg-blue-50 text-blue-700 border-blue-200";
    if (r === "purchasing_officer") return "bg-amber-50 text-amber-800 border-amber-200";
    if (r === "hr") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    return "bg-secondary text-secondary-foreground border-transparent";
  }

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
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center border-b border-border/80 bg-background px-4 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/95 sm:px-6 xl:px-8">
      <div className="flex w-full items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {onMenuClick ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 lg:hidden"
              onClick={onMenuClick}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
          ) : null}
        </div>
        <div className="ml-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto rounded-xl border border-transparent px-2 py-1.5 hover:border-primary/20 hover:bg-primary/5 sm:px-3"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage
                    src={profilePictureUrl || undefined}
                    alt={userFullName || user?.email || "User"}
                  />
                  <AvatarFallback className="gradient-accent text-xs text-primary-foreground">
                    {getInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-sm font-medium text-foreground">
                    {userFullName || user?.email}
                  </span>
                  {userRole ? (
                    <Badge
                      variant="secondary"
                      className={`mt-1 h-5 rounded-md border px-2 text-[11px] font-normal ${getRoleBadgeClass(userRole)}`}
                    >
                      {formatRoleName(userRole)}
                    </Badge>
                  ) : null}
                </div>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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