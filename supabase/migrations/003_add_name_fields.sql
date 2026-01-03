-- Add separate name fields to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS last_name TEXT,
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS middle_initial TEXT;

-- Add comments
COMMENT ON COLUMN public.employees.last_name IS 'Employee last name/surname';
COMMENT ON COLUMN public.employees.first_name IS 'Employee first name';
COMMENT ON COLUMN public.employees.middle_initial IS 'Employee middle initial';

-- Create index for sorting by last name
CREATE INDEX IF NOT EXISTS idx_employees_last_name ON public.employees(last_name);