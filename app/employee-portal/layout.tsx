"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import {
  EmployeeSession,
  EmployeeSessionProvider,
} from "@/contexts/EmployeeSessionContext";
import {
  Clock,
  User,
  SignOut,
  List,
  WarningCircle,
  CalendarBlank,
  Timer,
} from "phosphor-react";

const navItems = [
  { name: "Bundy Clock", href: "/employee-portal/bundy", icon: Clock },
  { name: "My Information", href: "/employee-portal/info", icon: User },
  {
    name: "Failure to Log",
    href: "/employee-portal/failure-to-log",
    icon: WarningCircle,
  },
  {
    name: "Leave Request",
    href: "/employee-portal/leave-request",
    icon: CalendarBlank,
  },
  { name: "OT Filing", href: "/employee-portal/overtime", icon: Timer },
  { name: "Schedule", href: "/employee-portal/schedule", icon: CalendarBlank },
];

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
  const [isNavOpen, setIsNavOpen] = useState(false);
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

  // Fetch profile picture when employee is loaded
  useEffect(() => {
    if (!employee?.id) return;

    const employeeId = employee.id;

    async function fetchProfilePicture() {
      try {
        const { data, error } = await supabase.rpc("get_employee_profile", {
          p_employee_uuid: employeeId,
        });

        if (!error && data && data.length > 0) {
          const profileData = data[0] as {
            profile_picture_url?: string | null;
          };
          setProfilePictureUrl(profileData.profile_picture_url || null);
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
    setIsNavOpen(false);
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
          })
          .then(({ data, error }) => {
            if (!error && data && data.length > 0) {
              const profileData = data[0] as {
                profile_picture_url?: string | null;
              };
              setProfilePictureUrl(profileData.profile_picture_url || null);
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="bg-white border-b shadow-sm">
          <div className="w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12 border-2 border-emerald-600">
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
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  className="md:hidden inline-flex items-center gap-2 border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setIsNavOpen((prev) => !prev)}
                  aria-expanded={isNavOpen}
                  aria-controls="employee-portal-nav"
                >
                  <List className="h-4 w-4" />
                  Menu
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  className="hidden md:inline-flex items-center gap-2"
                >
                  <SignOut className="h-4 w-4" weight="bold" />
                  Logout
                </Button>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 justify-end">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      isActive
                        ? "bg-emerald-600 text-white shadow-md"
                        : "bg-white border text-gray-600 hover:bg-emerald-50"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>

            {isNavOpen && (
              <div
                id="employee-portal-nav"
                className="md:hidden flex flex-col gap-2 border-t pt-4"
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsNavOpen(false)}
                      className={`inline-flex items-center justify-between gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-md"
                          : "bg-white border text-gray-600 hover:bg-emerald-50"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  className="inline-flex items-center justify-center gap-2"
                >
                  <SignOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="w-full max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6">
          {children}
        </main>
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
