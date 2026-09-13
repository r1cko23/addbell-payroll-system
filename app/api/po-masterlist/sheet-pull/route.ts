import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { getAdminClient } from "@/lib/fund-request-api";
import { mergePermissions } from "@/lib/permissions";
import { isAddBellMasterlistImportConfigured } from "@/lib/po-masterlist-sheet-import";
import { pullPoMasterlistFromSheet } from "@/lib/po-masterlist-sheet-pull";
import { normalizeUserRole } from "@/lib/user-roles";

export { dynamic } from "@/lib/api-route-segment";

function hasValidCronSecret(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (auth === `Bearer ${secret}`) return true;
  const headerSecret = req.headers.get("x-cron-secret")?.trim() ?? "";
  return headerSecret === secret;
}

async function hasPullAccess(): Promise<boolean> {
  const supabase = createServerComponentClient<Database>({ cookies });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, permissions, is_active, employee_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active) return false;

  const role = normalizeUserRole(profile.role);
  if (role !== "admin" && role !== "operations_manager") return false;

  const permissions = mergePermissions(
    profile.role,
    profile.permissions as Parameters<typeof mergePermissions>[1],
    {
      userId: user.id,
      employeeId: (profile as { employee_id?: string | null }).employee_id ?? null,
    }
  );
  return permissions.projects.read;
}

/**
 * Pull ADD-BELL masterlist rows from Google Sheets into po_masterlist_jobs.
 * Auth: Vercel cron (`Authorization: Bearer CRON_SECRET`) or admin/OM.
 */
export async function POST(req: NextRequest) {
  try {
    const allowed = hasValidCronSecret(req) || (await hasPullAccess());
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!isAddBellMasterlistImportConfigured()) {
      return NextResponse.json(
        { error: "Google Sheets P.O. masterlist is not configured." },
        { status: 500 }
      );
    }

    const result = await pullPoMasterlistFromSheet(getAdminClient());
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to pull masterlist from Google Sheets",
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
