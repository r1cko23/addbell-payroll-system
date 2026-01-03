-- =====================================================
-- 101: Fix Holidays RLS Policy Conflicts
-- =====================================================
-- Remove conflicting policies that block anonymous users
-- Keep only the "All users can view holidays" policy
-- =====================================================

-- Drop all existing SELECT policies on holidays
DROP POLICY IF EXISTS "All users can view holidays" ON public.holidays;
DROP POLICY IF EXISTS "holidays_select" ON public.holidays;
DROP POLICY IF EXISTS "holidays_select_public" ON public.holidays;
DROP POLICY IF EXISTS "All authenticated users can view holidays" ON public.holidays;

-- Create a single, clean SELECT policy that allows all users (including anonymous)
CREATE POLICY "All users can view holidays" ON public.holidays
  FOR SELECT USING (true); -- Holidays are public data, anyone can view

-- Keep the admin-only policies for INSERT/UPDATE/DELETE
-- (These should already exist, but ensure they're correct)
DROP POLICY IF EXISTS "holidays_all_admin" ON public.holidays;
DROP POLICY IF EXISTS "holidays_insert_admin" ON public.holidays;
DROP POLICY IF EXISTS "holidays_update_admin" ON public.holidays;
DROP POLICY IF EXISTS "holidays_delete_admin" ON public.holidays;
DROP POLICY IF EXISTS "Only Admins can manage holidays" ON public.holidays;

-- Admin can manage holidays
CREATE POLICY "Only Admins can manage holidays" ON public.holidays
  FOR ALL USING (
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
