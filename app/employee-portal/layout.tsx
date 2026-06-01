"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  EmployeeSession,
  EmployeeSessionProvider,
} from "@/contexts/EmployeeSessionContext";
import { SignOut } from "phosphor-react";
import { EmployeePortalSidebar } from "@/components/EmployeePortalSidebar";
import { EmployeePortalMobileNav } from "@/components/EmployeePortalMobileNav";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

export default function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profilePictureUrl, setProfilePictureUrl] = useState<string | null>(
    null
  );

  useEffect(() => {
    const stored = localStorage.getItem("employee_session");
    if (!stored) {
      router.replace("/login?mode=employee");
      return;
    }

    try {
      const parsed = JSON.parse(stored) as EmployeeSession;

      // Check expiration if exists
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        localStorage.removeItem("employee_session");
        router.replace("/login?mode=employee&reason=expired");
        return;
      }

      setEmployee(parsed);
    } catch {
      localStorage.removeItem("employee_session");
      router.replace("/login?mode=employee");
      return;
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Fetch profile picture when employee is loaded (with caching)
  const profilePictureCacheRef = useRef<{ [key: string]: string | null }>({});

  useEffect(() => {
    if (!employee?.id) return;

    const employeeId = employee.id;

    // Check cache first
    if (profilePictureCacheRef.current[employeeId] !== undefined) {
      setProfilePictureUrl(profilePictureCacheRef.current[employeeId]);
      return;
    }

    async function fetchProfilePicture() {
      // Schema does not include profile_picture_url on employees — use placeholder
      profilePictureCacheRef.current[employeeId] = null;
      setProfilePictureUrl(null);
    }

    fetchProfilePicture();

    return () => {};
  }, [employee?.id]);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  // Auto-logout after inactivity (15 minutes)
  useEffect(() => {
    if (!employee) return;

    const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds
    let inactivityTimer: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        // Session expired due to inactivity
        localStorage.removeItem("employee_session");
        router.replace("/login?mode=employee&reason=inactivity");
      }, INACTIVITY_TIMEOUT);
    };

    // Reset timer on user activity
    const events = [
      "mousedown",
      "mousemove",
      "keypress",
      "scroll",
      "touchstart",
      "click",
    ];
    events.forEach((event) => {
      document.addEventListener(event, resetTimer, true);
    });

    // Initialize timer
    resetTimer();

    // Cleanup
    return () => {
      clearTimeout(inactivityTimer);
      events.forEach((event) => {
        document.removeEventListener(event, resetTimer, true);
      });
    };
  }, [employee, router]);

  const refreshSession = () => {
    const stored = localStorage.getItem("employee_session");
    if (stored) {
      const parsed = JSON.parse(stored) as EmployeeSession;
      setEmployee(parsed);
      // Also refresh profile picture when session is refreshed
      if (parsed?.id) {
        setProfilePictureUrl(null);
      }
    }
  };

  const handleLogout = async () => {
    // Record logout time for first login tracking
    if (employee?.id) {
      try {
        await fetch("/api/employee/first-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employee.id,
            mac_address: null, // null indicates logout
          }),
        });
      } catch (error) {
        console.error("Failed to record logout:", error);
      }
    }

    localStorage.removeItem("employee_session");
    router.replace("/login?mode=employee");
  };

  if (loading || !employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <EmployeeSessionProvider
      value={{
        employee,
        logout: handleLogout,
        refreshSession,
      }}
    >
      <div className="flex min-h-screen bg-muted/25">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex fixed left-0 top-0 bottom-0 z-40">
          <EmployeePortalSidebar />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-background/70 backdrop-blur-sm z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-background shadow-xl lg:hidden">
              <EmployeePortalSidebar onClose={() => setIsSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col bg-muted/15 pb-20 lg:pl-64 md:pb-0">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/90 shadow-sm backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
            <div className="w-full px-3 py-3 sm:px-4 sm:py-4 md:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <Link
                    href="/employee-portal"
                    className="flex min-w-0 items-center gap-2 transition-opacity hover:opacity-90 sm:gap-3"
                  >
                    <Avatar className="h-10 w-10 shrink-0 border-2 border-primary shadow-sm transition-shadow hover:shadow-md sm:h-12 sm:w-12">
                      <AvatarImage
                        src={profilePictureUrl || undefined}
                        alt={employee.full_name}
                      />
                      <AvatarFallback className="bg-primary text-base font-bold text-primary-foreground sm:text-xl">
                        {employee.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 text-left">
                      <p className="truncate text-base font-semibold text-foreground sm:text-lg">
                        {employee.full_name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground sm:text-sm">
                        ID: {employee.employee_id}
                      </p>
                    </div>
                  </Link>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <ChangePasswordDialog employeeId={employee.id} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleLogout}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-medium"
                    aria-label="Log out"
                  >
                    <SignOut className="h-4 w-4" weight="bold" />
                    <span>Logout</span>
                  </Button>
                </div>
              </div>
            </div>
          </header>

          <main
            id="employee-main-content"
            className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-6 md:px-6 lg:px-8 lg:pb-6"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>

        <EmployeePortalMobileNav />
        <Toaster
          position="top-center"
          richColors
          expand={true}
          toastOptions={{
            style: {
              background: "hsl(var(--background))",
              color: "hsl(var(--foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "0.5rem",
              boxShadow:
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
              padding: "1rem",
              minWidth: "320px",
              maxWidth: "420px",
            },
            className: "toast-message",
            duration: 4000,
          }}
          offset={80}
        />
      </div>
    </EmployeeSessionProvider>
  );
}