-- =====================================================
-- RPC to create overtime request (SECURITY DEFINER) to avoid client 401s
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_overtime_request(
  p_employee_id UUID,
  p_ot_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_total_hours NUMERIC,
  p_reason TEXT DEFAULT NULL
)
RETURNS public.overtime_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.overtime_requests;
BEGIN
  INSERT INTO public.overtime_requests (
    employee_id,
    ot_date,
    start_time,
    end_time,
    total_hours,
    reason,
    status
  )
  VALUES (
    p_employee_id,
    p_ot_date,
    p_start_time,
    p_end_time,
    p_total_hours,
    p_reason,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_overtime_request(UUID, DATE, TIME, TIME, NUMERIC, TEXT) TO anon, authenticated;
