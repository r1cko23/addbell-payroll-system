/**
 * Employee portal: load time_entries for an employee (service role).
 * Client has no Supabase JWT; RLS requires auth.uid() = employee_id for SELECT.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");
    const limitStr = req.nextUrl.searchParams.get("limit");
    const limit = Math.min(
      Math.max(parseInt(limitStr || "100", 10) || 100, 1),
      500
    );

    const admin = getAdminClient();
    let q = admin
      .from("time_entries")
      .select(
        "id, employee_id, punch_type, punched_at, lat, lng, device_info"
      )
      .eq("employee_id", employeeId)
      .order("punched_at", { ascending: false })
      .limit(limit);

    if (start) {
      q = q.gte("punched_at", start);
    }
    if (end) {
      q = q.lte("punched_at", end);
    }

    const { data, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ punches: data || [] });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
