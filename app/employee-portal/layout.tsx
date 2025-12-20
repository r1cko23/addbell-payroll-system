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
      try {
        const { data, error } = await supabase.rpc("get_employee_profile", {
          p_employee_uuid: employeeId,
        } as any);

        const profileData = data as Array<{
          profile_picture_url?: string | null;
        }> | null;

        if (!error && profileData && profileData.length > 0) {
          const url = profileData[0].profile_picture_url || null;
          profilePictureCacheRef.current[employeeId] = url;
          setProfilePictureUrl(url);
        }
      } catch (err) {
        console.error("Failed to load profile picture:", err);
      }
    }

    fetchProfilePicture();

    // Listen for changes to the employee's profile picture in real-time
    const channel = supabase
      .channel(`employee-profile-${employeeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "employees",
          filter: `id=eq.${employeeId}`,
        },
        (payload) => {
          const newData = payload.new as {
            profile_picture_url?: string | null;
          };
          if (newData.profile_picture_url !== undefined) {
            setProfilePictureUrl(newData.profile_picture_url);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [employee?.id, supabase]);

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
        supabase
          .rpc("get_employee_profile", {
            p_employee_uuid: parsed.id,
          } as any)
          .then(({ data, error }) => {
            const profileData = data as Array<{
              profile_picture_url?: string | null;
            }> | null;

            if (!error && profileData && profileData.length > 0) {
              setProfilePictureUrl(profileData[0].profile_picture_url || null);
            }
          });
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("employee_session");
    router.replace("/login?mode=employee");
  };

  if (loading || !employee) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex">
        {/* Sidebar - Desktop */}
        <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 z-40">
          <EmployeePortalSidebar />
        </aside>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
            <aside className="fixed left-0 top-0 bottom-0 z-50 lg:hidden w-64 shadow-xl">
              <EmployeePortalSidebar onClose={() => setIsSidebarOpen(false)} />
            </aside>
          </>
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col lg:pl-64">
          {/* Header */}
          <header className="bg-white border-b shadow-sm sticky top-0 z-30 backdrop-blur-sm bg-white/95">
            <div className="w-full px-4 md:px-6 lg:px-8 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Mobile Menu Button */}
                  <Button
                    variant="ghost"
                    size="lg"
                    className="lg:hidden inline-flex items-center gap-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 active:bg-emerald-100 min-h-[40px] px-4"
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
                    className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                  >
                    <Avatar className="w-12 h-12 border-2 border-emerald-600 shadow-sm hover:shadow-md transition-shadow">
                      <AvatarImage
                        src={profilePictureUrl || undefined}
                        alt={employee.full_name}
                      />
                      <AvatarFallback className="bg-emerald-600 text-white text-xl font-bold">
                        {employee.full_name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold text-gray-900">
                        {employee.full_name}
                      </p>
                      <p className="text-sm text-gray-500">
                        ID: {employee.employee_id}
                      </p>
                    </div>
                  </Link>
                </div>

                {/* Logout Button */}
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-2 min-h-[40px] px-4 hover:bg-gray-100 active:bg-gray-200"
                  aria-label="Logout"
                >
                  <SignOut className="h-4 w-4" weight="bold" />
                  <span className="font-semibold">Logout</span>
                </Button>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
            {children}
          </main>
        </div>
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
