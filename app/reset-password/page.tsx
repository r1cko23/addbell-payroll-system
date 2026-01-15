"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Toaster, toast } from "react-hot-toast";

// This page must remain dynamic because it relies on Supabase auth recovery.
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

function ResetPasswordClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [canReset, setCanReset] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [sessionAttempted, setSessionAttempted] = useState(false);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:25',message:'Reset password page mounted',data:{hasCode:!!searchParams?.get('code'),hasType:!!searchParams?.get('type'),hash:typeof window !== 'undefined' ? window.location.hash : 'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
    // #endregion

    // Mark the page ready when the recovery link has been used
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:28',message:'Auth state change',data:{event},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (event === "PASSWORD_RECOVERY") {
        setCanReset(true);
      }
    });

    supabase.auth.getSession().then(({ data: sessionData }) => {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:33',message:'Session check result',data:{hasSession:!!sessionData.session},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      if (sessionData.session) {
        setCanReset(true);
      }
    });

    // Some recovery links include a query param; honor it as a fallback
    if (searchParams?.get("type") === "recovery") {
      setCanReset(true);
    }

    // Handle PKCE code exchange (new Supabase reset links)
    const code = searchParams?.get("code");
    const type = searchParams?.get("type");
    if (code && type === "recovery") {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:47',message:'Starting PKCE code exchange',data:{codeLength:code.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      supabase.auth
        .exchangeCodeForSession(code)
        .then(({ error }) => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:50',message:'PKCE code exchange result',data:{hasError:!!error,errorMessage:error?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          if (error) {
            setLinkError(
              error.message ||
                "This reset link is invalid or has expired. Request a new one."
            );
            setCanReset(false);
          } else {
            setCanReset(true);
            setLinkError(null);
          }
        })
        .catch((err) => {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/baf212a9-0048-4497-b30f-a8a72fba0d2d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'reset-password/page.tsx:62',message:'PKCE code exchange exception',data:{errorMessage:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
          // #endregion
          setLinkError(
            err?.message ||
              "This reset link is invalid or has expired. Request a new one."
          );
          setCanReset(false);
        });
    }

    // Handle hash-based recovery links (#access_token=...&refresh_token=...&type=recovery)
    if (!sessionAttempted && typeof window !== "undefined") {
      const hash = window.location.hash || "";
      if (hash.startsWith("#")) {
        const params = new URLSearchParams(hash.slice(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        const typeParam = params.get("type");
        if (accessToken && refreshToken && typeParam === "recovery") {
          supabase.auth
            .setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            .then(({ error }) => {
              if (error) {
                setLinkError(
                  error.message ||
                    "This reset link is invalid or has expired. Request a new one."
                );
                setCanReset(false);
              } else {
                setCanReset(true);
                setLinkError(null);
              }
            })
            .catch((err) => {
              setLinkError(
                err?.message ||
                  "This reset link is invalid or has expired. Request a new one."
              );
              setCanReset(false);
            })
            .finally(() => setSessionAttempted(true));
        } else {
          setSessionAttempted(true);
        }
      } else {
        setSessionAttempted(true);
      }
    }

    return () => {
      authListener.subscription?.unsubscribe();
    };
  }, [supabase, searchParams, sessionAttempted]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword.trim() || !confirmPassword.trim()) {
      toast.error("Enter and confirm your new password.");
      return;
    }

    if (newPassword.trim().length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (error) {
        throw error;
      }

      toast.success("Password updated. You can now sign in.");
      router.push("/login");
      router.refresh();
    } catch (error: any) {
      const msg = error?.message || "Unable to update password. Try again.";
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
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-primary mb-2">
              Reset Password
            </h1>
            <p className="text-muted-foreground text-sm">
              Enter a new password for your account.
            </p>
          </div>

          <form onSubmit={handleReset} className="space-y-5">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition text-foreground"
                placeholder="••••••••"
                required
                minLength={8}
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 border border-input rounded-lg bg-background focus:ring-2 focus:ring-ring focus:border-transparent transition text-foreground"
                placeholder="Repeat new password"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading || !canReset}
              className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {loading ? "Updating password..." : "Update Password"}
            </button>

            {!canReset && (
              <p className="text-sm text-amber-600">
                Open this page from the password reset link we sent to your
                email to continue.
              </p>
            )}

            {linkError && (
              <p className="text-sm text-red-600">
                {linkError} If this link just expired, request a new reset email
                and use it within a few minutes.
              </p>
            )}
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-muted-foreground">
          <p>
            Return to{" "}
            <button
              onClick={() => router.push("/login")}
              className="text-primary hover:underline"
            >
              sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
          Loading...
        </div>
      }
    >
      <ResetPasswordClient />
    </Suspense>
  );
}