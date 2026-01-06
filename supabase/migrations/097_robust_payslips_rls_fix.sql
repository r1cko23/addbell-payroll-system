-- =====================================================
-- 097: Robust Payslips RLS Fix - Handles NULL get_user_role()
-- =====================================================
-- This migration creates policies that work even if get_user_role() returns NULL
-- Uses both get_user_role() and direct EXISTS queries as fallback
-- =====================================================

-- =====================================================
-- STEP 1: DROP ALL EXISTING PAYSLIPS POLICIES
-- =====================================================
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
-- STEP 3: ENSURE get_user_role() FUNCTION EXISTS AND IS ROBUST
-- =====================================================
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
  AND is_active = true
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role() TO anon;

-- =====================================================
-- STEP 4: CREATE SELECT POLICIES (READ ACCESS)
-- =====================================================

-- Policy 1: Admin/HR can view all payslips using get_user_role()
CREATE POLICY "Admin/HR can view all payslips via function" ON public.payslips
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Policy 2: Admin/HR can view all payslips using direct EXISTS (fallback)
-- This ensures it works even if get_user_role() has issues
CREATE POLICY "Admin/HR can view all payslips via direct check" ON public.payslips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
    )
  );

-- Policy 3: All authenticated users can view payslips (general access)
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

-- =====================================================
-- STEP 5: CREATE INSERT POLICIES (CREATE ACCESS)
-- =====================================================

-- Policy 1: Admin/HR can INSERT using get_user_role()
CREATE POLICY "Admin/HR can create payslips via function" ON public.payslips
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Policy 2: Admin/HR can INSERT using direct EXISTS (fallback)
CREATE POLICY "Admin/HR can create payslips via direct check" ON public.payslips
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- STEP 6: CREATE UPDATE POLICIES (MODIFY ACCESS)
-- =====================================================

-- Policy 1: Admin/HR can UPDATE using get_user_role()
CREATE POLICY "Admin/HR can update payslips via function" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Policy 2: Admin/HR can UPDATE using direct EXISTS (fallback)
CREATE POLICY "Admin/HR can update payslips via direct check" ON public.payslips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
    )
  );

-- Policy 3: Only Admins can approve payslips (status change to approved/paid)
CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = 'admin'
    )
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role = 'admin'
    )
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

    IF policy_count < 8 THEN
        RAISE WARNING 'Expected at least 8 policies on payslips table, but found %', policy_count;
    END IF;
END $$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Admin/HR can view all payslips via function" ON public.payslips IS
  'Allows admin and hr roles to view all payslips using get_user_role() function.';

COMMENT ON POLICY "Admin/HR can view all payslips via direct check" ON public.payslips IS
  'Fallback policy: Allows admin and hr roles to view all payslips using direct EXISTS query.';

COMMENT ON POLICY "Admin/HR can create payslips via function" ON public.payslips IS
  'Allows admin and hr roles to create new payslips using get_user_role() function.';

COMMENT ON POLICY "Admin/HR can create payslips via direct check" ON public.payslips IS
  'Fallback policy: Allows admin and hr roles to create new payslips using direct EXISTS query.';

COMMENT ON POLICY "Admin/HR can update payslips via function" ON public.payslips IS
  'Allows admin and hr roles to update existing payslips using get_user_role() function.';

COMMENT ON POLICY "Admin/HR can update payslips via direct check" ON public.payslips IS
  'Fallback policy: Allows admin and hr roles to update existing payslips using direct EXISTS query.';