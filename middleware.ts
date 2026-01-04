import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function middleware(req: NextRequest) {
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

  // Redirect Account Managers and HR users without salary access away from /employees and /payslips
  if (
    session &&
    (req.nextUrl.pathname.startsWith("/employees") ||
      req.nextUrl.pathname.startsWith("/payslips"))
  ) {
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
        
        // Redirect Account Managers
        if (userRecord.role === "account_manager") {
          const redirectUrl = req.nextUrl.clone();
          redirectUrl.pathname = "/dashboard";
          return NextResponse.redirect(redirectUrl);
        }
        
        // Redirect HR users without salary access
        if (userRecord.role === "hr" && !userRecord.can_access_salary) {
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