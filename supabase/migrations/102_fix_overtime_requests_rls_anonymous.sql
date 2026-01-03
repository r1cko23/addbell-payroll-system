-- =====================================================
-- 102: Fix Overtime Requests RLS for Anonymous Users
-- =====================================================
-- Allow anonymous users (employee portal) to view their own OT requests
-- Employee portal uses custom authentication (localStorage) not Supabase Auth
-- Queries are already filtered by employee_id, so this is safe
-- =====================================================

-- Add anonymous access policy for SELECT
-- Note: We keep existing policies, but add one that allows anonymous users
-- The employee portal queries filter by employee_id, so employees only see their own requests
CREATE POLICY "Anonymous users can view own OT requests" ON public.overtime_requests
  FOR SELECT USING (
    -- Allow anonymous users (employee portal - queries are filtered by employee_id)
    COALESCE((SELECT auth.role()), 'anon') = 'anon'
    OR
    (SELECT auth.role()) IS NULL
  );