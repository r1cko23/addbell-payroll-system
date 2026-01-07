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

  const res = NextResponse.next();
  const supabase = createMiddlewareClient<Database>({ req, res });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes
  const protectedPaths = [
    "/dashboard",
    "/employees",
    "/timesheet",
    "/payslips",
    "/deductions",
    "/settings",
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    req.nextUrl.pathname.startsWith(path)
  );

  // Redirect to login if accessing protected route without session
  if (isProtectedPath && !session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Redirect HR users without salary access away from /employees and /payslips
  // Redirect OT approvers/viewers to OT approval page only
  if (session) {
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
            req.nextUrl.pathname.startsWith(path)
          );

          if (!isAllowedPath) {
            const redirectUrl = req.nextUrl.clone();
            redirectUrl.pathname = "/overtime-approval";
            return NextResponse.redirect(redirectUrl);
          }
        }


        // Redirect HR users without salary access from /employees and /payslips
        if (
          userRecord.role === "hr" &&
          !userRecord.can_access_salary &&
          (req.nextUrl.pathname.startsWith("/employees") ||
            req.nextUrl.pathname.startsWith("/payslips"))
        ) {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = "/dashboard";
          return NextResponse.redirect(redirectUrl);
        }
      }
    }
  }

  // Redirect to dashboard if accessing login with active session
  if (req.nextUrl.pathname === "/login" && session) {
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    return NextResponse.redirect(redirectUrl);
  }

  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};