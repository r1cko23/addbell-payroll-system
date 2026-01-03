-- =====================================================
-- ADD DEPLOYED COLUMN TO EMPLOYEES TABLE
-- =====================================================
-- Add deployed column to distinguish between deployed employees (regular) and office-based employees
-- deployed = true: Regular employees (can have assigned_hotel or not - hotel or non-hotel industry)
-- deployed = false/null: Office-based employees (not deployed)

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS deployed BOOLEAN DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.employees.deployed IS 
  'Indicates if employee is deployed (true) or office-based (false/null). Deployed employees can work in hotel or non-hotel industries.';

-- Create index for filtering deployed employees
CREATE INDEX IF NOT EXISTS idx_employees_deployed ON public.employees(deployed);

-- Optional: Set default based on existing assigned_hotel data
-- If employee has assigned_hotel, they are likely deployed
-- This is optional and can be adjusted based on business logic
UPDATE public.employees
SET deployed = true
WHERE assigned_hotel IS NOT NULL 
  AND assigned_hotel != '' 
  AND deployed IS NULL;
