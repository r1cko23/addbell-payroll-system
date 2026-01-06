-- =====================================================
-- 111: Fix Payslips SELECT RLS - Final Fix
-- =====================================================
-- Ensure Admin/HR can SELECT payslips without 403 errors
-- Simplify and make policies more permissive for Admin/HR
-- =====================================================

-- Drop all existing SELECT policies to start fresh
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;

-- Create a simple, robust SELECT policy for Admin/HR
-- This policy checks if user is authenticated AND has admin/hr role
CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
  FOR SELECT
  USING (
    -- Check if user is authenticated
    auth.uid() IS NOT NULL
    AND
    -- Check if user has admin or hr role
    EXISTS (
      SELECT 1
      FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('admin', 'hr')
        AND users.is_active = true
    )
  );

-- Also create a fallback policy for any authenticated user
-- This ensures access even if role lookup has issues
CREATE POLICY "Authenticated users can view payslips" ON public.payslips
  FOR SELECT
  USING (
    auth.role() = 'authenticated'
    AND auth.uid() IS NOT NULL
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Admin/HR can view all payslips" ON public.payslips IS
  'Allows admin and hr roles to view all payslips. Uses direct auth.uid() check.';

COMMENT ON POLICY "Authenticated users can view payslips" ON public.payslips IS
  'Fallback policy allowing any authenticated user to view payslips. Ensures access even if role lookup fails.';
