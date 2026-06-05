import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCutoffAttendance } from "@/lib/ph-payroll";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
import { fetchSessionsForEmployee } from "@/lib/timeEntries";
import { HOLIDAY_ELIGIBILITY_LOOKBACK_DAYS } from "@/utils/holidays";
import { subDays, format } from "date-fns";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function getDateInManila(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso));
  return `${parts.find((p) => p.type === "year")?.value}-${
    parts.find((p) => p.type === "month")?.value
  }-${parts.find((p) => p.type === "day")?.value}`;
}

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.nextUrl.searchParams.get("employee_id");
    const periodStart = req.nextUrl.searchParams.get("period_start");
    const periodEnd = req.nextUrl.searchParams.get("period_end");

    if (!employeeId || !periodStart || !periodEnd) {
      return NextResponse.json(
        { error: "employee_id, period_start, and period_end are required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();

    const { data: emp, error: empErr } = await admin
      .from("employees")
      .select("id, full_name, employment_type, position, eligible_for_ot")
      .eq("id", employeeId)
      .maybeSingle();

    if (empErr) throw empErr;
    if (!emp) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const { data: saved } = await admin
      .from("weekly_attendance")
      .select(
        "id, status, attendance_data, total_regular_hours, total_overtime_hours, total_night_diff_hours, finalized_at"
      )
      .eq("employee_id", employeeId)
      .eq("period_start", periodStart)
      .eq("period_end", periodEnd)
      .maybeSingle();

    const lookbackStart = format(
      subDays(new Date(`${periodStart}T12:00:00+08:00`), HOLIDAY_ELIGIBILITY_LOOKBACK_DAYS),
      "yyyy-MM-dd"
    );

    const holidays = (
      await fetchHolidaysRange(admin as any, {
        start: lookbackStart,
        end: periodEnd,
        lookbackDays: 0,
      })
    ).map((h) => ({
      holiday_date: h.date,
      holiday_type: h.type,
    }));

    const periodStartDate = new Date(`${periodStart}T12:00:00+08:00`);
    const periodEndDate = new Date(`${periodEnd}T12:00:00+08:00`);
    const fetchStart = new Date(`${lookbackStart}T00:00:00+08:00`).toISOString();
    const fetchEnd = new Date(`${periodEnd}T23:59:59+08:00`).toISOString();

    const sessions = await fetchSessionsForEmployee(
      admin,
      employeeId,
      fetchStart,
      fetchEnd,
      getDateInManila
    );

    const periodSessions = sessions.filter((s) => {
      if (!s.clock_in_time) return false;
      const d = getDateInManila(s.clock_in_time);
      return d >= periodStart && d <= periodEnd;
    });

    const isClientBased = emp.employment_type === "client-based";
    const isClientBasedAccountSupervisor =
      isClientBased &&
      String(emp.position || "")
        .toUpperCase()
        .includes("ACCOUNT SUPERVISOR");

    const live = buildCutoffAttendance({
      clockEntries: sessions as any,
      periodStart: periodStartDate,
      periodEnd: periodEndDate,
      holidays,
      isClientBased,
      isClientBasedAccountSupervisor,
      eligibleForOT: emp.eligible_for_ot !== false,
      clockEntriesForMap: periodSessions as any,
    });

    const source = saved ? "saved" : "live";
    const days =
      saved?.attendance_data && Array.isArray(saved.attendance_data)
        ? saved.attendance_data
        : live.attendance_data;

    return NextResponse.json({
      period_start: periodStart,
      period_end: periodEnd,
      source,
      timesheet_status: saved?.status ?? "preview",
      finalized_at: saved?.finalized_at ?? null,
      total_regular_hours: saved
        ? Number(saved.total_regular_hours || 0)
        : live.total_regular_hours,
      total_overtime_hours: saved
        ? Number(saved.total_overtime_hours || 0)
        : live.total_overtime_hours,
      total_night_diff_hours: saved
        ? Number(saved.total_night_diff_hours || 0)
        : live.total_night_diff_hours,
      days,
    });
  } catch (error: any) {
    console.error("employee my-timesheet error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load timesheet" },
      { status: 500 }
    );
  }
}
