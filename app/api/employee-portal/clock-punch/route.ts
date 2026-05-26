/**
 * Employee portal Bundy clock in/out — inserts time_entries using service role.
 * Client-side Supabase has no JWT for portal users (session is localStorage-only),
 * so direct inserts fail RLS (employee_id = auth.uid()). This route matches other
 * employee-portal APIs that use the admin client.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyBundyAutoClockOutIfNeeded } from "@/lib/bundy-auto-clock-out";
import { getBundyBusinessDayKey } from "@/lib/bundy-business-day";
import {
  getDateInManilaDefault,
  getOpenEntryFromPunches,
  type TimeEntryPunch,
} from "@/lib/timeEntries";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      employee_id?: string;
      punch_type?: "in" | "out";
      lat?: number;
      lng?: number;
      device_info?: string | null;
    };

    if (!body?.employee_id || !body?.punch_type) {
      return NextResponse.json(
        { error: "employee_id and punch_type are required" },
        { status: 400 }
      );
    }
    if (body.punch_type !== "in" && body.punch_type !== "out") {
      return NextResponse.json(
        { error: "punch_type must be in or out" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    try {
      await applyBundyAutoClockOutIfNeeded(admin, body.employee_id);
    } catch (autoErr) {
      console.error("Bundy auto clock-out:", autoErr);
    }

    const { data: serverTimeData, error: timeError } = await admin.rpc(
      "get_server_time"
    );
    if (timeError || serverTimeData == null) {
      return NextResponse.json(
        { error: timeError?.message || "Could not get server time" },
        { status: 500 }
      );
    }
    const punchedAt = new Date(serverTimeData as string).toISOString();

    const { data: recentPunches } = await admin
      .from("time_entries")
      .select("id, employee_id, punch_type, punched_at")
      .eq("employee_id", body.employee_id)
      .order("punched_at", { ascending: false })
      .limit(100);
    const punchList = (recentPunches || []) as TimeEntryPunch[];
    const activeBiz = getBundyBusinessDayKey(punchedAt);
    const open = getOpenEntryFromPunches(
      punchList,
      getDateInManilaDefault,
      activeBiz
    );

    if (body.punch_type === "in") {
      if (open) {
        return NextResponse.json(
          {
            error:
              "You already have an open Time In. Clock out first before starting another session.",
          },
          { status: 409 }
        );
      }
    } else if (!open) {
      return NextResponse.json(
        {
          error:
            "No open Time In found for this business day. Clock in before clocking out.",
        },
        { status: 409 }
      );
    }

    const { data: insertData, error: insertError } = await admin
      .from("time_entries")
      .insert({
        employee_id: body.employee_id,
        punch_type: body.punch_type,
        punched_at: punchedAt,
        lat: body.lat ?? null,
        lng: body.lng ?? null,
        device_info: body.device_info ?? null,
      })
      .select("id, punched_at")
      .single();

    if (insertError || !insertData) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to record punch" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      id: insertData.id,
      punched_at: insertData.punched_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
