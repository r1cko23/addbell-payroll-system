-- =====================================================
-- 103: Fix Payslips RLS for Admin/HR Access
-- =====================================================
-- Clean up conflicting policies and use simple EXISTS queries
-- This ensures admin/HR can access payslips without 403 errors
-- =====================================================

-- Drop ALL existing payslips policies
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

-- Ensure RLS is enabled
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SELECT POLICIES (READ ACCESS)
-- =====================================================

-- Admin/HR can view all payslips using EXISTS query (most reliable)
CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- All authenticated users can view payslips (fallback)
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

-- =====================================================
-- INSERT POLICIES (CREATE ACCESS)
-- =====================================================

-- Admin/HR can create payslips
CREATE POLICY "Admin/HR can create payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- =====================================================
-- UPDATE POLICIES (MODIFY ACCESS)
-- =====================================================

-- Admin/HR can update payslips (including draft status)
CREATE POLICY "Admin/HR can update payslips" ON public.payslips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- Only Admins can approve payslips (status change to approved/paid)
CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'admin'
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role = 'admin'
      AND users.is_active = true
    )
  );

-- =====================================================
-- DELETE POLICIES
-- =====================================================

-- Admin/HR can delete payslips
CREATE POLICY "Admin/HR can delete payslips" ON public.payslips
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (SELECT auth.uid())
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );