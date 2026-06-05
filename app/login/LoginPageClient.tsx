"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster, toast } from "react-hot-toast";
import { getDeviceInfo, getMacAddress } from "@/utils/device-info";

type LoginMode = "admin" | "employee";

export function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const modeFromQuery = useMemo<LoginMode>(() => {
    return searchParams?.get("mode") === "employee" ? "employee" : "admin";
  }, [searchParams]);

  const [mode, setMode] = useState<LoginMode>(modeFromQuery);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [employeePassword, setEmployeePassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [adminError, setAdminError] = useState<string>("");
  const [employeeError, setEmployeeError] = useState<string>("");

  useEffect(() => {
    setMode(modeFromQuery);
    setAdminError("");
    setEmployeeError("");

    // Forward password recovery links that land on /login to /reset-password.
    // Supabase may deliver either:
    // - query-based PKCE links (?code=...&type=recovery)
    // - hash-based links (#access_token=...&refresh_token=...&type=recovery)
    if (typeof window !== "undefined") {
      const currentUrl = new URL(window.location.href);
      const hash = window.location.hash || "";
      const searchType = currentUrl.searchParams.get("type");
      const searchCode = currentUrl.searchParams.get("code");

      if (searchType === "recovery" && searchCode) {
        const resetUrl = new URL("/reset-password", window.location.origin);
        resetUrl.search = currentUrl.search;
        router.replace(resetUrl.pathname + resetUrl.search);
        return;
      }

      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1));
        const type = params.get("type");
        const error = params.get("error");
        const errorCode = params.get("error_code");
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");

        if (type === "recovery" && accessToken && refreshToken) {
          const resetUrl = new URL("/reset-password", window.location.origin);
          resetUrl.hash = hash;
          router.replace(resetUrl.pathname + resetUrl.hash);
          return;
        }

        // If there's a password reset error, redirect to reset password page with error
        if (error && (errorCode === "otp_expired" || error === "access_denied")) {
          const resetUrl = new URL("/reset-password", window.location.origin);
          resetUrl.hash = hash; // Preserve error parameters
          router.replace(resetUrl.pathname + resetUrl.hash);
          return;
        }
      }
    }
  }, [modeFromQuery, router]);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Normalize Supabase auth errors to friendlier messages
        // Use generic wording to avoid credential enumeration
        const msg = "Invalid credentials. Please try again.";
        throw new Error(msg);
      }

      // Wait for session to be confirmed and persisted
      // This ensures the session cookie is set before redirecting
      if (data?.session) {
        // Explicitly set the session to ensure it's persisted
        // This helps ensure cookies are properly set
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        // Wait a moment for cookies to be written
        await new Promise(resolve => setTimeout(resolve, 200));

        // Verify session is accessible (this also ensures cookies are set)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error("Session not saved. Please try again.");
        }

        if (sessionData?.session) {
          toast.success("Login successful!");
          // Use window.location for full page reload to ensure cookies are read
          // This is more reliable than router.push() for auth state persistence
          setTimeout(async () => {
            let landingRoute = "/dashboard";
            try {
              const res = await fetch("/api/auth/landing-route", {
                cache: "no-store",
              });
              if (res.ok) {
                const data = await res.json();
                if (typeof data.route === "string" && data.route.startsWith("/")) {
                  landingRoute = data.route;
                }
              }
            } catch {
              // Fall back to dashboard if landing route lookup fails
            }
            window.location.href = landingRoute;
          }, 500);
        } else {
          throw new Error("Session not found after login. Please try again.");
        }
      } else {
        throw new Error("Login failed. Please try again.");
      }
    } catch (error: any) {
      const msg = error.message || "Invalid credentials. Please try again.";
      setAdminError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      const msg = "Enter your email to receive a reset link.";
      setAdminError(msg);
      toast.error(msg);
      return;
    }

    setResetLoading(true);
    setAdminError("");

    try {
      const res = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      toast.success("If that email exists, a reset link was sent.");
    } catch (error: any) {
      const msg = "Could not send reset email. Try again.";
      setAdminError(msg);
      toast.error(msg);
    } finally {
      setResetLoading(false);
    }
  };

  const handleEmployeeLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeId.trim() || !employeePassword.trim()) {
      toast.error("Please enter your Employee ID and password");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/employee-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId.trim(),
          password: employeePassword.trim(),
        }),
      });

      const payload = await res.json();

      if (!res.ok || !payload?.success || !payload?.employee_data) {
        throw new Error("Invalid credentials. Please try again.");
      }

      const employeeData = payload.employee_data as {
        id: string;
        employee_id: string;
        full_name: string;
      };

      // Capture device information for first login tracking
      const deviceInfo = getDeviceInfo();
      const macAddress = await getMacAddress();

      // Record first login (if applicable)
      try {
        const loginResponse = await fetch("/api/employee/first-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeData.id,
            user_agent: deviceInfo.userAgent,
            device_info: deviceInfo.deviceInfo,
            browser_name: deviceInfo.browserName,
            browser_version: deviceInfo.browserVersion,
            os_name: deviceInfo.osName,
            os_version: deviceInfo.osVersion,
            device_type: deviceInfo.deviceType,
            mac_address: macAddress,
          }),
        });

        const loginResult = await loginResponse.json();
        if (loginResult.is_first_login) {
          console.log("First login recorded for employee:", employeeData.employee_id);
        }
      } catch (error) {
        // Don't block login if first login recording fails
        console.error("Failed to record first login:", error);
      }

      // Set session with 8-hour expiration (same as typical work day)
      const expiresAt = Date.now() + 8 * 60 * 60 * 1000; // 8 hours from now

      localStorage.setItem(
        "employee_session",
        JSON.stringify({
          id: employeeData.id,
          employee_id: employeeData.employee_id,
          full_name: employeeData.full_name,
          loginTime: new Date().toISOString(),
          expiresAt: expiresAt,
        })
      );

      toast.success(`Welcome, ${employeeData.full_name}!`);
      router.push("/employee-portal");
    } catch (error: any) {
      const msg = "Invalid credentials. Please try again.";
      setEmployeeError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";
  const labelClass = "mb-1.5 block text-sm font-medium text-foreground";
  const submitClass =
    "w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex min-h-screen">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "hsl(var(--background))",
            color: "hsl(var(--foreground))",
            border: "1px solid hsl(var(--border))",
          },
        }}
      />
      <aside className="relative hidden min-h-screen w-[42%] max-w-xl flex-col overflow-hidden border-r lg:flex">
        <div className="login-brand-panel-bg" aria-hidden="true">
          <img
            src="/login-company-profile-panel.jpg"
            alt=""
            className="pointer-events-none select-none"
          />
        </div>
        <div className="login-brand-panel-overlay absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex min-h-screen w-full flex-col items-center p-8 sm:p-10">
          <div className="flex w-full shrink-0 justify-center">
            <div className="brand-logo brand-logo-hero">
              <img
                src="/add-bell-logo-on-dark.png?v=9"
                alt="Add-bell"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
          </div>
          <div className="flex w-full flex-1 flex-col items-center justify-center px-2 text-center">
            <div className="max-w-sm space-y-3">
              <h1 className="text-2xl font-semibold leading-tight text-sidebar-foreground">
                Add-bell Technical Services, Inc.
              </h1>
              <p className="text-sm leading-relaxed text-sidebar-muted">
                Payroll, time attendance, and project operations — one system for
                your workforce.
              </p>
            </div>
          </div>
          <p className="w-full shrink-0 text-center text-xs text-sidebar-muted">
            © {new Date().getFullYear()} Add-bell Technical Services, Inc.
          </p>
        </div>
      </aside>

      <div className="flex flex-1 items-center justify-center bg-background p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 text-center lg:hidden">
            <div className="brand-logo brand-logo-mobile mx-auto mb-4">
              <img
                src="/add-bell-logo-new.png"
                alt="Add-bell Technical Services, Inc."
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <h1 className="text-xl font-semibold text-foreground">
              Add-bell Technical Services, Inc.
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Sign in to continue</p>
          </div>

          <div className="rounded-md border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="mb-6 hidden lg:block">
              <h2 className="text-lg font-semibold text-foreground">Sign in</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose your access type below
              </p>
            </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1">
            <button
              type="button"
              className={`rounded-sm py-2 text-sm font-medium transition-colors ${
                mode === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
              onClick={() => setMode("admin")}
            >
              Admin / HR
            </button>
            <button
              type="button"
              className={`rounded-sm py-2 text-sm font-medium transition-colors ${
                mode === "employee"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-background hover:text-foreground"
              }`}
              onClick={() => setMode("employee")}
            >
              Employee
            </button>
          </div>

          {mode === "admin" ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="••••••••"
                />
              </div>

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="w-full text-xs font-medium text-muted-foreground transition-colors hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resetLoading ? "Sending..." : "Forgot password?"}
              </button>
              {adminError && (
                <p className="text-xs text-destructive">{adminError}</p>
              )}
            </form>
          ) : (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className={labelClass}>Employee ID</label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className={inputClass}
                  placeholder="2025-001"
                />
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  required
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  className={inputClass}
                  placeholder="Default is your Employee ID"
                />
              </div>

              <button type="submit" disabled={loading} className={submitClass}>
                {loading ? "Signing in..." : "Sign in"}
              </button>
              {employeeError && (
                <p className="text-xs text-destructive">{employeeError}</p>
              )}
            </form>
          )}

          <p className="mt-4 text-center text-xs text-muted-foreground">
            {mode === "admin" ? "Authorized personnel only" : "Use the credentials provided by HR"}
          </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground lg:hidden">
            <a href="/privacy" className="hover:text-primary hover:underline">
              Privacy notice
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}