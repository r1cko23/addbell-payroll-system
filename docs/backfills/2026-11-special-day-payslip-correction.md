# Special-day payslip correction (2026-11-06)

**Status: APPLIED on 2026-11-06.** The user approved it directly in the session that ran it ("Remove all three"). They said the overpayment had already been corrected manually outside the system, so the stored payslips were changed to match what was actually paid.

## Why

Before commit `8cbc477`, unworked special non-working days were credited 4h (×130%, or ×150% on a Sunday special day) for daily-paid staff. NWPC rule: no work, no pay. Two finalized runs still carried the credit in `payslips`.

## Scope found (21 payslips, not 19)

| Credit | Run | Payslips | Amount |
|---|---|---|---|
| Aug 21 unworked, 4h × 130% | `7a903e3d-caa2-4839-a35c-24816debf593` (Aug 19–25) | 8 | ₱3,971.50 |
| Nov 2 unworked, 4h × 130% | `6dce48a4-195d-4c3d-821a-d181a510154f` (Oct 28–Nov 3) | 11 | ₱5,499.00 |
| Nov 1 Sunday + special, 4h × 150% | same Oct 28 run | 13 | ₱7,582.50 |
| **Total** | | **21** | **₱17,053.00** |

The Nov 1 credit had already been removed from `attendance_data`, but it was left in `gross_pay`. Every affected payslip in that run had gross exactly 6 × (rate ÷ 8) above `payroll_result.totals.total`. Two employees worked Nov 2, so they only had the Nov 1 credit.

## Per payslip

Redacted: this repo copy leaves out employee names and per-person pay. The full per-payslip table (before/after gross and net) is kept outside the repo, next to the backup listed below.

Affected payslip ids:

- **Aug 19 run (8):** 3b444efa-26fb-4856-bb0e-c81b1ff73615, 300ad29e-c18b-400e-be8d-86a5f088f554, b17bae27-bb3d-450a-8f84-6636e96545bd, 223b60c1-794e-4b12-922e-2bc7373e4df2, 51bec3bf-ab60-4044-aa7d-9b74ae057c24, d676d98f-257a-4c29-84b6-4963f8e903a7, f466f149-33f2-4592-8d51-9bcfe34d2a83, ba68b582-e451-44ba-9edd-37e5d43fe5ef
- **Oct 28 run (13):** bb48bd5b-df40-4097-bf38-598c0ddbb1b4, 4f7aeb5c-e0af-4f4e-b3a0-be0cbf6d1e66, 3d523c55-2846-461b-b4db-5a0440dbade2, 55fa7a0d-afe0-413d-8bd6-901b6508aa9c, 39444cfe-eac1-4696-87e1-2a574df6054e, 2d2539bf-4295-43aa-be71-fff269ef1803, c276653c-d752-42ef-9fcf-0de9947e3795, c770b25e-f893-438a-a363-95018aeae541, 5340fc1c-4d72-4f94-b7a7-334bf0ca501a, 797a19a2-14ac-4b0b-a34a-0de68a0fcc36, 58067ad6-2337-4a31-8f82-dd2c6f6c4f5f, 8c1fa3cb-0a33-40b6-a3d5-fd736e72e093, 4899d855-ac5b-4b1a-a7dd-f9eeebfd1022

In the Oct 28 run, 11 payslips lost both the Nov 2 and Nov 1 credits. The last 2 listed (8c1fa3cb, 4899d855) lost only Nov 1, because those employees worked Nov 2.

**Run totals after the correction (all slips in each run):**
- Aug 19: gross ₱52,162.01 → ₱48,190.51; net ₱57,653.13 → ₱53,681.63
- Oct 28: gross ₱72,726.46 → ₱59,644.96; net ₱69,869.13 → ₱56,787.63

## Deductions: none changed, and none needed to

From `app/api/payroll-runs/generate-payslips/route.ts`:
- **SSS, PhilHealth, Pag-IBIG** are based on monthly salary (`base_rate × 26`), prorated by month-to-date work days taken from clock entries. Gross only gates them through `grossPay > 0`. Gross pay doesn't change them.
- **Withholding tax** reads semi-month gross. All 21 corrected payslips had tax ₱0, and tax can't go up when gross goes down, so it stays ₱0. Aug 25 closes August's second half, and September starts a new month, so no later payslip used these gross values for tax. Nov 3 is in November's first half, and no later November run exists yet. Future tax will read the corrected gross.

## Tables and columns touched

