/**
 * Year-end payout: 13th month pay + cash conversion of unused SIL, paid together in December
 * (accountant's "13th-Month-pay-2026-Manpower" sheet and the SUMMARY sheet's "5 DAYS VL" column).
 *
 * - 13th month year = weekly cutoffs ending after the 2nd Tuesday of December of the previous
 *   year, through the 2nd Tuesday of December of this year (2026: Dec 10, 2025 – Dec 8, 2026).
 * - 13th month = basic pay for days worked in those cutoffs ÷ 12, counted like HR's sheet:
 *   regular-day hours ÷ 8 × rate. Holidays and paid leave (SIL) days are left out.
 * - SIL cash = unused SIL days this calendar year × current daily rate. Not part of the 13th month base.
 */

import { format } from "date-fns";
import { computeSilBalance, type SilLeaveRow } from "@/lib/sil-balance";
import { payslipBasicPay, type ContributionMonthPayslip } from "@/lib/month-after-statutory";
import { isUnpaidLeaveType } from "@/utils/holidays";
import { ratePerDayAndHourFromProfile } from "@/lib/payslip-display";

const round2 = (n: number) => Math.round(n * 100) / 100;

function secondTuesdayOfDecember(year: number): Date {
  const d = new Date(year, 11, 1);
  while (d.getDay() !== 2) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7);
  return d;
}

/** Cutoffs with period_end in (afterEnd, throughEnd] belong to this 13th month year. */
export function thirteenthMonthWindow(year: number): { afterEnd: string; throughEnd: string } {
  return {
    afterEnd: format(secondTuesdayOfDecember(year - 1), "yyyy-MM-dd"),
    throughEnd: format(secondTuesdayOfDecember(year), "yyyy-MM-dd"),
  };
}

export type YearEndEmployee = {
  id: string;
  employee_id: string | null;
  full_name: string | null;
  salary_basis?: string | null;
  base_rate?: number | null;
};

export type YearEndPayslip = ContributionMonthPayslip & {
  employee_id: string;
  period_start: string;
};

export type YearEndRow = {
  employeeId: string;
  code: string;
  name: string;
  /** Earliest saved payslip in the window; later than the window start means earlier weeks are not in the app. */
  firstCutoff: string | null;
  basic: number;
  thirteenthMonth: number;
  silUnusedDays: number;
  dailyRate: number;
  silCash: number;
  total: number;
};

export type YearEndLeaveRow = SilLeaveRow & { end_date?: string | null };

/** Approved paid-leave dates → "full" or "half" day (LWOP excluded). */
export function paidLeaveDays(rows: YearEndLeaveRow[]): Map<string, "full" | "half"> {
  const out = new Map<string, "full" | "half">();
  for (const r of rows) {
    if (r.status !== "approved_by_hr" || isUnpaidLeaveType(r.leave_type)) continue;
    const half = new Set(Array.isArray(r.half_day_dates) ? (r.half_day_dates as string[]) : []);
    let dates = Array.isArray(r.selected_dates) ? (r.selected_dates as string[]) : [];
    if (dates.length === 0 && r.start_date) {
      dates = [];
      for (let d = new Date(`${r.start_date}T00:00:00`); format(d, "yyyy-MM-dd") <= (r.end_date ?? r.start_date); d.setDate(d.getDate() + 1)) {
        dates.push(format(d, "yyyy-MM-dd"));
      }
    }
    for (const d of dates) out.set(d, half.has(d) ? "half" : "full");
  }
  return out;
}

type StoredDay = { date?: string; dayType?: string; regularHours?: number; leaveHours?: number };
type StoredBreakdown = {
  attendance_data?: StoredDay[];
  payroll_result?: { breakdown?: { regularPay?: number }[] };
};

/** Basic pay for days worked on regular days (no holidays, no paid leave), from one saved payslip. */
export function thirteenthMonthBasicPay(
  p: ContributionMonthPayslip,
  paidLeave: Map<string, "full" | "half">
): number {
  const eb = p.earnings_breakdown as StoredBreakdown | null | undefined;
  const days = eb?.attendance_data ?? [];
  const pays = eb?.payroll_result?.breakdown ?? [];
  // shortcut: payslips saved without daily attendance fall back to their whole basic; re-save them to split out leave/holidays.
  if (days.length === 0 || days.length !== pays.length) return payslipBasicPay(p);
  let total = 0;
  days.forEach((day, i) => {
    const reg = Number(day.regularHours) || 0;
    if ((day.dayType ?? "regular") !== "regular" || reg <= 0) return;
    const leave = paidLeave.get(day.date ?? "");
    const leaveHours =
      day.leaveHours != null ? Number(day.leaveHours) : leave === "full" ? reg : leave === "half" ? 4 : 0;
    const worked = Math.max(0, reg - leaveHours);
    total += (Number(pays[i]?.regularPay) || 0) * (worked / reg);
  });
  return total;
}

export function buildYearEndRows(
  employees: YearEndEmployee[],
  payslips: YearEndPayslip[],
  leaves: YearEndLeaveRow[],
  year: number
): YearEndRow[] {
  const byEmployee = new Map<string, YearEndPayslip[]>();
  for (const p of payslips) {
    const list = byEmployee.get(p.employee_id) ?? [];
    list.push(p);
    byEmployee.set(p.employee_id, list);
  }
  const leavesByEmployee = new Map<string, YearEndLeaveRow[]>();
  for (const l of leaves) {
    const list = leavesByEmployee.get(l.employee_id) ?? [];
    list.push(l);
    leavesByEmployee.set(l.employee_id, list);
  }

  return employees
    .filter((e) => byEmployee.has(e.id))
    .map((e) => {
      const slips = byEmployee.get(e.id)!;
      const empLeaves = leavesByEmployee.get(e.id) ?? [];
      const paidLeave = paidLeaveDays(empLeaves);
      const basic = round2(slips.reduce((s, p) => s + thirteenthMonthBasicPay(p, paidLeave), 0));
      const thirteenthMonth = round2(basic / 12);
      const silUnusedDays = computeSilBalance(empLeaves, String(year)).remaining;
      const dailyRate = round2(
        ratePerDayAndHourFromProfile({
          employee_id: e.employee_id ?? "",
          full_name: e.full_name ?? "",
          salary_basis: e.salary_basis ?? null,
          base_rate: e.base_rate ?? null,
        }).perDay
      );
      const silCash = round2(silUnusedDays * dailyRate);
      return {
        employeeId: e.id,
        code: e.employee_id ?? "",
        name: e.full_name ?? "",
        firstCutoff: slips.map((p) => p.period_start).sort()[0] ?? null,
        basic,
        thirteenthMonth,
        silUnusedDays,
        dailyRate,
        silCash,
        total: round2(thirteenthMonth + silCash),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}
