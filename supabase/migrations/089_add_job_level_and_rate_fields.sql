-- Add job_level, monthly_rate, and per_day fields to employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS job_level TEXT,
ADD COLUMN IF NOT EXISTS monthly_rate DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS per_day DECIMAL(10, 2);

-- Add comments for documentation
COMMENT ON COLUMN public.employees.job_level IS 'Employee job level (e.g., RANK AND FILE, SUPERVISORY, MANAGERIAL)';
COMMENT ON COLUMN public.employees.monthly_rate IS 'Employee monthly salary rate';
COMMENT ON COLUMN public.employees.per_day IS 'Employee daily rate calculated from monthly rate';

-- Create index for job level filtering
CREATE INDEX IF NOT EXISTS idx_employees_job_level ON public.employees(job_level);