-- =====================================================
-- 081: Allow Admin Access to OT Approvals
-- =====================================================
-- Restore admin access to OT approvals alongside account managers
-- =====================================================

-- Update approve_overtime_request function to allow both admin and account_manager
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
  -- Allow both account managers and admins to approve OT
  IF v_role NOT IN ('account_manager', 'admin') THEN
    RAISE EXCEPTION 'Only account managers and admins can approve OT requests';
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
      account_manager_id = CASE WHEN v_role = 'account_manager' THEN auth.uid() ELSE account_manager_id END
  WHERE id = p_request_id;

  -- Credit offsets for approved OT (all days)
  UPDATE public.employees
  SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
  WHERE id = v_req.employee_id;
END;
$$;

-- Update reject_overtime_request function to allow both admin and account_manager
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
  -- Allow both account managers and admins to reject OT
  IF v_role NOT IN ('account_manager', 'admin') THEN
    RAISE EXCEPTION 'Only account managers and admins can reject OT requests';
  END IF;

  UPDATE public.overtime_requests
  SET status = 'rejected',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE WHEN v_role = 'account_manager' THEN auth.uid() ELSE account_manager_id END,
      reason = COALESCE(reason, p_reason)
  WHERE id = p_request_id;
END;
$$;

-- Update RLS policies to allow both admin and account_manager
DROP POLICY IF EXISTS "Account managers can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers can manage OT requests" ON public.overtime_requests;

CREATE POLICY "Account managers/admin can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager', 'admin'))
  );

CREATE POLICY "Account managers/admin can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager', 'admin'))
  );

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_overtime_request(UUID, TEXT) TO authenticated;
