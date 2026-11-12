/**
 * Employee portal: SIL balance computed from this year's leave requests (service role).
 * Portal sessions are not Supabase JWTs, so client-side SELECT is blocked by RLS.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePortalEmployee } from "@/lib/portal-session";
import { createClient } from "@supabase/supabase-js";
import { SIL_ANNUAL_ALLOTMENT } from "@/lib/employee-sil-display";
import { fetchSilBalances } from "@/lib/sil-balance";
export { dynamic } from "@/lib/api-route-segment";


function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    const portal = requirePortalEmployee(employeeId);
    if (portal instanceof NextResponse) return portal;
    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const balance = (await fetchSilBalances(admin, [employeeId])).get(employeeId)!;

    return NextResponse.json({
      // What the employee can still file: allotment − approved − pending this year.
      sil_credits: balance.available,
      sil_used: balance.used,
      sil_pending: balance.pending,
      sil_annual_allotment: SIL_ANNUAL_ALLOTMENT,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
