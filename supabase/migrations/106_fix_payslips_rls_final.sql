-- =====================================================
-- 106: Final Fix Payslips RLS - Ensure Admin/HR Can Save
-- =====================================================
-- Simplify policies to ensure they work correctly
-- Remove the fallback that allows all authenticated users for INSERT
-- =====================================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admin/HR can create payslips" ON public.payslips;

-- Create a clean INSERT policy that only allows admin/hr
-- Remove the fallback that was causing issues
CREATE POLICY "Admin/HR can create payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- Also ensure SELECT policy is correct (should already be fine, but verify)
-- Keep the existing SELECT policies as they are working
