-- Regular-day overtime night differential backfill (docs/TODO.md item 16). APPLIED 2026-11-08 03:55 UTC; verified 33/33. Do not run again.
-- 33 payslips, 41 regular days, +₱310.78 gross and net in total.
-- Only gross_pay, net_pay, earnings_breakdown.payroll_result (breakdown, totals, grossPay) and updated_at change.
-- Attendance hours and every deduction (including the stored withholding tax) are unchanged.
-- Run the whole file at once in the Supabase SQL Editor. Any failed check raises an error and nothing is written.
-- Running it a second time fails at step 1 (the backup table already exists).

begin;

-- Night hours that are also overtime on a regular day now get 10% of the OT rate (×1.25), not of the basic rate.
-- Each stored day has OT pay = OT hours × rate × 1.25 and ND pay = ND hours × rate × 0.1, so the ND hours inside
-- OT, priced at the basic rate, are min(10 × ND pay, 0.8 × OT pay), and the missing 25% of their ND is 0.025 × that.
-- This is exactly what calculateDailyPay now returns for those days.
create temp table v on commit drop as
with target as (
  select p.id from public.payslips p
  where jsonb_typeof(p.earnings_breakdown->'payroll_result'->'breakdown') = 'array'
    and exists (select 1 from jsonb_array_elements(p.earnings_breakdown->'payroll_result'->'breakdown') e
      where e->>'description' = 'Regular Day' and (e->>'nightDiffPay')::numeric > 0 and (e->>'overtimePay')::numeric > 0)
), days as (
  select p.id, b.ord, b.e,
    case when b.e->>'description' = 'Regular Day' and (b.e->>'nightDiffPay')::numeric > 0 and (b.e->>'overtimePay')::numeric > 0
      then 0.025 * least(10 * (b.e->>'nightDiffPay')::numeric, 0.8 * (b.e->>'overtimePay')::numeric) else 0 end extra
  from public.payslips p join target t on t.id = p.id
  cross join lateral jsonb_array_elements(p.earnings_breakdown->'payroll_result'->'breakdown') with ordinality b(e, ord)
), calc as (
  select d.id, sum(d.extra) extra,
    jsonb_agg(case when d.extra > 0 then d.e || jsonb_build_object(
        'nightDiffPay', (d.e->>'nightDiffPay')::numeric + d.extra,
        'total', (d.e->>'total')::numeric + d.extra) else d.e end order by d.ord) breakdown
  from days d group by d.id
)
select p.id, p.gross_pay old_gross, p.net_pay old_net, c.extra,
  -- Keep each payslip's existing cent rounding: move gross by the change in the rounded calculator total.
  round((p.earnings_breakdown->'payroll_result'->>'grossPay')::numeric + c.extra, 2)
    - round((p.earnings_breakdown->'payroll_result'->>'grossPay')::numeric, 2) delta,
  (p.earnings_breakdown->'payroll_result')
    || jsonb_build_object(
      'breakdown', c.breakdown,
      'grossPay', (p.earnings_breakdown->'payroll_result'->>'grossPay')::numeric + c.extra,
      'totals', (p.earnings_breakdown->'payroll_result'->'totals') || jsonb_build_object(
        'nightDiffPay', (p.earnings_breakdown->'payroll_result'->'totals'->>'nightDiffPay')::numeric + c.extra,
        'total', (p.earnings_breakdown->'payroll_result'->'totals'->>'total')::numeric + c.extra)
    ) payroll_result
from public.payslips p join calc c on c.id = p.id;

-- 1. Guard: the same 33 payslips and ₱310.78 the dry run saw on 2026-11-08.
do $$ begin
  if (select count(*) from v) <> 33 or (select round(sum(extra), 2) from v) <> 310.78 or (select sum(delta) from v) <> 310.78 then
    raise exception 'payslips changed since the dry run (or this already ran); nothing written';
  end if;
end $$;

-- 2. Backup (schema `backups` is not exposed through the API).
create schema if not exists backups;
create table backups.payslips_regular_ot_nd_20261108 as
select p.* from public.payslips p join v on v.id = p.id;

-- 3. Apply.
update public.payslips p set
  gross_pay = v.old_gross + v.delta,
  net_pay = v.old_net + v.delta,
  earnings_breakdown = jsonb_set(p.earnings_breakdown, '{payroll_result}', v.payroll_result),
  updated_at = now()
from v where p.id = v.id;

-- 4. Verify, still inside the transaction.
do $$ begin
  if (select count(*) from v join public.payslips p on p.id = v.id
      where p.gross_pay = v.old_gross + v.delta
        and p.net_pay = v.old_net + v.delta
        and p.total_deductions = (select b.total_deductions from backups.payslips_regular_ot_nd_20261108 b where b.id = p.id)
        and abs(p.gross_pay - round((p.earnings_breakdown->'payroll_result'->>'grossPay')::numeric, 2)) <= 0.01
        and jsonb_array_length(p.earnings_breakdown->'payroll_result'->'breakdown')
          = jsonb_array_length(p.earnings_breakdown->'attendance_data')) <> 33 then
    raise exception 'verification failed; nothing written';
  end if;
end $$;

commit;

-- Rollback after commit, if ever needed:
-- update public.payslips p set gross_pay = b.gross_pay, net_pay = b.net_pay, earnings_breakdown = b.earnings_breakdown, updated_at = now()
-- from backups.payslips_regular_ot_nd_20261108 b where b.id = p.id;
