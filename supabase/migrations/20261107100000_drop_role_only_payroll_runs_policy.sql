-- payroll_runs had two permissive policies: the role-only payroll_runs_payroll_staff
-- (20261106230000) and the per-user payroll_runs_select/insert/update/delete
-- (20261107090000). Permissive policies are OR'd, so the role-only one let an HR
-- account whose payslips permission is switched off still read and write payroll runs.
-- Keep the per-user rules, which match what the app allows.
--
-- Rollback: re-run the payroll_runs_payroll_staff block from 20261106230000.

drop policy if exists payroll_runs_payroll_staff on public.payroll_runs;
