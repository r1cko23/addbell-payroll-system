-- Add position and eligible_for_ot fields to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS position TEXT,
ADD COLUMN IF NOT EXISTS eligible_for_ot BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.employees.position IS 'Employee job position/title';
COMMENT ON COLUMN public.employees.eligible_for_ot IS 'Whether employee is eligible for overtime pay';