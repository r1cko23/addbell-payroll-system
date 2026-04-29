-- Allow payroll runs to target a specific employee subset.
ALTER TABLE payroll_runs
ADD COLUMN IF NOT EXISTS selected_employee_ids jsonb;

