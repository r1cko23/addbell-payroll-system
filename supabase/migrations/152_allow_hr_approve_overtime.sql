-- =====================================================
-- 152: Allow HR to approve and reject overtime requests
-- =====================================================
-- HR can approve/reject all OT requests (including for their own direct reports).
-- Add 'hr' to approve_overtime_request, reject_overtime_request, and manage RLS.
-- =====================================================

-- Update approve_overtime_request to allow admin, approver, and hr
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
  IF v_role NOT IN ('approver', 'admin', 'hr') THEN
    RAISE EXCEPTION 'Only admins, approvers, and HR can approve OT requests';
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

  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

-- Update reject_overtime_request to allow admin, approver, and hr
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
  IF v_role NOT IN ('approver', 'admin', 'hr') THEN
    RAISE EXCEPTION 'Only admins, approvers, and HR can reject OT requests';
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

-- Allow HR to update overtime_requests (approve/reject updates status)
DROP POLICY IF EXISTS "Admins and approvers can manage OT requests" ON public.overtime_requests;

CREATE POLICY "Admins, approvers, and HR can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('approver', 'admin', 'hr'))
  );

COMMENT ON POLICY "Admins, approvers, and HR can manage OT requests" ON public.overtime_requests IS
  'Allows admin, approver, and hr to update OT requests (approve/reject).';
