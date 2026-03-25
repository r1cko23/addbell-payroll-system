import { format, startOfMonth } from "date-fns";
import {
  fetchProjectTimeSessionsForEmployee,
  fetchSessionsForEmployee,
} from "@/lib/timeEntries";

/** Matches `calculateMonthlySalary(..., 26)` — prorate vs a 26-day working month. */
export const STATUTORY_PRORATION_REFERENCE_DAYS = 26;

function defaultGetDateInManila(iso: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso));
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/**
 * Factor in [0, 1]: days worked from calendar month start through period end Tuesday ÷ 26.
 * Used to prorate SSS / PhilHealth / Pag-IBIG employee shares and (with same factor) tax base.
 */
export function statutoryProrationFactorFromDays(daysWorkedInMonth: number): number {
  if (!Number.isFinite(daysWorkedInMonth) || daysWorkedInMonth <= 0) return 0;
  return Math.min(1, daysWorkedInMonth / STATUTORY_PRORATION_REFERENCE_DAYS);
}

export function applyStatutoryProration(amount: number, factor: number): number {
  const f = Math.min(1, Math.max(0, factor));
  return Math.round(amount * f * 100) / 100;
}

/**
 * Distinct Manila dates with at least one completed session (main clock or project), in [monthStart, periodEnd].
 * Merges sessions for all given employee IDs (e.g. transfer predecessor).
 */
export async function fetchDistinctWorkDaysMonthToDate(
  supabase: unknown,
  employeeIds: string[],
  periodEndTuesday: Date,
  getDateInManila: (iso: string) => string = defaultGetDateInManila
): Promise<number> {
  const monthStart = startOfMonth(periodEndTuesday);
  const startStr = format(monthStart, "yyyy-MM-dd");
  const endStr = format(periodEndTuesday, "yyyy-MM-dd");

  const rangeStart = new Date(monthStart);
  rangeStart.setDate(rangeStart.getDate() - 1);
  rangeStart.setHours(0, 0, 0, 0);
  const rangeEnd = new Date(periodEndTuesday);
  rangeEnd.setDate(rangeEnd.getDate() + 1);
  rangeEnd.setHours(23, 59, 59, 999);

  const startIso = rangeStart.toISOString();
  const endIso = rangeEnd.toISOString();

  const dates = new Set<string>();
  const ids = [...new Set(employeeIds.filter(Boolean))];

  for (const empId of ids) {
    const [main, proj] = await Promise.all([
      fetchSessionsForEmployee(
        supabase,
        empId,
        startIso,
        endIso,
        getDateInManila
      ),
      fetchProjectTimeSessionsForEmployee(
        supabase,
        empId,
        startIso,
        endIso,
        getDateInManila
      ),
    ]);
    for (const s of [...main, ...proj]) {
      if (!s.clock_out_time) continue;
      const d =
        "clock_in_date_ph" in s && s.clock_in_date_ph
          ? s.clock_in_date_ph
          : getDateInManila(s.clock_in_time);
      if (d >= startStr && d <= endStr) dates.add(d);
    }
  }

  return dates.size;
}
