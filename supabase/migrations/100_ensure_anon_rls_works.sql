-- =====================================================
-- 100: Ensure Anonymous RLS Works Correctly
-- =====================================================
-- Fix RLS policy to handle null/undefined auth.role() cases
-- When no session exists, auth.role() might return null
-- We need to explicitly allow anonymous access
-- =====================================================

-- Drop and recreate the SELECT policy with better null handling
DROP POLICY IF EXISTS "Users can view time entries" ON public.time_clock_entries;

-- Create policy that explicitly handles null/anon cases
-- COALESCE ensures null is treated as 'anon'
CREATE POLICY "Users can view time entries" ON public.time_clock_entries
  FOR SELECT USING (
    -- Allow authenticated users (admin/HR)
    COALESCE((SELECT auth.role()), 'anon') = 'authenticated'
    OR
    -- Allow anonymous users (employee portal - queries are filtered by employee_id)
    COALESCE((SELECT auth.role()), 'anon') = 'anon'
    OR
    -- Explicitly allow when auth.role() is null (no session = anonymous)
    (SELECT auth.role()) IS NULL
  );

-- Also update leave_requests policy
DROP POLICY IF EXISTS "Users can view leave requests" ON public.leave_requests;
CREATE POLICY "Users can view leave requests" ON public.leave_requests
  FOR SELECT USING (
    COALESCE((SELECT auth.role()), 'anon') = 'authenticated'
    OR
    COALESCE((SELECT auth.role()), 'anon') = 'anon'
    OR
    (SELECT auth.role()) IS NULL
  );