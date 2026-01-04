-- =====================================================
-- 113: Fix Payslips SELECT Using auth.uid()
-- =====================================================
-- Use auth.uid() instead of auth.role() for more reliable auth check
-- auth.role() might not always return 'authenticated' correctly
-- =====================================================

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "Authenticated users can view payslips" ON public.payslips;

-- Create policy using auth.uid() - more reliable than auth.role()
-- If auth.uid() is not null, the user is authenticated
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "All authenticated users can view payslips" ON public.payslips IS
  'Allows any authenticated user (auth.uid() IS NOT NULL) to view payslips. More reliable than checking auth.role().';




