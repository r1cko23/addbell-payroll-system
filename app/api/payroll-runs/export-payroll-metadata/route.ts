import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { format, subMonths } from "date-fns";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
export { dynamic } from "@/lib/api-route-segment";


function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service-role configuration");
  return createClient(url, key, { auth: { persistSession: false } });
}

function formatHolidayRange(dates: Date[]) {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const monthLabel = format(sorted[0], "MMMM");
  const days = [...new Set(sorted.map((d) => format(d, "d")))];
  if (days.length === 1) return `${monthLabel} ${days[0]}`;
  if (days.length === 2) return `${monthLabel} ${days[0]}-${days[1]}`;
  return `${monthLabel} ${days[0]}-${days[days.length - 1]}`;
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const payroll_run_id = body?.payroll_run_id as string | undefined;
    if (!payroll_run_id) {
      return NextResponse.json({ error: "payroll_run_id is required" }, { status: 400 });
    }

    const admin = getAdminClient();
    const { data: run, error: runErr } = await admin
      .from("payroll_runs")
      .select("id, cutoff_start, cutoff_end")
      .eq("id", payroll_run_id)
      .single();
    if (runErr) throw runErr;
    if (!run) return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });

    const cutoffStart = String(run.cutoff_start);
    const cutoffEnd = String(run.cutoff_end);
    const startD = new Date(cutoffStart);

    let nonWorkingLabel = "Non-working holiday";
    let regularHolidayLabel = "REG HOL";
    try {
      const holidaysNormalized = await fetchHolidaysRange(admin as any, {
        start: cutoffStart,
        end: cutoffEnd,
      });
      const parsed = holidaysNormalized
        .map((h) => ({
          date: new Date(String(h.date).split("T")[0]),
          isRegular: h.type === "regular",
        }))
        .filter((h) => Number.isFinite(h.date.getTime()));

      const regularDates = parsed.filter((h) => h.isRegular).map((h) => h.date);
      const specialDates = parsed.filter((h) => !h.isRegular).map((h) => h.date);
      const regRange = formatHolidayRange(regularDates);
      const specRange = formatHolidayRange(specialDates);
      if (specRange) nonWorkingLabel = `Non-working holiday ${specRange}`;
      if (regRange) regularHolidayLabel = `REG HOL  ${regRange}`;
    } catch {
      // keep defaults
    }

    const allowanceMonthLabel = format(subMonths(startD, 2), "MMM  yyyy");
    const allowancesHeader = ` Allowances for ${allowanceMonthLabel}/load `;

    return NextResponse.json({
      success: true,
      cutoff_start: cutoffStart,
      cutoff_end: cutoffEnd,
      nonWorkingLabel,
      regularHolidayLabel,
      allowancesHeader,
    });
  } catch (error: any) {
    console.error("Error building payroll export metadata:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to build payroll export metadata" },
      { status: 500 }
    );
  }
}

