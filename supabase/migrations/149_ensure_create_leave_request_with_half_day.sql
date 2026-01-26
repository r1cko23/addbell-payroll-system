-- =====================================================
-- 149: Ensure create_leave_request has p_half_day_dates
-- =====================================================
-- Fixes PGRST202 when filing half-day LWOP/SIL: the 8-parameter
-- create_leave_request (with p_half_day_dates) must exist so PostgREST
-- can resolve the RPC. Drops the 7-arg overload if present, then
-- creates/replaces the 8-arg version.

-- Remove 7-arg overload (no p_half_day_dates) so only the 8-arg exists
DROP FUNCTION IF EXISTS public.create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.create_leave_request(
  p_employee_id UUID,
  p_leave_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_total_days NUMERIC,
  p_selected_dates JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_half_day_dates JSONB DEFAULT '[]'::jsonb
)
RETURNS leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row leave_requests;
BEGIN
  INSERT INTO leave_requests (
    employee_id,
    leave_type,
    start_date,
    end_date,
    total_days,
    selected_dates,
    half_day_dates,
    reason,
    status
  )
  VALUES (
    p_employee_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    p_total_days,
    p_selected_dates,
    COALESCE(p_half_day_dates, '[]'::jsonb),
    p_reason,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_leave_request IS
  'Creates a leave request. half_day_dates: JSONB array of date strings (YYYY-MM-DD) for half-day. Supports SIL and LWOP half-day.';
