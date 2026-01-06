-- =====================================================
-- 107: Simplify Payslips SELECT RLS
-- =====================================================
-- Ensure SELECT policy works correctly for admin/HR
-- Remove complex OR logic that might be causing issues
-- =====================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;

-- Create a single, simple SELECT policy for admin/hr
CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- Add a fallback policy for authenticated users (but this should only work if admin/hr check passes)
-- Actually, let's not add this - admin/hr should be the only ones who can view
-- But if we need a fallback, we can add it later
