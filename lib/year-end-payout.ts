/**
 * Year-end payout: 13th month pay + cash conversion of unused SIL, paid together in December.
 *
 * Basic pay comes from HR's 13th month workbook (e.g. "13th-Month-pay-2026-Manpower.xlsx"),
 * because most employees' weekly payroll before and outside the app lives only there.
 * Each sheet (Admin, Manpower) has a header row with "RATE" in column D, then per employee:
 *   - week columns: days worked that week,
 *   - "Total days …" / "Amount" columns closing a rate period (Amount = days × rate),
 *   - "New Rate" columns starting the next rate period.
 * Basic = all Amount cells + days in weeks not yet closed by an Amount × the latest rate.
 *
 * 13th month = basic ÷ 12. SIL cash = unused SIL days this year (app leave records) × the sheet's
 * latest daily rate, for employees still active in the app (leavers are settled in final pay).
 */

import * as XLSX from "xlsx";
import { computeSilBalance, type SilLeaveRow } from "@/lib/sil-balance";
import { ratePerDayAndHourFromProfile } from "@/lib/payslip-display";

const round2 = (n: number) => Math.round(n * 100) / 100;
/** A week has at most 6 workdays; anything larger in a week column is a total typed in the wrong cell. */
const MAX_DAYS_PER_WEEK = 7;

export type SheetEmployee = {
  sheet: string;
  code: string;
  name: string;
  basic: number;
  /** Latest daily rate in the sheet (HR keeps it current; the app's rate can lag a raise). */
  rate: number;
  /** Cells skipped because they could not be days in one week. */
  skipped: string[];
};

function cell(ws: XLSX.WorkSheet, r: number, c: number): unknown {
  return ws[XLSX.utils.encode_cell({ r, c })]?.v;
}

export function parseThirteenthMonthWorkbook(wb: XLSX.WorkBook): SheetEmployee[] {
  const out: SheetEmployee[] = [];
  for (const sheet of wb.SheetNames) {
    const ws = wb.Sheets[sheet];
    if (!ws?.["!ref"]) continue;
    const range = XLSX.utils.decode_range(ws["!ref"]);
    let headerRow = -1;
    for (let r = 0; r <= Math.min(range.e.r, 15); r++) {
      if (String(cell(ws, r, 3) ?? "").trim().toUpperCase() === "RATE") headerRow = r;
    }
    if (headerRow < 0) continue;
    const headers = Array.from({ length: range.e.c + 1 }, (_, c) =>
      String(cell(ws, headerRow, c) ?? "").replace(/\s+/g, " ").trim()
    );

    for (let r = headerRow + 1; r <= range.e.r; r++) {
      const name = String(cell(ws, r, 2) ?? "").trim();
      if (!name) continue;
      let rate = Number(cell(ws, r, 3)) || 0;
      let amount = 0;
      let openDays = 0;
      const skipped: string[] = [];
      for (let c = 4; c <= range.e.c; c++) {
        const h = headers[c];
        const v = Number(cell(ws, r, c));
        if (!h || !Number.isFinite(v)) continue;
        if (/^amount/i.test(h)) {
          amount += v;
          openDays = 0;
        } else if (/new rate/i.test(h)) {
          if (v > 0) rate = v;
        } else if (/^total/i.test(h)) {
          continue;
        } else if (v < 0 || v > MAX_DAYS_PER_WEEK) {
          skipped.push(`${XLSX.utils.encode_col(c)}${r + 1}`);
        } else {
          openDays += v;
        }
      }
      const basic = round2(amount + openDays * rate);
      if (basic <= 0) continue;
      out.push({ sheet, code: String(cell(ws, r, 0) ?? "").trim(), name, basic, rate, skipped });
    }
  }
  return out;
}

export type AppEmployee = {
  id: string;
  employee_id: string | null;
  full_name: string | null;
  salary_basis?: string | null;
  base_rate?: number | null;
  is_active?: boolean | null;
};

/** Upper-case, accents dropped (Ñ → N), letters and spaces only. */
const plain = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z\s]/g, " ");
const words = (s: string) => plain(s).split(/\s+/).filter((w) => w.length > 2 && w !== "JR");

/** By employee code first, then every sheet name word (3+ letters) found in the app name; active wins ties. */
export function matchAppEmployee(row: SheetEmployee, employees: AppEmployee[]): AppEmployee | null {
  const byCode = row.code ? employees.find((e) => e.employee_id === row.code) : undefined;
  if (byCode) return byCode;
  const want = words(row.name);
  if (want.length === 0) return null;
  // Joined name so "Declaro" finds "DE CLARO"; every sheet word must appear.
  const hits = employees.filter((e) => {
    const have = plain(e.full_name ?? "").replace(/\s/g, "");
    return want.every((w) => have.includes(w));
  });
  return hits.find((e) => e.is_active) ?? hits[0] ?? null;
}

export type YearEndRow = {
  key: string;
  sheet: string;
  name: string;
  /** App employee this sheet row was matched to (null = not found; no SIL cash). */
  employeeId: string | null;
  code: string;
  basic: number;
  thirteenthMonth: number;
  silUnusedDays: number;
  dailyRate: number;
  silCash: number;
  total: number;
  notes: string[];
};

export function buildYearEndRows(
  sheetRows: SheetEmployee[],
  employees: AppEmployee[],
  leaves: SilLeaveRow[],
  year: number
): YearEndRow[] {
  const leavesByEmployee = new Map<string, SilLeaveRow[]>();
  for (const l of leaves) {
    const list = leavesByEmployee.get(l.employee_id) ?? [];
    list.push(l);
    leavesByEmployee.set(l.employee_id, list);
  }
  return sheetRows.map((s, i) => {
    const e = matchAppEmployee(s, employees);
    const notes = [...s.skipped.map((a) => `Skipped ${a} (not a week's days)`)];
    if (!e) notes.push("Not found in the app: no SIL cash");
    else if (e.is_active === false) notes.push("Inactive in the app: SIL settled in final pay");
    const getsSil = Boolean(e && e.is_active !== false);
    const appRate = e
      ? ratePerDayAndHourFromProfile({
          employee_id: e.employee_id ?? "",
          full_name: e.full_name ?? "",
          salary_basis: e.salary_basis ?? null,
          base_rate: e.base_rate ?? null,
        }).perDay
      : 0;
    const dailyRate = round2(s.rate || appRate);
    const silUnusedDays = getsSil
      ? computeSilBalance(leavesByEmployee.get(e!.id) ?? [], String(year)).remaining
      : 0;
    const thirteenthMonth = round2(s.basic / 12);
    const silCash = round2(silUnusedDays * dailyRate);
    return {
      key: `${s.sheet}:${i}`,
      sheet: s.sheet,
      name: s.name,
      employeeId: e?.id ?? null,
      code: e?.employee_id ?? s.code,
      basic: s.basic,
      thirteenthMonth,
      silUnusedDays,
      dailyRate,
      silCash,
      total: round2(thirteenthMonth + silCash),
      notes,
    };
  });
}
