-- Add transferred_from_employee_id so OT (and other data) from the previous record
-- can be loaded when an employee is "transferred" (new record created, old deactivated).
-- When set, payslip/timesheet will load overtime_requests for both current and predecessor.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS transferred_from_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.employees.transferred_from_employee_id IS
  'When employee was transferred (new record), the previous employees.id so OT/attendance from old record is still loaded.';

CREATE INDEX IF NOT EXISTS idx_employees_transferred_from
  ON public.employees(transferred_from_employee_id) WHERE transferred_from_employee_id IS NOT NULL;