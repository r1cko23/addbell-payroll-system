# Night differential on regular-day overtime (2026-11-08)

**Status: NOT RUN YET.** SQL: [2026-11-regular-day-ot-night-diff.sql](2026-11-regular-day-ot-night-diff.sql). Run it once, as a whole, in the Supabase SQL Editor.

## Problem

On a regular day, night hours (10 PM to 6 AM) that were also overtime got 10% of the basic hourly rate as night differential. DOLE pays 10% of the overtime rate there (basic × 1.25), so each such hour was short by 2.5% of the basic hourly rate. Worked holidays and rest days were already fixed on 2026-11-07 (e166ec4).

## Code fix

- `utils/payroll-calculator.ts` `calculateDailyPay`: one night-differential rule for every day type. Night hours inside overtime get 10% of that day's OT rate (regular day: rate × 1.25; other days: day rate × 1.3), and the rest get 10% of the day rate. The payslip generator, the Excel export, the payslip screen and print (`overtimeAndNightDiffPay`) all use it.
- `lib/payslip-print-sync.ts` priced regular-day night differential on its own and now uses `overtimeAndNightDiffPay` too.
- Same shortcut as before: night hours are assumed to fall in the OT part first (evening OT). Exact placement would need punch times.
- Tests: `utils/__tests__/premium-day-night-diff.test.ts` (regular days: all night hours in OT, more night hours than OT, no OT, zero night hours, totals). Old expectations in `payroll-calculator.test.ts` and `premium-day-ot-only.test.ts` were moved to the new rate.

## Backfill scope (production, checked 2026-11-08)

- 33 payslips, 41 regular days with both overtime and night hours, across 18 finalized runs from May 20 to Nov 3.
- Total gross and net: +₱310.78. Per payslip: +₱2.50 to +₱47.50.

| Run | Payslips | Added |
|---|---|---|
| May 20–26 | 2 | ₱22.97 |
| Jun 3–9 | 1 | ₱5.31 |
| Jun 10–16 | 2 | ₱7.96 |
| Jun 17–23 | 1 | ₱5.32 |
| Jun 24–30 | 1 | ₱7.97 |
| Jul 15–21 | 1 | ₱7.97 |
| Jul 22–28 | 2 | ₱8.59 |
| Jul 29–Aug 4 | 2 | ₱7.97 |
| Aug 19–25 | 2 | ₱7.66 |
| Aug 26–Sep 1 | 2 | ₱23.91 |
| Sep 2–8 | 2 | ₱7.81 |
| Sep 9–15 | 1 | ₱7.97 |
| Sep 23–29 | 3 | ₱54.14 |
| Sep 30–Oct 6 | 3 | ₱44.46 |
| Oct 7–13 | 2 | ₱50.31 |
| Oct 14–20 | 2 | ₱17.50 |
| Oct 21–27 | 2 | ₱10.15 |
| Oct 28–Nov 3 | 2 | ₱12.81 |

The SQL computes the new values inside the database from each payslip's stored breakdown. Each stored regular day has OT pay = OT hours × rate × 1.25 and ND pay = ND hours × rate × 0.1. That gives the night hours inside OT without needing the rate, and the correction is 0.025 × min(10 × ND pay, 0.8 × OT pay) per day, which is what the new `calculateDailyPay` returns. A read-only dry run on 2026-11-08 passed every check in the file for all 33 payslips.

## What changes

Only `public.payslips`: `gross_pay`, `net_pay`, `earnings_breakdown.payroll_result` (breakdown, totals, grossPay) and `updated_at`. The original rows go to `backups.payslips_regular_ot_nd_20261108` first.

- **SSS, PhilHealth, Pag-IBIG:** based on monthly salary and work days, not gross, so unchanged.
- **Withholding tax:** 7 of the 33 payslips have tax. The tax is settled on the last week of each half-month from that half's gross, so these few pesos could raise it by a few centavos to a few pesos. Like the earlier backfills, stored tax is left unchanged.
- **Employee portal:** shows the corrected amounts after the update.

## Not covered: 5 older-format payslips

5 payslips from Apr 22 to May 19 (7 days) were saved in an older format that keeps hours but not the hourly rate, so the SQL can't correct them exactly. Using today's employee rates the shortfall is about ₱49 in total. If HR wants to pay it, add it as an adjustment on a coming payslip.
