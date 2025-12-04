"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import {
  EmployeeSession,
  EmployeeSessionProvider,
} from "@/contexts/EmployeeSessionContext";
import { Clock, User, LogOut, Menu } from "lucide-react";

const navItems = [
  { name: "Bundy Clock", href: "/employee-portal/bundy", icon: Clock },
  { name: "My Information", href: "/employee-portal/info", icon: User },
];

export default function EmployeePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [employee, setEmployee] = useState<EmployeeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNavOpen, setIsNavOpen] = useState(false);

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
      setEmployee(JSON.parse(stored));
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
          <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
                  {employee.full_name
                    .split(" ")
                    .map((part) => part[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
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
                  <Menu className="h-4 w-4" />
                  Menu
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleLogout}
                  className="hidden md:inline-flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" />
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
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            )}
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">{children}</main>
      </div>
    </EmployeeSessionProvider>
  );
}
