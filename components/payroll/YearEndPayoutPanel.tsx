"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { addDays, format, parseISO } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CardSection } from "@/components/ui/card-section";
import { BodySmall } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/format";
import { SIL_LEAVE_COLUMNS, currentSilYear } from "@/lib/sil-balance";
import {
  buildYearEndRows,
  thirteenthMonthWindow,
  type YearEndLeaveRow,
  type YearEndPayslip,
  type YearEndRow,
} from "@/lib/year-end-payout";

const PAGE = 1000;

/** 13th month + unused SIL cash, paid together in December. */
export function YearEndPayoutPanel() {
  const supabase = useMemo(() => createClient(), []);
  const thisYear = Number(currentSilYear());
  const [year, setYear] = useState(thisYear);
  const [rows, setRows] = useState<YearEndRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const win = thirteenthMonthWindow(year);

  const load = useCallback(async () => {
    setRows(null);
    setError(null);
    try {
      // A year of weekly payslips is several thousand rows: page past the 1,000-row API limit.
      const payslips: YearEndPayslip[] = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from("payslips")
          .select(
            "employee_id, period_start, gross_pay, att:earnings_breakdown->attendance_data, bd:earnings_breakdown->payroll_result->breakdown, totals:earnings_breakdown->payroll_result->totals"
          )
          .gt("period_end", win.afterEnd)
          .lte("period_end", win.throughEnd)
          .order("id")
          .range(from, from + PAGE - 1);
        if (error) throw error;
        for (const p of (data ?? []) as any[]) {
          payslips.push({
            employee_id: p.employee_id,
            period_start: p.period_start,
            gross_pay: p.gross_pay,
            earnings_breakdown: {
              attendance_data: p.att ?? [],
              payroll_result: { breakdown: p.bd ?? [], totals: p.totals },
            },
          });
        }
        if (!data || data.length < PAGE) break;
      }
      const [{ data: employees, error: empErr }, { data: leaves, error: leaveErr }] =
        await Promise.all([
          supabase.from("employees").select("id, employee_id, full_name, salary_basis, base_rate"),
          supabase
            .from("leave_requests")
            .select(`${SIL_LEAVE_COLUMNS}, end_date`)
            // Paid leave in the 13th month window (from last December) and this year's SIL.
            .gte("end_date", win.afterEnd)
            .lte("start_date", `${year}-12-31`),
        ]);
      if (empErr) throw empErr;
      if (leaveErr) throw leaveErr;
      setRows(
        buildYearEndRows(
          (employees ?? []) as any[],
          payslips,
          (leaves ?? []) as YearEndLeaveRow[],
          year
        )
      );
    } catch (e: any) {
      setError(e?.message || "Couldn't load payslips for the 13th month.");
    }
  }, [supabase, year, win.afterEnd, win.throughEnd]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const sum = (k: keyof YearEndRow) =>
      Math.round((rows ?? []).reduce((s, r) => s + Number(r[k] || 0), 0) * 100) / 100;
    return { thirteenth: sum("thirteenthMonth"), sil: sum("silCash"), total: sum("total") };
  }, [rows]);

  // Weeks before this date are missing from the app (payslips started in April 2026).
  const windowStartStr = format(addDays(parseISO(win.afterEnd), 1), "yyyy-MM-dd");

  function exportExcel() {
    if (!rows) return;
    const header = [
      "ID #",
      "Name",
      "First cutoff in app",
      "Basic pay",
      "13th month (basic ÷ 12)",
      "Unused SIL days",
      "Daily rate",
      "SIL cash",
      "Total",
    ];
    const data = rows.map((r) => [
      r.code,
      r.name,
      r.firstCutoff ?? "",
      r.basic,
      r.thirteenthMonth,
      r.silUnusedDays,
      r.dailyRate,
      r.silCash,
      r.total,
    ]);
    data.push(["", "TOTAL", "", "", totals.thirteenth, "", "", totals.sil, totals.total]);
    const ws = XLSX.utils.aoa_to_sheet([
      [`ADD-BELL 13TH MONTH + SIL ${year} (cutoffs ${windowStartStr} to ${win.throughEnd})`],
      header,
      ...data,
    ]);
    ws["!cols"] = [10, 32, 14, 14, 18, 12, 10, 12, 14].map((wch) => ({ wch }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "13th month + SIL");
    XLSX.writeFile(wb, `13th-month-SIL-${year}.xlsx`);
  }

  const partial = (rows ?? []).some((r) => (r.firstCutoff ?? "") > windowStartStr);

  return (
    <CardSection
      title="13th month and SIL cash"
      description={`Cutoffs ${windowStartStr} to ${win.throughEnd}. 13th month is basic pay for days worked (holidays and leave left out) ÷ 12; unused SIL days are paid at the current daily rate.`}
    >
      <HStack gap="2" className="flex-wrap">
        <select
          aria-label="Year"
          className="h-9 rounded-md border border-border bg-background px-2 text-sm"
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
        >
          {[thisYear, thisYear - 1].map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={exportExcel} disabled={!rows?.length}>
          Export Excel
        </Button>
      </HStack>

      {error && (
        <BodySmall className="text-destructive">
          {error}{" "}
          <button className="underline" onClick={() => void load()}>
            Try again
          </button>
        </BodySmall>
      )}
      {!error && rows === null && <BodySmall className="text-muted-foreground">Loading…</BodySmall>}
      {partial && (
        <BodySmall className="text-muted-foreground">
          Some employees have no payslips in the app before their first cutoff shown. Add the basic pay for
          earlier weeks from the accountant&apos;s sheet before paying.
        </BodySmall>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>First cutoff</TableHead>
                <TableHead className="text-right">Basic pay</TableHead>
                <TableHead className="text-right">13th month</TableHead>
                <TableHead className="text-right">Unused SIL</TableHead>
                <TableHead className="text-right">Daily rate</TableHead>
                <TableHead className="text-right">SIL cash</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.employeeId}>
                  <TableCell>
                    {r.name}
                    <span className="block text-xs text-muted-foreground">{r.code}</span>
                  </TableCell>
                  <TableCell>{r.firstCutoff}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.basic)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.thirteenthMonth)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.silUnusedDays}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.dailyRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.silCash)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.total)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.thirteenth)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.sil)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.total)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
      {rows && rows.length === 0 && (
        <BodySmall className="text-muted-foreground">No payslips in this 13th month year yet.</BodySmall>
      )}
    </CardSection>
  );
}
