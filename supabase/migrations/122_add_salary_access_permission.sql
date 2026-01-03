-- =====================================================
-- Add salary access permission field to users table
-- =====================================================

-- Add can_access_salary column to users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS can_access_salary BOOLEAN DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.users.can_access_salary IS 'Grants access to view/edit employee salary rates and generate payslips. Only admins and authorized HR users should have this set to true.';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_users_can_access_salary ON public.users(can_access_salary) WHERE can_access_salary = true;

-- Grant salary access to all existing admins (they should have full access)
UPDATE public.users
SET can_access_salary = true
WHERE role = 'admin';

-- Grant salary access to April Nina Gammad (anngammad@greenpasture.ph)
UPDATE public.users
SET can_access_salary = true
WHERE email = 'anngammad@greenpasture.ph';
