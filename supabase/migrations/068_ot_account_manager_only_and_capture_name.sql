-- =====================================================
-- 068: OT Approvals - Account Manager Only & Capture Name
--  - Restrict OT approvals to account managers only (remove admin access)
--  - Set account_manager_id when approving to capture approver name
-- =====================================================

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
  -- Only account managers can approve OT (admins cannot)
  IF v_role != 'account_manager' THEN
    RAISE EXCEPTION 'Only account managers can approve OT requests';
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
      account_manager_id = auth.uid()
  WHERE id = p_request_id;

  -- Credit offsets for approved OT (all days)
  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

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
  -- Only account managers can reject OT (admins cannot)
  IF v_role != 'account_manager' THEN
    RAISE EXCEPTION 'Only account managers can reject OT requests';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = auth.uid(),
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(UUID, TEXT) TO authenticated;



