-- =====================================================
-- create_leave_request RPC with half_day_dates support
-- =====================================================
-- Ensures create_leave_request exists and accepts p_half_day_dates
-- so SIL and LWOP can be filed as half-day. Replaces any existing
-- 7-arg version so the app can pass half_day_dates.

DROP FUNCTION IF EXISTS create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT);

CREATE OR REPLACE FUNCTION create_leave_request(
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

GRANT EXECUTE ON FUNCTION create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION create_leave_request IS
  'Creates a leave request. half_day_dates: JSONB array of date strings (YYYY-MM-DD) for half-day. Supports SIL and LWOP half-day.';
