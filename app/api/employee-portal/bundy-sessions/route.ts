import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyBundyAutoClockOutIfNeeded } from "@/lib/bundy-auto-clock-out";
import { getBundyBusinessDayKey } from "@/lib/bundy-business-day";
import { buildUsedOtPairKeys, validateBundyOtSessionPair } from "@/lib/validate-bundy-ot-session";
import {
  listCompletedBundySessions,
  sessionPairKey,
} from "@/lib/bundy-sessions";
import {
  getOpenEntryFromPunches,
  getDateInManilaDefault,
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

function ymdMinusDays(ymd: string, days: number): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  dt.setUTCDate(dt.getUTCDate() - days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
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

    const businessDayParam = req.nextUrl.searchParams.get("business_day");
    const otDateParam = req.nextUrl.searchParams.get("ot_date");

    const admin = getAdminClient();

    try {
      await applyBundyAutoClockOutIfNeeded(admin, employeeId);
    } catch (autoErr) {
      console.error("Bundy auto clock-out:", autoErr);
    }

    const { data: punches, error: punchError } = await admin
      .from("time_entries")
      .select(
        "id, employee_id, punch_type, punched_at, lat, lng, device_info, office_location_id"
      )
      .eq("employee_id", employeeId)
      .order("punched_at", { ascending: false })
      .limit(200);

    if (punchError) {
      return NextResponse.json({ error: punchError.message }, { status: 500 });
    }

    const punchList = (punches || []) as TimeEntryPunch[];

    const { data: otRows } = await admin
      .from("overtime_requests")
      .select("bundy_in_punch_id, bundy_out_punch_id, status")
      .eq("employee_id", employeeId)
      .not("bundy_in_punch_id", "is", null);

    const usedPairKeys = buildUsedOtPairKeys(otRows || []);

    // OT filing: show pairs for anchor date's business day + 1 calendar day before.
    const anchorYmd =
      otDateParam || getDateInManilaDefault(new Date().toISOString());
    const prevYmd = ymdMinusDays(anchorYmd, 1);
    const currentBizKey = getBundyBusinessDayKey(`${anchorYmd}T12:00:00+08:00`);
    const prevBizKey = prevYmd
      ? getBundyBusinessDayKey(`${prevYmd}T12:00:00+08:00`)
      : null;
    const allowedBusinessDayKeys = new Set<string>(
      [currentBizKey, prevBizKey].filter((k): k is string => Boolean(k))
    );

    const businessDayKey = businessDayParam || undefined;

    const sessions = listCompletedBundySessions(punchList, {
      businessDayKey,
      allowedBusinessDayKeys,
      excludePairsUsedByOt: usedPairKeys,
      // For OT filing, only allow pairs beyond the first session of the business day.
      excludeFirstSessionPerBusinessDay: true,
    });

    const activeBusinessDay = getBundyBusinessDayKey(new Date());
    const openSession = getOpenEntryFromPunches(
      punchList,
      getDateInManilaDefault,
      activeBusinessDay
    );

    return NextResponse.json({
      sessions,
      used_pair_keys: Array.from(usedPairKeys),
      active_business_day: activeBusinessDay,
      has_open_clock_in: Boolean(openSession),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Preview OT times from a selected pair (validation only). */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      employee_id?: string;
      in_punch_id?: string;
      out_punch_id?: string;
    };
    if (!body.employee_id || !body.in_punch_id || !body.out_punch_id) {
      return NextResponse.json(
        { error: "employee_id, in_punch_id, and out_punch_id are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data: punches } = await admin
      .from("time_entries")
      .select("id, employee_id, punch_type, punched_at, lat, lng")
      .eq("employee_id", body.employee_id)
      .order("punched_at", { ascending: true })
      .limit(200);

    const { data: otRows } = await admin
      .from("overtime_requests")
      .select("bundy_in_punch_id, bundy_out_punch_id, status")
      .eq("employee_id", body.employee_id)
      .not("bundy_in_punch_id", "is", null);

    const usedPairKeys = buildUsedOtPairKeys(otRows || []);
    const validated = validateBundyOtSessionPair({
      punches: (punches || []) as TimeEntryPunch[],
      inPunchId: body.in_punch_id,
      outPunchId: body.out_punch_id,
      usedPairKeys,
    });

    if ("error" in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    return NextResponse.json({
      session: validated.session,
      pair_span_hours: validated.session.total_hours,
      pair_key: sessionPairKey(body.in_punch_id, body.out_punch_id),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
