"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Toaster } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  EmployeeSession,
  EmployeeSessionProvider,
} from "@/contexts/EmployeeSessionContext";
import { EmployeePortalSidebar } from "@/components/EmployeePortalSidebar";
import { EmployeePortalMobileNav } from "@/components/EmployeePortalMobileNav";
import { EmployeePortalHeader } from "@/components/employee-portal/EmployeePortalHeader";
import { formatProfileDisplayName } from "@/lib/format-profile-display-name";

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

  const displayName =
    formatProfileDisplayName(employee?.full_name) || employee?.full_name || "";

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
      <div className="flex min-h-screen bg-background">
        {/* Sidebar - Desktop */}
        <aside className="hidden md:flex fixed left-0 top-0 bottom-0 z-40">
          <EmployeePortalSidebar />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-foreground/40 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-0 bottom-0 z-50 w-64 bg-background shadow-xl md:hidden">
              <EmployeePortalSidebar onClose={() => setIsSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex flex-1 flex-col bg-background md:pl-64">
          <EmployeePortalHeader
            displayName={displayName}
            employeeId={employee.employee_id}
            profilePictureUrl={profilePictureUrl}
            onLogout={handleLogout}
            onOpenMenu={() => setIsSidebarOpen(true)}
          />

          <main
            id="employee-main-content"
            className="mx-auto w-full min-w-0 max-w-7xl flex-1 overflow-x-hidden px-3 py-2 pb-[calc(3.75rem+env(safe-area-inset-bottom,0px))] sm:px-4 sm:py-3 sm:pb-[calc(4rem+env(safe-area-inset-bottom,0px))] md:px-6 md:py-6 md:pb-6 lg:px-8"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>

        <EmployeePortalMobileNav onOpenMenu={() => setIsSidebarOpen(true)} />
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
              minWidth: "min(320px, calc(100vw - 2rem))",
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