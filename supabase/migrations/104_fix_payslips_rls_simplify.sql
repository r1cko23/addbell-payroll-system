-- =====================================================
-- 104: Simplify Payslips RLS Policies
-- =====================================================
-- Simplify the EXISTS queries to use auth.uid() directly
-- This should fix 403 errors when admin/HR tries to save payslips
-- =====================================================

-- Drop existing SELECT policies
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;

-- Create simplified SELECT policies
-- Use auth.uid() directly instead of nested SELECT
CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- Fallback for all authenticated users
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- Drop and recreate INSERT policy with simplified query
DROP POLICY IF EXISTS "Admin/HR can create payslips" ON public.payslips;

CREATE POLICY "Admin/HR can create payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

-- Drop and recreate UPDATE policies with simplified queries
DROP POLICY IF EXISTS "Admin/HR can update payslips" ON public.payslips;
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;

CREATE POLICY "Admin/HR can update payslips" ON public.payslips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
      AND users.is_active = true
    )
  );

-- Drop and recreate DELETE policy with simplified query
DROP POLICY IF EXISTS "Admin/HR can delete payslips" ON public.payslips;

CREATE POLICY "Admin/HR can delete payslips" ON public.payslips
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
      AND users.is_active = true
    )
  );

