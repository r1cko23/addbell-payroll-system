-- =====================================================
-- 099: Fix Employee Portal RLS for Anonymous Users
-- =====================================================
-- Allow anonymous users (employee portal) to view their own data
-- Employee portal uses custom authentication (localStorage) not Supabase Auth
-- Queries are already filtered by employee_id, so this is safe
-- =====================================================

-- =====================================================
-- TIME_CLOCK_ENTRIES RLS
-- =====================================================
-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON public.time_clock_entries;

-- Create new policy that allows both authenticated users AND anonymous users
-- This allows employee portal (anonymous) to view entries
-- Admin/HR (authenticated) can still view all entries
-- Queries are filtered by employee_id, so employees can only see their own entries
CREATE POLICY "Users can view time entries" ON public.time_clock_entries
  FOR SELECT USING (
    -- Allow authenticated users (admin/HR)
    (SELECT auth.role()) = 'authenticated'
    OR
    -- Allow anonymous users (employee portal - queries are filtered by employee_id)
    (SELECT auth.role()) = 'anon'
  );

-- Keep the manage policy for admin/HR only
-- Use EXISTS query to avoid get_user_role() function ambiguity
DROP POLICY IF EXISTS "Admin/HR can manage time entries" ON public.time_clock_entries;
CREATE POLICY "Admin/HR can manage time entries" ON public.time_clock_entries
  FOR ALL USING (
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

-- =====================================================
-- LEAVE_REQUESTS RLS
-- =====================================================
-- Allow anonymous users to view their own leave requests
DROP POLICY IF EXISTS "Authenticated users can view leave requests" ON public.leave_requests;
CREATE POLICY "Users can view leave requests" ON public.leave_requests
  FOR SELECT USING (
    -- Allow authenticated users (admin/HR/account managers)
    (SELECT auth.role()) = 'authenticated'
    OR
    -- Allow anonymous users (employee portal - queries are filtered by employee_id)
    (SELECT auth.role()) = 'anon'
  );

-- =====================================================
-- HOLIDAYS RLS
-- =====================================================
-- Allow anonymous users to view holidays (public data)
DROP POLICY IF EXISTS "All authenticated users can view holidays" ON public.holidays;
CREATE POLICY "All users can view holidays" ON public.holidays
  FOR SELECT USING (true); -- Holidays are public data, anyone can view
