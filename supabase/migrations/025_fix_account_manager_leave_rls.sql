-- =====================================================
-- FIX ACCOUNT MANAGER LEAVE REQUEST RLS POLICIES
-- =====================================================
-- Any account manager can view and approve all leave requests.
-- This allows flexibility for account managers to handle any employee's requests.

-- Drop the existing policies
DROP POLICY IF EXISTS "Account managers can view assigned leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Account managers can manage assigned leave requests" ON public.leave_requests;

-- Account managers can view all leave requests
CREATE POLICY "Account managers can view all leave requests" ON public.leave_requests
  FOR SELECT USING (public.get_user_role() = 'account_manager');

-- Account managers can manage (approve/reject) all leave requests
CREATE POLICY "Account managers can manage all leave requests" ON public.leave_requests
  FOR UPDATE USING (public.get_user_role() = 'account_manager');

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Account managers can view all leave requests" ON public.leave_requests IS
  'Any account manager can view all leave requests.';
COMMENT ON POLICY "Account managers can manage all leave requests" ON public.leave_requests IS
  'Any account manager can approve/reject all leave requests.';