import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeHolidays, PH_HOLIDAYS_FALLBACK } from "@/utils/holidays";

export type HolidayNormalized = {
  date: string; // YYYY-MM-DD
  name: string;
  type: "regular" | "non-working";
};

export async function fetchHolidaysRange(
  supabase: SupabaseClient,
  params: {
    start: string; // YYYY-MM-DD
    end: string; // YYYY-MM-DD
    lookbackDays?: number; // for consecutive-holiday eligibility
    allowFallback?: boolean;
  }
): Promise<HolidayNormalized[]> {
  const { start, end, lookbackDays = 0, allowFallback = true } = params;

  const startDate = new Date(`${start}T00:00:00`);
  if (Number.isFinite(lookbackDays) && lookbackDays > 0) {
    startDate.setDate(startDate.getDate() - lookbackDays);
  }
  const startStr = startDate.toISOString().split("T")[0];

  let holidays: HolidayNormalized[] = [];
  try {
    const { data, error } = await supabase
      .from("holidays")
      .select("holiday_date, name, is_regular")
      .gte("holiday_date", startStr)
      .lte("holiday_date", end);

    if (error) {
      console.warn("Error fetching holidays:", error);
    } else {
      holidays = normalizeHolidays(
        (data || []).map((h: any) => ({
          date: String(h.holiday_date),
          name: String(h.name ?? ""),
          type: h.is_regular ? "regular" : "non-working",
        }))
      );
    }
  } catch (e) {
    console.warn("Error fetching holidays (exception):", e);
  }

  if (!allowFallback) return holidays;

  if (holidays.length === 0) {
    holidays = PH_HOLIDAYS_FALLBACK.filter((h) => {
      const d = String(h.date || "").split("T")[0];
      return d >= startStr && d <= end;
    });
  }

  return holidays;
}

