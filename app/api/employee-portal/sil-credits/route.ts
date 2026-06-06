/**
 * Employee portal: read SIL balance from employees.sil_credits (service role).
 * Portal sessions are not Supabase JWTs, so client-side SELECT is blocked by RLS.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SIL_ANNUAL_ALLOTMENT } from "@/lib/employee-sil-display";

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
    if (!employeeId) {
      return NextResponse.json(
        { error: "employee_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("employees")
      .select("sil_credits")
      .eq("id", employeeId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const silCredits =
      data.sil_credits != null ? Number(data.sil_credits) : 0;

    return NextResponse.json({
      sil_credits: Number.isFinite(silCredits) ? silCredits : 0,
      sil_annual_allotment: SIL_ANNUAL_ALLOTMENT,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
