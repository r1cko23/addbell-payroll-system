/**
 * Biometric punch webhook – ZKTeco LX50 and compatible devices
 *
 * POST /api/biometric/punch
 *
 * Accepts punches from ZKTeco PUSH/middleware or any client that sends:
 * - employee_code (or employee_id): map to employee — employee_code is digits-only (time clock / ZKTeco PIN)
 * - punched_at (ISO) or timestamp (YYYY-MM-DD HH:mm:ss)
 * - punch_type: "in" | "out"
 * - device_serial, device_name, office_location_id (optional)
 *
 * Auth: X-Biometric-Secret header must match BIOMETRIC_WEBHOOK_SECRET (or omit in dev if not set).
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export { dynamic } from "@/lib/api-route-segment";


function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get("x-biometric-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const expected = process.env.BIOMETRIC_WEBHOOK_SECRET;
    if (expected && secret !== expected) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const employeeCode = body.employee_code ?? body.pin ?? body.user_id ?? body.uid;
    const employeeIdRaw = body.employee_id;
    const punchedAtRaw = body.punched_at ?? body.timestamp ?? body.datetime;
    let punchType = (body.punch_type ?? body.state ?? body.type ?? "").toString().toLowerCase();
    const deviceSerial = body.device_serial ?? body.sn ?? body.device_id;
    const deviceName = body.device_name ?? body.device_label;
    const officeLocationId = body.office_location_id ?? body.location_id;

    if (!punchedAtRaw) {
      return NextResponse.json(
        { error: "Missing punched_at or timestamp" },
        { status: 400 }
      );
    }

    if (!employeeCode && !employeeIdRaw) {
      return NextResponse.json(
        { error: "Missing employee_code, pin, user_id, or employee_id" },
        { status: 400 }
      );
    }

    // Normalize punch_type: ZKTeco often uses state 0 = in, 1 = out
    if (punchType === "0" || punchType === "checkin" || punchType === "check_in") punchType = "in";
    if (punchType === "1" || punchType === "checkout" || punchType === "check_out") punchType = "out";
    if (punchType !== "in" && punchType !== "out") {
      return NextResponse.json(
        { error: "punch_type must be in or out" },
        { status: 400 }
      );
    }

    let punchedAt: string;
    if (typeof punchedAtRaw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(punchedAtRaw)) {
      punchedAt = new Date(punchedAtRaw).toISOString();
    } else if (typeof punchedAtRaw === "string" && /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}/.test(punchedAtRaw)) {
      punchedAt = new Date(punchedAtRaw.replace(" ", "T") + "Z").toISOString();
    } else {
      punchedAt = new Date(punchedAtRaw).toISOString();
    }

    const supabase = getSupabaseAdmin();
    let employeeId: string | null = employeeIdRaw || null;

    if (!employeeId && employeeCode != null) {
      const codeStr = String(employeeCode).trim();
      let emp: { id: string } | null = null;
      const { data: byCode } = await supabase
        .from("employees")
        .select("id")
        .eq("employee_code", codeStr)
        .eq("employment_status", "active")
        .maybeSingle();
      if (byCode) emp = byCode;
      if (!emp) {
        const { data: byId } = await supabase
          .from("employees")
          .select("id")
          .eq("id", codeStr)
          .eq("employment_status", "active")
          .maybeSingle();
        if (byId) emp = byId;
      }
      if (!emp) {
        return NextResponse.json(
          { error: "Employee not found or inactive", employee_code: employeeCode },
          { status: 404 }
        );
      }
      employeeId = emp.id;
    }

    if (!employeeId) {
      return NextResponse.json(
        { error: "Could not resolve employee_id" },
        { status: 400 }
      );
    }

    const deviceInfo = [deviceName, deviceSerial].filter(Boolean).join(" | ") || "ZKTeco/biometric";

    const { data: row, error } = await supabase
      .from("time_entries")
      .insert({
        employee_id: employeeId,
        punch_type: punchType,
        punched_at: punchedAt,
        source: "biometric",
        device_serial: deviceSerial || null,
        office_location_id: officeLocationId || null,
        device_info: deviceInfo,
      })
      .select("id, punched_at, punch_type")
      .single();

    if (error) {
      console.error("Biometric punch insert error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      id: row.id,
      punched_at: row.punched_at,
      punch_type: row.punch_type,
      employee_id: employeeId,
    });
  } catch (e) {
    console.error("Biometric punch error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 }
    );
  }
}
