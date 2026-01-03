-- =====================================================
-- ADD SIL CREDITS AND ACCOUNT MANAGER SUPPORT
-- =====================================================
-- Ensure sil_credits column exists in employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS sil_credits NUMERIC DEFAULT 10.00;

-- Ensure account_manager_id column exists in employees table
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES public.users(id);

-- Add account_manager role to users table if not already in check constraint
-- Note: This assumes the role check constraint already includes 'account_manager'
-- If not, you may need to drop and recreate the constraint

-- Update existing employees to have default SIL credits if null
UPDATE public.employees
SET sil_credits = 10.00
WHERE sil_credits IS NULL;

-- Create index for account manager lookups
CREATE INDEX IF NOT EXISTS idx_employees_account_manager ON public.employees(account_manager_id);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN public.employees.sil_credits IS 'Service Incentive Leave credits available to employee';
COMMENT ON COLUMN public.employees.account_manager_id IS 'Account manager assigned to this employee';