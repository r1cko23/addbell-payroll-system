/**
 * SIL balance, computed from leave requests (no stored counter to drift).
 * Policy (HR, 2026-11-12): 5 days per calendar year (Jan–Dec), full 5 from day one,
 * unused days expire at year end.
 */

import { SIL_ANNUAL_ALLOTMENT } from "@/lib/employee-sil-display";
import { getManilaTodayYmd } from "@/lib/bundy-business-day";
import { selectInBatches } from "@/lib/supabase-in-batches";

/** Stored leave_type values that the app labels and pays as SIL. */
const SIL_LEAVE_TYPES = new Set(["sil", "sick leave", "service incentive leave", "regular_sil"]);

export function isSilLeaveType(leaveType: string | null | undefined): boolean {
  return SIL_LEAVE_TYPES.has((leaveType ?? "").trim().toLowerCase());
}

export type SilLeaveRow = {
  employee_id: string;
  leave_type: string;
  status: string;
  start_date: string;
  total_days: number | string | null;
  selected_dates?: unknown;
  half_day_dates?: unknown;
};

export const SIL_LEAVE_COLUMNS =
  "employee_id, leave_type, status, start_date, total_days, selected_dates, half_day_dates";

const APPROVED = "approved_by_hr";
const PENDING_STATUSES = new Set(["pending", "approved_by_pm", "approved_by_manager"]);

/** Days of this request that fall in `year` (half days count 0.5). */
export function silDaysInYear(row: SilLeaveRow, year: string): number {
  const dates = Array.isArray(row.selected_dates) ? (row.selected_dates as string[]) : [];
  if (dates.length === 0) {
    // Old rows without selected dates: whole request goes to its start year.
    return row.start_date?.startsWith(year) ? Number(row.total_days) || 0 : 0;
  }
  const halfDays = new Set(Array.isArray(row.half_day_dates) ? (row.half_day_dates as string[]) : []);
  return dates
    .filter((d) => d.startsWith(year))
    .reduce((sum, d) => sum + (halfDays.has(d) ? 0.5 : 1), 0);
}

export type SilBalance = {
  /** Approved SIL days this year. */
  used: number;
  /** SIL days still awaiting approval this year. */
  pending: number;
  /** Allotment − used. Shown to HR when deciding a pending request. */
  remaining: number;
  /** Allotment − used − pending. What the employee can still file. */
  available: number;
};

export function computeSilBalance(rows: SilLeaveRow[], year: string): SilBalance {
  let used = 0;
  let pending = 0;
  for (const row of rows) {
    if (!isSilLeaveType(row.leave_type)) continue;
    const days = silDaysInYear(row, year);
    if (row.status === APPROVED) used += days;
    else if (PENDING_STATUSES.has(row.status)) pending += days;
  }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    used: round(used),
    pending: round(pending),
    remaining: round(Math.max(0, SIL_ANNUAL_ALLOTMENT - used)),
    available: round(Math.max(0, SIL_ANNUAL_ALLOTMENT - used - pending)),
  };
}

export function currentSilYear(now: Date = new Date()): string {
  return getManilaTodayYmd(now).slice(0, 4);
}

/** Loads this year's SIL balance for each employee id (server-side; batched `.in()`). */
export async function fetchSilBalances(
  supabase: any,
  employeeIds: string[],
  year: string = currentSilYear()
): Promise<Map<string, SilBalance>> {
  const { data, error } = await selectInBatches<SilLeaveRow>(employeeIds, (ids) =>
    supabase
      .from("leave_requests")
      .select(SIL_LEAVE_COLUMNS)
      .in("employee_id", ids)
      // Rows starting before the year can still hold dates in it (Dec→Jan leave).
      .gte("end_date", `${year}-01-01`)
      .lte("start_date", `${year}-12-31`)
  );
  if (error) throw new Error(error.message);
  const byEmployee = new Map<string, SilLeaveRow[]>();
  for (const row of data) {
    const list = byEmployee.get(row.employee_id) ?? [];
    list.push(row);
    byEmployee.set(row.employee_id, list);
  }
  return new Map(
    employeeIds.map((id) => [id, computeSilBalance(byEmployee.get(id) ?? [], year)])
  );
}
