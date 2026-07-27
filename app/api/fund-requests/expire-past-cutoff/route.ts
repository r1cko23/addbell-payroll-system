import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { expirePastCutoffFundRequests } from "@/lib/fund-request-cutoff-expiry";
import { normalizeUserRole } from "@/lib/user-roles";
export { dynamic } from "@/lib/api-route-segment";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function hasValidCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  return headerSecret === secret;
}

async function hasDashboardAccess(): Promise<boolean> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = normalizeUserRole(profile?.role);
  return (
    role === "admin" ||
    role === "upper_management" ||
    role === "purchasing_officer" ||
    role === "operations_manager" ||
    role === "hr"
  );
}

/**
 * Auto-cancel OM/PO fund requests after their filing cutoff week ends.
 * Auth: Vercel cron (`Authorization: Bearer CRON_SECRET`) or logged-in dashboard user.
 */
export async function POST(req: NextRequest) {
  try {
    const allowed = hasValidCronSecret(req) || (await hasDashboardAccess());
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const result = await expirePastCutoffFundRequests(adminClient());
    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          expired_count: result.expiredIds.length,
          expired_ids: result.expiredIds,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      expired_count: result.expiredIds.length,
      expired_ids: result.expiredIds,
      skipped: result.skipped,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    console.error("expire-past-cutoff error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
