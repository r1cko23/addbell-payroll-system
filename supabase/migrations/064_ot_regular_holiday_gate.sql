-- =====================================================
-- 064: Gate OT offset credits by regular holiday
--  - approve_overtime_request now credits offset_hours only when the
--    OT date is a regular holiday (is_active).
--  - Prevents non-holiday OT from inflating offset credits.
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
  v_holiday_type TEXT;
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

  -- Determine if OT date is a regular holiday
  SELECT holiday_type
  INTO v_holiday_type
  FROM public.holidays
  WHERE holiday_date = v_req.ot_date
    AND is_active = TRUE
  LIMIT 1;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid()
  WHERE id = p_request_id;

  -- Only credit offset hours when OT is on a regular holiday
  IF v_holiday_type = 'regular' THEN
    UPDATE public.employees
    SET offset_hours = COALESCE(offset_hours,0) + COALESCE(v_req.total_hours,0)
    WHERE id = v_req.employee_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;
