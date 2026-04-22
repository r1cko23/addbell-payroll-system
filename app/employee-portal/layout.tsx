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
import { SignOut, List } from "phosphor-react";
import { EmployeePortalSidebar } from "@/components/EmployeePortalSidebar";
import { EmployeePortalMobileNav } from "@/components/EmployeePortalMobileNav";
import { Badge } from "@/components/ui/badge";

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
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_24%),linear-gradient(to_bottom,hsl(var(--muted)/0.45),hsl(var(--background))_18%)]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,hsl(var(--primary)/0.10),transparent_24%),linear-gradient(to_bottom,hsl(var(--muted)/0.45),hsl(var(--background))_18%)] flex">
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
            <aside className="fixed left-0 top-0 bottom-0 z-50 lg:hidden w-72 shadow-xl">
              <EmployeePortalSidebar onClose={() => setIsSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:pl-72 pb-20 md:pb-0">
          {/* Header */}
          <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="w-full px-4 py-4 md:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                  {/* Mobile Menu Button */}
                  <Button
                    variant="ghost"
                    size="lg"
                    className="hidden"
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    aria-expanded={isSidebarOpen}
                    aria-label="Toggle navigation menu"
                  >
                    <List
                      className="h-5 w-5"
                      weight={isSidebarOpen ? "fill" : "regular"}
                    />
                    <span className="font-semibold">Menu</span>
                  </Button>

                  {/* Profile */}
                  <Link
                    href="/employee-portal/bundy"
                    className="flex items-center gap-3 rounded-2xl transition-opacity"
                  >
                    <Avatar className="h-11 w-11 border shadow-sm transition-shadow">
                      <AvatarImage
                        src={profilePictureUrl || undefined}
                        alt={employee.full_name}
                      />
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                        {employee.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {employee.full_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge variant="secondary" className="font-normal">
                          ID {employee.employee_id}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Employee workspace
                        </span>
                      </div>
                    </div>
                  </Link>
                </div>

                {/* Logout Button */}
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2 min-h-[40px] rounded-xl px-4 w-full md:w-auto"
                  aria-label="Logout"
                >
                  <SignOut className="h-4 w-4" weight="bold" />
                  <span className="font-semibold">Logout</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1">
            <div className="mx-auto w-full max-w-[1440px] px-4 py-6 md:px-6 lg:px-8">
              {children}
            </div>
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