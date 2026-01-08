-- =====================================================
-- 144: Fix OT Approval for All Approvers
-- =====================================================
-- The approve_overtime_request function only allowed 'account_manager' and 'admin'
-- but the actual role in users table is 'approver' (not 'account_manager')
-- This migration fixes the function to allow 'approver' role to approve OT requests
-- =====================================================

-- Update approve_overtime_request function to allow admin, approver roles
-- Note: 'account_manager' role doesn't exist in users table - it's 'approver'
CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.overtime_requests;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  -- Allow admin and approver roles to approve OT
  -- Note: 'approver' is the actual role name in users table (not 'account_manager')
  IF v_role NOT IN ('approver', 'admin') THEN
    RAISE EXCEPTION 'Only admins and approvers can approve OT requests';
  END IF;

  SELECT * INTO v_req FROM public.overtime_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN;
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE WHEN v_role = 'approver' THEN auth.uid() ELSE account_manager_id END
  WHERE id = p_request_id;

  -- Credit offsets for approved OT (all days)
  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

-- Update reject_overtime_request function to allow admin, approver roles
CREATE OR REPLACE FUNCTION public.reject_overtime_request(p_request_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  -- Allow admin and approver roles to reject OT
  -- Note: 'approver' is the actual role name in users table (not 'account_manager')
  IF v_role NOT IN ('approver', 'admin') THEN
    RAISE EXCEPTION 'Only admins and approvers can reject OT requests';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE WHEN v_role = 'approver' THEN auth.uid() ELSE account_manager_id END,
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

-- Update RLS policies to allow admin and approver roles
DROP POLICY IF EXISTS "Account managers/admin can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can manage OT requests" ON public.overtime_requests;

CREATE POLICY "Admins and approvers can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('approver', 'admin'))
  );

CREATE POLICY "Admins and approvers can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('approver', 'admin'))
  );

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(UUID, TEXT) TO authenticated;