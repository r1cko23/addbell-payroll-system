/**
 * Employee portal: load time_entries for an employee (service role).
 * Client has no Supabase JWT; RLS requires auth.uid() = employee_id for SELECT.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  BUNDY_OPEN_SESSION_PUNCH_LIMIT,
  resolveOpenBundySessionAfterAutoClose,
} from "@/lib/bundy-auto-clock-out";
import { cachedJson } from "@/lib/cache";

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

    const loadPunches = async () => {
      try {
        await resolveOpenBundySessionAfterAutoClose(admin, employeeId);
      } catch (autoErr) {
        console.error("Bundy auto clock-out:", autoErr);
      }

      const fetchLimit = Math.max(limit, BUNDY_OPEN_SESSION_PUNCH_LIMIT);

      let q = admin
        .from("time_entries")
        .select(
          "id, employee_id, punch_type, punched_at, lat, lng, device_info, office_location_id, source"
        )
        .eq("employee_id", employeeId)
        .order("punched_at", { ascending: false })
        .limit(fetchLimit);

      if (start) {
        q = q.gte("punched_at", start);
      }
      if (end) {
        q = q.lte("punched_at", end);
      }

      const { data, error } = await q;

      if (error) {
        throw new Error(error.message);
      }

      return { punches: data || [] };
    };

    // Period/range reads can be cached. Open-session checks (no start/end) stay live.
    if (start && end) {
      const { data: cached, cache } = await cachedJson(
        ["ep", "time-entries", employeeId, start, end, limit],
        loadPunches,
        60
      );
      return NextResponse.json(cached, { headers: { "X-Cache": cache } });
    }

    const payload = await loadPunches();
    return NextResponse.json(payload, { headers: { "X-Cache": "BYPASS" } });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
