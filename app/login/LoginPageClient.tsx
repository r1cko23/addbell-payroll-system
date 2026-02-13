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

    // Check for password reset errors in URL hash (Supabase redirects here with errors)
    if (typeof window !== "undefined") {
      const hash = window.location.hash || "";
      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1));
        const error = params.get("error");
        const errorCode = params.get("error_code");
        const errorDescription = params.get("error_description");

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
          setTimeout(() => {
            window.location.href = "/dashboard";
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
      const { data, error } = await supabase.rpc("authenticate_employee", {
        p_employee_id: employeeId.trim(),
        p_password: employeePassword.trim(),
      } as any);

      if (error) {
        // RPC error (e.g., function failure)
        throw new Error(error.message || "Failed to login");
      }

      const authData = data as Array<{
        success: boolean;
        employee_data?: {
          id: string;
          employee_id: string;
          full_name: string;
        };
      }> | null;

      if (!authData || authData.length === 0 || !authData[0].success) {
        // Use generic wording to avoid revealing if ID or password is wrong
        const errorMessage = "Invalid credentials. Please try again.";
        throw new Error(errorMessage);
      }

      const employeeData = authData[0].employee_data;
      if (!employeeData) {
        throw new Error("Invalid employee data received");
      }

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
      router.push("/employee-portal/bundy");
    } catch (error: any) {
      const msg = "Invalid credentials. Please try again.";
      setEmployeeError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
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
      <div className="w-full max-w-[380px]">
        <div className="bg-white rounded-lg border border-neutral-200 shadow-sm py-6 px-6">
          {/* Header: compact logo + title */}
          <div className="flex flex-col items-center gap-3 mb-5">
            <img
              src="/addbell-logo.jpg"
              alt="Addbell"
              className="h-12 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <div className="text-center">
              <h1 className="text-base font-semibold text-neutral-900 tracking-tight">
                Addbell Technical Services, Inc.
              </h1>
              <p className="text-xs text-neutral-500 mt-0.5">Sign in to your account</p>
            </div>
          </div>

          {/* Role toggle */}
          <div className="flex mb-4 rounded-md border border-neutral-200 overflow-hidden">
            <button
              type="button"
              className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                mode === "admin"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
              onClick={() => setMode("admin")}
            >
              Admin / HR
            </button>
            <button
              type="button"
              className={`flex-1 py-2.5 text-xs font-medium transition-colors cursor-pointer border-l border-neutral-200 ${
                mode === "employee"
                  ? "bg-neutral-900 text-white"
                  : "bg-white text-neutral-600 hover:bg-neutral-50"
              }`}
              onClick={() => setMode("employee")}
            >
              Employee
            </button>
          </div>

          {mode === "admin" ? (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="w-full text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Sending..." : "Forgot password?"}
              </button>
              {adminError && (
                <p className="text-xs text-red-600">{adminError}</p>
              )}
            </form>
          ) : (
            <form onSubmit={handleEmployeeLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Employee ID
                </label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                  placeholder="2025-001"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  className="w-full px-3 py-2.5 text-sm border border-neutral-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 focus:border-transparent text-neutral-900 placeholder:text-neutral-400"
                  placeholder="Default is your Employee ID"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-neutral-900 text-white py-2.5 rounded-md text-sm font-medium hover:bg-neutral-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              {employeeError && (
                <p className="text-xs text-red-600">{employeeError}</p>
              )}
            </form>
          )}

          <p className="mt-4 text-center text-[11px] text-neutral-400">
            {mode === "admin" ? "Authorized personnel only" : "Use the credentials provided by HR"}
          </p>
        </div>

        <div className="mt-4 text-center text-[11px] text-neutral-400 space-y-1">
          <p>© 2025 Addbell Technical Services, Inc.</p>
          <a href="/privacy" className="text-neutral-500 hover:text-neutral-700 transition-colors">
            Privacy Notice
          </a>
        </div>
      </div>
    </div>
  );
}