"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import * as XLSXStyle from "xlsx-js-style";
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
import { SIL_LEAVE_COLUMNS, currentSilYear, type SilLeaveRow } from "@/lib/sil-balance";
import {
  buildYearEndRows,
  parseThirteenthMonthWorkbook,
  type AppEmployee,
  type YearEndRow,
} from "@/lib/year-end-payout";

/** 13th month (from HR's sheet) + unused SIL cash (from the app), paid together in December. */
export function YearEndPayoutPanel() {
  const supabase = useMemo(() => createClient(), []);
  const year = Number(currentSilYear());
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<YearEndRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setLoading(true);
    setError(null);
    setRows(null);
    setFileName(file.name);
    try {
      const sheetRows = parseThirteenthMonthWorkbook(XLSX.read(await file.arrayBuffer()));
      if (sheetRows.length === 0) {
        throw new Error('No employee rows found. The sheet needs a header row with "RATE" in column D.');
      }
      const [{ data: employees, error: empErr }, { data: leaves, error: leaveErr }] =
        await Promise.all([
          supabase.from("employees").select("id, employee_id, full_name, salary_basis, base_rate, is_active"),
          supabase
            .from("leave_requests")
            .select(SIL_LEAVE_COLUMNS)
            .gte("end_date", `${year}-01-01`)
            .lte("start_date", `${year}-12-31`),
        ]);
      if (empErr) throw empErr;
      if (leaveErr) throw leaveErr;
      setRows(
        buildYearEndRows(
          sheetRows,
          (employees ?? []) as AppEmployee[],
          (leaves ?? []) as SilLeaveRow[],
          year
        )
      );
    } catch (e: any) {
      setError(e?.message || "Couldn't read that file.");
    } finally {
      setLoading(false);
    }
  }

  const totals = useMemo(() => {
    const sum = (k: "basic" | "thirteenthMonth" | "silCash" | "total") =>
      Math.round((rows ?? []).reduce((s, r) => s + r[k], 0) * 100) / 100;
    return { basic: sum("basic"), thirteenth: sum("thirteenthMonth"), sil: sum("silCash"), total: sum("total") };
  }, [rows]);

  function exportExcel() {
    if (!rows) return;
    const header = [
      "Sheet",
      "ID #",
      "Name",
      "Basic (from sheet)",
      "13th month (basic ÷ 12)",
      "Unused SIL days",
      "Daily rate",
      "SIL cash",
      "Total",
      "Notes",
    ];
    const data = rows.map((r) => [
      r.sheet,
      r.code,
      r.name,
      r.basic,
      r.thirteenthMonth,
      r.silUnusedDays,
      r.dailyRate,
      r.silCash,
      r.total,
      r.notes.join("; "),
    ]);
    data.push(["", "", "TOTAL", totals.basic, totals.thirteenth, "", "", totals.sil, totals.total, ""]);
    const ws = XLSXStyle.utils.aoa_to_sheet([
      [`ADD-BELL 13TH MONTH + SIL ${year} (from ${fileName ?? "HR sheet"})`],
      header,
      ...data,
    ]);
    ws["!cols"] = [10, 10, 30, 16, 18, 12, 10, 12, 14, 40].map((wch) => ({ wch }));
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, "13th month + SIL");
    XLSXStyle.writeFile(wb, `13th-month-SIL-${year}.xlsx`);
  }

  const unmatched = (rows ?? []).filter((r) => !r.employeeId).length;

  return (
    <CardSection
      title="13th month and SIL cash"
      description={`Upload HR's 13th month sheet. 13th month is the sheet's basic ÷ 12; unused ${year} SIL days from the app are paid at the daily rate.`}
    >
      <HStack gap="2" className="flex-wrap items-center">
        <label className="inline-flex">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              e.target.value = "";
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted">
            {fileName ? "Upload another sheet" : "Upload HR sheet"}
          </span>
        </label>
        <Button variant="outline" onClick={exportExcel} disabled={!rows?.length}>
          Export Excel
        </Button>
        {fileName && <BodySmall className="text-muted-foreground">{fileName}</BodySmall>}
      </HStack>

      {loading && <BodySmall className="text-muted-foreground">Reading sheet…</BodySmall>}
      {error && <BodySmall className="text-destructive">{error}</BodySmall>}
      {unmatched > 0 && (
        <BodySmall className="text-muted-foreground">
          {unmatched} {unmatched === 1 ? "person isn't" : "people aren't"} in the app, so they get the 13th month only. Check
          the Notes column.
        </BodySmall>
      )}

      {rows && rows.length > 0 && (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">13th month</TableHead>
                <TableHead className="text-right">Unused SIL</TableHead>
                <TableHead className="text-right">Daily rate</TableHead>
                <TableHead className="text-right">SIL cash</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.key}>
                  <TableCell>
                    {r.name}
                    <span className="block text-xs text-muted-foreground">
                      {r.sheet}
                      {r.code ? ` · ${r.code}` : ""}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.basic)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.thirteenthMonth)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.employeeId ? r.silUnusedDays : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.dailyRate)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.silCash)}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.total)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.notes.join("; ")}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell className="font-semibold">Total</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.basic)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.thirteenth)}</TableCell>
                <TableCell />
                <TableCell />
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.sil)}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(totals.total)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </CardSection>
  );
}
