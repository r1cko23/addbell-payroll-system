-- =====================================================
-- 114: Payslips Ultra Permissive All Operations
-- =====================================================
-- Make ALL operations ultra-permissive using auth.uid()
-- This ensures Admin/HR can perform all operations
-- =====================================================

-- Drop all existing policies
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "Authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can create payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can update payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can delete payslips" ON public.payslips;

-- SELECT: Any authenticated user can view
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- INSERT: Any authenticated user can create
CREATE POLICY "All authenticated users can create payslips" ON public.payslips
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: Any authenticated user can update
CREATE POLICY "All authenticated users can update payslips" ON public.payslips
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: Admin/HR only (keep this restricted)
CREATE POLICY "Admin/HR can delete payslips" ON public.payslips
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 
      FROM public.users 
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'hr')
        AND users.is_active = true
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "All authenticated users can view payslips" ON public.payslips IS
  'Ultra-permissive: Allows any authenticated user to view payslips.';

COMMENT ON POLICY "All authenticated users can create payslips" ON public.payslips IS
  'Ultra-permissive: Allows any authenticated user to create payslips.';

COMMENT ON POLICY "All authenticated users can update payslips" ON public.payslips IS
  'Ultra-permissive: Allows any authenticated user to update payslips.';






