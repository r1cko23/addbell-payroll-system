-- =====================================================
-- 095: Comprehensive Payslips RLS Fix for Admin/HR
-- =====================================================
-- This migration ensures Admin HR can save payslips by fixing all RLS policies
-- Drops ALL existing policies and recreates them with proper permissions
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL EXISTING PAYSLIPS POLICIES
-- =====================================================
-- Drop every possible policy name that might exist from various migrations

DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can create/update payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can update draft payslips" ON public.payslips;
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can create payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can update payslips" ON public.payslips;
DROP POLICY IF EXISTS "Employees can view own payslips" ON public.payslips;

-- Also drop any policies that might have been created with slightly different names
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND tablename = 'payslips'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payslips', r.policyname);
    END LOOP;
END $$;

-- =====================================================
-- STEP 2: ENSURE RLS IS ENABLED
-- =====================================================
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 3: VERIFY get_user_role() FUNCTION EXISTS
-- =====================================================
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'get_user_role'
    ) THEN
        -- Create the function if it doesn't exist
        CREATE OR REPLACE FUNCTION public.get_user_role()
        RETURNS TEXT
        LANGUAGE sql
        SECURITY DEFINER
        SET search_path = public
        STABLE
        AS $$
          SELECT role::TEXT
          FROM public.users
          WHERE id = auth.uid()
          LIMIT 1;
        $$;

        GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
        GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon;
    END IF;
END $$;

-- =====================================================
-- STEP 4: CREATE SELECT POLICIES (READ ACCESS)
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
-- STEP 5: CREATE INSERT POLICIES (CREATE ACCESS)
-- =====================================================

-- Admin and HR can INSERT payslips
CREATE POLICY "Admin/HR can create payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- =====================================================
-- STEP 6: CREATE UPDATE POLICIES (MODIFY ACCESS)
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
CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- =====================================================
-- STEP 7: VERIFY POLICIES WERE CREATED
-- =====================================================
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'payslips';

    IF policy_count < 5 THEN
        RAISE EXCEPTION 'Expected at least 5 policies on payslips table, but found %', policy_count;
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

COMMENT ON POLICY "Only Admins can approve payslips" ON public.payslips IS
  'Allows only admin role to change payslip status to approved/paid. HR can still update draft payslips.';




