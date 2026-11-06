# Rest day and holiday worked only through an OT request (2026-11-06)

**Status: dry run only. Nothing has been written to production.** The user approves the write separately and runs the SQL in the Supabase SQL Editor.

## Problem

When a rest day or holiday was worked only through an approved overtime request (no punch, so `regularHours` = 0 and `overtimeHours` > 0), every hour was priced at the overtime rate (day premium × 130%). Under DOLE rules, the first 8 hours worked on those days are paid at the day premium (130% rest day or special day, 150% Sunday + special day, 200% regular holiday, 260% regular holiday on a rest day). Only hours past 8 get the extra 30%. Night differential on those days is 10% of that day's hourly rate, or of the day's OT rate for night hours past the first 8.

## Code fix

- `utils/payroll-calculator.ts` `calculateDailyPay`: this case is now split into up to 8 hours at the day rate plus the remainder as OT. Night-differential hours are placed at the end of the shift, which fits evening OT. Exact placement would need punch times. Days with a regular punch, regular days, and the unworked-holiday credit are unchanged. Payslip generation (`resolveCutoffGrossPay` → `calculateWeeklyPayroll`) and the Excel export both use this function.
- `overtimeAndNightDiffPay` (same file) gives the payslip screen (`PayslipDetailedBreakdown`) and print (`PayslipPrint`) the same OT and ND amounts. Those screens price line by line, and the payslip screen's total is what gets saved as gross. Those screens and the Excel export also no longer add the unworked-holiday credit on a day that was worked through an OT request.
- Tests: `utils/__tests__/premium-day-ot-only.test.ts` covers all five day types at 4, 8, 9 and 10 hours, night hours inside and past the first 8, and the unchanged cases. New cases were also added to `lib/__tests__/payroll-run-template-days.test.ts`.

## Backfill scope (from production, finalized runs)

- 9 days on 8 payslips across 7 runs.
- Total gross: ₱57,158.04 → ₱54,746.80 (−₱2,411.24)
- Total net: ₱54,199.93 → ₱51,788.69 (−₱2,411.24)

New values were computed with `calculateWeeklyPayroll` from each payslip's stored `attendance_data`. A read-only check against production confirmed for all 8 payslips: the current values match the plan's starting values, new gross equals the calculator total, net = gross + adjustment + allowance − deductions, and the breakdown has one entry per attendance day.

## What changes

Only `public.payslips`: `gross_pay`, `net_pay`, `earnings_breakdown.payroll_result` (breakdown, totals, grossPay) and `updated_at`. Attendance hours and all deductions are unchanged.

- **SSS, PhilHealth, Pag-IBIG:** these come from monthly salary and month-to-date work days, not gross, so they don't change.
- **Withholding tax:** 7 of the 8 payslips have tax ₱0, and lowering gross keeps it at ₱0. One payslip has a stored tax that the generator's semi-month formula does not reproduce (the formula gives ₱0 even on the old gross), so it was set outside the generator. The plan leaves it unchanged, and payroll should confirm it separately.
- **Other tables:** no other table stores gross or net. 13th-month pay isn't stored on these payslips. BIR reports, the payroll register and the Excel export read `payslips` when they run.
- **Employee portal:** it shows all of an employee's payslips, so the corrected amounts appear there after the update.

## Where the per-payslip plan and SQL are

Per-payslip values and the SQL are kept outside the repo because they contain pay amounts. They're in the session notes folder next to the earlier backup:

- `2026-11-ot-only-premium-day-backfill.md`: one row per payslip ID, before and after
- `2026-11-ot-only-premium-day-backfill.sql`: one transaction. It backs up the 8 rows to `backups.payslips_ot_only_20261106` (a schema not exposed through the API), refuses to write if any row changed since the dry run, applies the update, checks the result, then commits. A rollback statement is at the end.
