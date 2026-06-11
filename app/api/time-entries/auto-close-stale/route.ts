import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { applyAllStaleBundyAutoClockOutsForEmployees } from "@/lib/bundy-auto-clock-out";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const singleId = String(body?.employee_id || "").trim();
    const batchIds = Array.isArray(body?.employee_ids)
      ? body.employee_ids.map((id: unknown) => String(id || "").trim()).filter(Boolean)
      : [];

    const employeeIds = singleId
      ? [singleId, ...batchIds.filter((id: string) => id !== singleId)]
      : batchIds;

    if (employeeIds.length === 0) {
      return NextResponse.json(
        { error: "employee_id or employee_ids is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const result = await applyAllStaleBundyAutoClockOutsForEmployees(
      admin,
      employeeIds
    );

    return NextResponse.json({
      success: true,
      total_closed: result.totalClosed,
      by_employee: result.byEmployee,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("auto-close-stale error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
