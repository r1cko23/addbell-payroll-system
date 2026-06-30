import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchHolidaysRange } from "@/lib/holidays/fetchHolidays";
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
    const start = req.nextUrl.searchParams.get("start");
    const end = req.nextUrl.searchParams.get("end");
    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end are required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const holidays = await fetchHolidaysRange(admin as any, { start, end });
    return NextResponse.json({
      holidays: holidays.map((h) => ({ holiday_date: h.date })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
