import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function middleware(req: NextRequest) {
  // Skip middleware for static files (images, fonts, etc.)
  const pathname = req.nextUrl.pathname;
  const staticFileExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.woff', '.woff2', '.ttf', '.eot'];
  const isStaticFile = staticFileExtensions.some(ext => pathname.endsWith(ext));

  if (isStaticFile || pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  // Protected routes that require authentication check
  const protectedPaths = [
    "/dashboard",
    "/employees",
    "/timesheet",
    "/payslips",
    "/deductions",
    "/settings",
    "/overtime-approval",
    "/leave-approval",
    "/time-entries",
    "/failure-to-log-approval",
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    pathname.startsWith(path)
  );
  const isLoginPath = pathname === "/login";
  const isResetPasswordPath = pathname === "/reset-password";

  // Allow reset-password page without session check (needed for password recovery flow)
  // Only check session for protected routes or login page
  // This prevents unnecessary refresh attempts on public routes
  if (!isProtectedPath && !isLoginPath && !isResetPasswordPath) {
    return NextResponse.next();
  }

  // Skip session check for reset-password page (token exchange happens client-side)
  if (isResetPasswordPath) {
    return NextResponse.next();
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  // Wrap getSession in try-catch to handle rate limit errors gracefully
  let session = null;
  try {
    const sessionResult = await supabase.auth.getSession();
    session = sessionResult.data?.session ?? null;
  } catch (error: any) {
    // If rate limited or auth error, allow request to proceed
    // The app will handle authentication at the page level
    // This prevents middleware from creating a feedback loop
    console.error("Middleware auth check error:", error?.message || error);

    // For protected paths, redirect to login on error
    // For login path, allow access (user can try logging in)
    if (isProtectedPath) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectedFrom", pathname);
      redirectUrl.searchParams.set("error", "session_check_failed");
      return NextResponse.redirect(redirectUrl);
    }

    return res;
  }

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect HR users without salary access away from /employees and /payslips
  // Redirect OT approvers/viewers to OT approval page only
  if (session) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: userData } = await supabase
          .from("users")
          .select("role, can_access_salary")
          .eq("id", user.id)
          .eq("is_active", true)
          .single();

        if (userData) {
          const userRecord = userData as { role: string; can_access_salary: boolean | null };

          // Redirect approvers/viewers to allowed pages only
          // They can access: All Time & Attendance pages (OT Approvals, Leave Approvals, Time Attendance, Time Entries, Failure to Log)
          if (userRecord.role === "approver" || userRecord.role === "viewer") {
            const allowedPaths = [
              "/overtime-approval",
              "/leave-approval",
              "/timesheet",
              "/time-entries",
              "/failure-to-log-approval",
            ];
            const isAllowedPath = allowedPaths.some((path) =>
              pathname.startsWith(path)
            );

            if (!isAllowedPath) {
              const redirectUrl = req.nextUrl.clone();
              redirectUrl.pathname = "/overtime-approval";
              return NextResponse.redirect(redirectUrl);
            }
          }


          // Redirect HR users without salary access from /payslips only
          // HR can always view employees (as per role access matrix)
          if (
            userRecord.role === "hr" &&
            !userRecord.can_access_salary &&
            pathname.startsWith("/payslips")
          ) {
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = "/dashboard";
            return NextResponse.redirect(redirectUrl);
          }
        }
      }
    } catch (error: any) {
      // If getUser fails (e.g., rate limited), log but don't block
      // The page will handle the error appropriately
      console.error("Middleware getUser error:", error?.message || error);
    }
  }

  // Redirect to dashboard if accessing login with active session
  if (isLoginPath && session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};