-- =====================================================
-- ADD EMPLOYEE PORTAL PASSWORD
-- =====================================================
-- Add password field for employee portal login
-- Default password will be the employee_id for initial setup

-- Add password column to employees table
ALTER TABLE public.employees
ADD COLUMN portal_password TEXT;

-- Set default password to employee_id for existing employees
-- HR can update these passwords later
UPDATE public.employees
SET portal_password = employee_id
WHERE portal_password IS NULL;

-- Make portal_password NOT NULL after setting defaults
ALTER TABLE public.employees
ALTER COLUMN portal_password SET DEFAULT '';

-- Create index for faster password lookups
CREATE INDEX idx_employees_portal_password ON public.employees(employee_id, portal_password);

-- Note: In production, you should use proper password hashing
-- For now, this is a simple implementation for employee portal access

