-- =====================================================
-- 065: Allow OT approvals to credit offsets on any day
--  - Removes holiday-type gate from approve_overtime_request.
--  - OT approval credits offset_hours 1:1 regardless of day type.
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
  IF v_role NOT IN ('account_manager','admin') THEN
    RAISE EXCEPTION 'Not authorized';
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
      approved_by = auth.uid()
  WHERE id = p_request_id;

  -- Credit offsets for approved OT (all days)
  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;