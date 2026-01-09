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
  }, [modeFromQuery]);

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
        // Verify session is accessible (this also ensures cookies are set)
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          throw new Error("Session not saved. Please try again.");
        }
        
        if (sessionData?.session) {
          toast.success("Login successful!");
          // Small delay to ensure toast is visible, then redirect with full page reload
          // This ensures cookies are properly set and persisted
          setTimeout(() => {
            window.location.href = "/dashboard";
          }, 500);
        } else {
          // Fallback: try router.push if session exists but getSession fails
          // This might happen in edge cases
          console.warn("Session exists but getSession returned null, attempting redirect anyway");
          toast.success("Login successful!");
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 500);
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
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
      <div className="max-w-md w-full">
        <div className="bg-card rounded-2xl shadow-lg border p-8">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <img
                src="/gp-logo.webp"
                alt="Green Pasture People Management Inc."
                className="h-32 w-auto"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            </div>
            <h1 className="text-2xl font-bold text-primary mb-2">
              Green Pasture People Management Inc.
            </h1>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          <div className="grid grid-cols-2 mb-6 rounded-lg border overflow-hidden">
            <button
              className={`py-3 text-sm font-medium transition ${
                mode === "admin"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
              onClick={() => setMode("admin")}
            >
              Admin / HR
            </button>
            <button
              className={`py-3 text-sm font-medium transition ${
                mode === "employee"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
              onClick={() => setMode("employee")}
            >
              Employee
            </button>
          </div>

          {mode === "admin" ? (
            <form onSubmit={handleAdminLogin} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition text-foreground"
                  placeholder="you@company.com"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-foreground mb-2"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition text-foreground"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetLoading}
                className="w-full mt-3 text-sm font-medium text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resetLoading ? "Sending reset link..." : "Forgot password?"}
              </button>
              {adminError && (
                <p className="mt-2 text-sm text-red-600">{adminError}</p>
              )}
            </form>
          ) : (
            <form onSubmit={handleEmployeeLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Employee ID
                </label>
                <input
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition text-foreground"
                  placeholder="2025-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={employeePassword}
                  onChange={(e) => setEmployeePassword(e.target.value)}
                  className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition text-foreground"
                  placeholder="Default is your Employee ID"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
              {employeeError && (
                <p className="mt-2 text-sm text-red-600">{employeeError}</p>
              )}
            </form>
          )}

          <div className="mt-8 text-center text-sm text-muted-foreground">
            <p>
              {mode === "admin"
                ? "Authorized personnel only"
                : "Use the credentials provided by HR"}
            </p>
          </div>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground space-y-2">
          <p>
            © 2025 Green Pasture People Management Inc. All rights reserved.
          </p>
          <div className="flex items-center justify-center gap-4 text-xs">
            <a
              href="/privacy"
              className="text-primary hover:underline transition-colors"
            >
              Privacy Notice
            </a>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              Compliant with RA 10173 (Data Privacy Act)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}