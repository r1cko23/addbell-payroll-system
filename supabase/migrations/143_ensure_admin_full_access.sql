-- =====================================================
-- 143: Ensure Admin Has Full Access Everywhere
-- =====================================================
-- This migration ensures all admin users have full system access
-- Admin should be able to do everything HR can do, plus more
-- =====================================================

-- Ensure all admin users have can_access_salary = true
UPDATE public.users
SET can_access_salary = true
WHERE role = 'admin' AND (can_access_salary IS NULL OR can_access_salary = false);

-- Verify admin users exist and have correct permissions
DO $$
DECLARE
  admin_count INT;
  admin_without_salary_access INT;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.users
  WHERE role = 'admin' AND is_active = true;
  
  SELECT COUNT(*) INTO admin_without_salary_access
  FROM public.users
  WHERE role = 'admin' 
    AND is_active = true
    AND (can_access_salary IS NULL OR can_access_salary = false);
  
  RAISE NOTICE 'Total admin users: %', admin_count;
  RAISE NOTICE 'Admin users without salary access (should be 0): %', admin_without_salary_access;
  
  IF admin_without_salary_access > 0 THEN
    RAISE WARNING 'Found % admin users without salary access. These have been updated.', admin_without_salary_access;
  END IF;
END $$;

-- Add comment
COMMENT ON COLUMN public.users.can_access_salary IS 
'Grants access to view/edit employee salary rates and generate payslips. 
Admin users ALWAYS have this set to true (full system access). 
HR users may have this set to true on a case-by-case basis.';
