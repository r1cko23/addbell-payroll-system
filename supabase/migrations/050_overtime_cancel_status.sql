-- =====================================================
-- Add cancelled status to overtime_requests and guard RPCs
-- =====================================================

ALTER TABLE public.overtime_requests
  DROP CONSTRAINT IF EXISTS overtime_requests_status_check;

ALTER TABLE public.overtime_requests
  ADD CONSTRAINT overtime_requests_status_check
    CHECK (status IN ('pending','approved','rejected','cancelled'));

-- Safeguard approve/reject to skip already final/cancelled
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
  IF v_req.status IN ('approved','rejected','cancelled') THEN
    RETURN;
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid()
  WHERE id = p_request_id;

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
  IF v_role NOT IN ('account_manager','admin') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(UUID, TEXT) TO authenticated;

-- Allow employee cancel (pending only)
CREATE OR REPLACE FUNCTION public.cancel_overtime_request(p_request_id UUID, p_employee_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.overtime_requests
  SET status = 'cancelled'
  WHERE id = p_request_id
    AND employee_id = p_employee_id
    AND status = 'pending';
$$;

GRANT EXECUTE ON FUNCTION public.cancel_overtime_request(UUID, UUID) TO authenticated;