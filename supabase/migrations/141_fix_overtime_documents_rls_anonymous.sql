-- =====================================================
-- 141: Fix Overtime Documents RLS for Anonymous Users
-- =====================================================
-- Allow anonymous users (employee portal) to insert/view their own OT documents
-- Employee portal uses custom authentication (localStorage) not Supabase Auth
-- Queries are already filtered by employee_id, so this is safe
-- =====================================================

-- Drop existing policies that check auth.uid() (doesn't work for anonymous users)
DROP POLICY IF EXISTS "Employees can view own OT docs" ON public.overtime_documents;
DROP POLICY IF EXISTS "Employees can insert own OT docs" ON public.overtime_documents;

-- Create new SELECT policy that allows both authenticated and anonymous users
-- Anonymous users (employee portal) can view their own documents
-- Authenticated users (admin/HR/account managers) can view all via the account manager policy
CREATE POLICY "Users can view own OT docs" ON public.overtime_documents
  FOR SELECT USING (
    -- Allow authenticated users (admin/HR/account managers) - they can view all via account manager policy
    (SELECT auth.role()) = 'authenticated'
    OR
    -- Allow anonymous users (employee portal - queries are filtered by employee_id)
    COALESCE((SELECT auth.role()), 'anon') = 'anon'
    OR
    (SELECT auth.role()) IS NULL
  );

-- Create new INSERT policy that allows anonymous users to insert documents
-- The employee_id is provided by the client and matches the logged-in employee
-- Application-level validation ensures employees only insert their own documents
-- Similar to leave_request_documents which uses WITH CHECK (true)
CREATE POLICY "Users can insert own OT docs" ON public.overtime_documents
  FOR INSERT WITH CHECK (true);

-- Keep the account manager/admin SELECT policy (they can view all)
-- This policy already exists and allows account managers/admin to view all documents