Only `public.payslips`:
- `gross_pay`, `net_pay`, `updated_at`
- `earnings_breakdown.attendance_data[*].regularHours`: 4 → 0 on the unworked Aug 21 and Nov 2 days
- `earnings_breakdown.payroll_result.breakdown[i]`: that day's `regularPay` set to 0 and `total` reduced to match
- `earnings_breakdown.payroll_result.totals.regularPay` / `.total` and `payroll_result.grossPay`: reduced by the special-day credit

There are no other stored totals. No other table has gross or net columns (`information_schema` check). `thirteenth_month_pay` is 0 or null on all 25 payslips. BIR reports, the payroll register and the Excel export compute from `payslips` when they run, so they now show the corrected values.

## Employee portal

`app/api/employee-portal/payslips` returns every payslip for the employee, with no status or release filter. So these payslips were already visible to employees, and now they show the corrected amounts. The response is cached for up to 600s (`lib/cache.ts`), and that window has passed. Printed or exported copies made before this change still show the old amounts.

## Backup and SQL as run

A backup (kept outside the repo, with the full unredacted version of this document) of all 25 payslips in both runs (`id`, `gross_pay`, `net_pay`, `earnings_breakdown`) was saved before the write.

```sql
begin;
with s as (
 select p.id, e.base_rate, p.earnings_breakdown eb,
  (p.gross_pay - (p.earnings_breakdown->'payroll_result'->'totals'->>'total')::numeric)/(e.base_rate/8) diff_h,
  (select count(*) from jsonb_array_elements(p.earnings_breakdown->'attendance_data') x
    where x->>'dayType' in ('non-working-holiday','sunday-special-holiday')
      and (x->>'regularHours')::numeric>0 and x->>'clockInTime' is null) n_unworked
 from payslips p join employees e on e.id=p.employee_id
 where p.payroll_run_id in ('7a903e3d-caa2-4839-a35c-24816debf593','6dce48a4-195d-4c3d-821a-d181a510154f')),
c as (select *, round(n_unworked*0.65*base_rate,2) sc,
        round(case when diff_h>5.9 then 0.75*base_rate else 0 end,2) n1 from s),
u as (
 update payslips p set
  gross_pay = p.gross_pay - c.sc - c.n1,
  net_pay   = p.net_pay   - c.sc - c.n1,
  earnings_breakdown = jsonb_set(jsonb_set(jsonb_set(jsonb_set(c.eb,
    '{attendance_data}',
    (select jsonb_agg(case when x->>'dayType' in ('non-working-holiday','sunday-special-holiday')
        and (x->>'regularHours')::numeric>0 and x->>'clockInTime' is null
        then jsonb_set(x,'{regularHours}','0') else x end order by i)
     from jsonb_array_elements(c.eb->'attendance_data') with ordinality t(x,i))),
    '{payroll_result,breakdown}',
    (select jsonb_agg(case when a->>'dayType' in ('non-working-holiday','sunday-special-holiday')
        and (a->>'regularHours')::numeric>0 and a->>'clockInTime' is null
        then b || jsonb_build_object('regularPay',0,'total',(b->>'total')::numeric-(b->>'regularPay')::numeric)
        else b end order by i)
     from jsonb_array_elements(c.eb->'payroll_result'->'breakdown') with ordinality t(b,i),
          lateral (select c.eb->'attendance_data'->((i-1)::int) a) aa)),
    '{payroll_result,totals}',
    (c.eb->'payroll_result'->'totals') || jsonb_build_object(
      'regularPay',(c.eb->'payroll_result'->'totals'->>'regularPay')::numeric - c.sc,
      'total',(c.eb->'payroll_result'->'totals'->>'total')::numeric - c.sc)),
    '{payroll_result,grossPay}',
    to_jsonb((c.eb->'payroll_result'->>'grossPay')::numeric - c.sc)),
  updated_at = now()
 from c where p.id=c.id and c.sc+c.n1>0
 returning p.id)
select count(*) updated from u;   -- returned 21
commit;
```

## Verification (after commit)

On all 25 payslips in both runs:
- `gross_pay` = `payroll_result.totals.total` (within ₱0.25; two payslips kept a ₱0.19 rounding gap that was there before)
- `net_pay` = gross + adjustment + allowance − deductions
- `payroll_result.grossPay` = `totals.total`
- No unworked special day has `regularHours` > 0

## Rollback

Restore `gross_pay`, `net_pay` and `earnings_breakdown` for the 21 ids from the backup file.
