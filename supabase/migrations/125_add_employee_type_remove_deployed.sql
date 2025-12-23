-- =====================================================
-- ADD EMPLOYEE_TYPE COLUMN AND REMOVE DEPLOYED COLUMN
-- =====================================================
-- Add employee_type column to distinguish between office-based and client-based employees
-- office-based: All employees except Account Supervisors
-- client-based: Account Supervisors only
-- Remove deployed column as it's no longer needed

-- Add employee_type column
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS employee_type TEXT CHECK (employee_type IN ('office-based', 'client-based'));

-- Add comment for documentation
COMMENT ON COLUMN public.employees.employee_type IS 
  'Indicates if employee is office-based or client-based. Account Supervisors are client-based, all others are office-based.';

-- Create index for filtering by employee type
CREATE INDEX IF NOT EXISTS idx_employees_employee_type ON public.employees(employee_type);

-- Set default values based on position
-- Account Supervisors = client-based
-- All others = office-based
UPDATE public.employees
SET employee_type = CASE 
  WHEN UPPER(position) LIKE '%ACCOUNT SUPERVISOR%' THEN 'client-based'
  ELSE 'office-based'
END
WHERE employee_type IS NULL;

-- Set default for new records (office-based)
ALTER TABLE public.employees
ALTER COLUMN employee_type SET DEFAULT 'office-based';

-- Remove deployed column and its index
DROP INDEX IF EXISTS idx_employees_deployed;
ALTER TABLE public.employees
DROP COLUMN IF EXISTS deployed;


