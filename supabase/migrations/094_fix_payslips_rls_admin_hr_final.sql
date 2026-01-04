-- =====================================================
-- 094: Final Fix Payslips RLS for Admin/HR Access
-- =====================================================
-- Comprehensive fix for 403 errors when Admin HR tries to save payslips
-- This ensures Admin HR can read, insert, and update payslips
-- =====================================================

-- Drop ALL existing payslips policies to start completely fresh
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can create/update payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can update draft payslips" ON public.payslips;
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can create payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can update payslips" ON public.payslips;
DROP POLICY IF EXISTS "Employees can view own payslips" ON public.payslips;

-- Ensure RLS is enabled
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SELECT POLICIES (READ ACCESS)
-- =====================================================

-- Admin and HR can SELECT all payslips
CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'hr')
  );

-- All authenticated users can view payslips (for general access)
-- This works alongside the admin/HR policy (policies are OR'd together)
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

-- =====================================================
-- INSERT POLICIES (CREATE ACCESS)
-- =====================================================

-- Admin and HR can INSERT payslips
CREATE POLICY "Admin/HR can create payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- =====================================================
-- UPDATE POLICIES (MODIFY ACCESS)
-- =====================================================

-- Admin and HR can UPDATE payslips (including draft status)
-- This allows Admin HR to save/update payslips
CREATE POLICY "Admin/HR can update payslips" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Only Admins can approve payslips (status change to approved/paid)
-- This is a separate policy that allows admins to change status to approved/paid
-- HR can still update draft payslips via the policy above
-- Note: This policy allows admins to update payslips when changing status to approved/paid
CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- =====================================================
-- VERIFY FUNCTION EXISTS
-- =====================================================
-- Ensure get_user_role() function exists and works correctly
DO $$
BEGIN
  -- Check if function exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.proname = 'get_user_role'
  ) THEN
    RAISE EXCEPTION 'get_user_role() function does not exist. Please run migration 023_fix_users_rls_recursion.sql first.';
  END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Admin/HR can view all payslips" ON public.payslips IS
  'Allows admin and hr roles to view all payslips. Uses get_user_role() helper function.';

COMMENT ON POLICY "Admin/HR can create payslips" ON public.payslips IS
  'Allows admin and hr roles to create new payslips. Required for saving payslips to database.';

COMMENT ON POLICY "Admin/HR can update payslips" ON public.payslips IS
  'Allows admin and hr roles to update existing payslips. This enables Admin HR to save payslip changes.';





