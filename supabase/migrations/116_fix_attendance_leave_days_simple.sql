-- =====================================================
-- 116: Fix Attendance Leave Days - Simplified
-- =====================================================
-- Simplified function to update attendance_data with leave days
-- This is a helper function - the main logic is in the application code
-- =====================================================

-- Function to get leave dates for an employee in a period
CREATE OR REPLACE FUNCTION get_leave_dates_for_period(
  p_employee_id UUID,
  p_period_start DATE,
  p_period_end DATE
)
RETURNS TABLE(
  leave_date DATE,
  leave_type TEXT,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leave RECORD;
  v_date DATE;
BEGIN
  FOR v_leave IN
    SELECT 
      leave_type,
      start_date,
      end_date,
      selected_dates,
      status
    FROM leave_requests
    WHERE employee_id = p_employee_id
      AND status IN ('approved_by_manager', 'approved_by_hr')
      AND start_date <= p_period_end
      AND end_date >= p_period_start
  LOOP
    -- Handle selected_dates if available
    IF v_leave.selected_dates IS NOT NULL THEN
      -- Process each selected date
      FOR v_date IN 
        SELECT (jsonb_array_elements_text(v_leave.selected_dates))::DATE
        WHERE (jsonb_array_elements_text(v_leave.selected_dates))::DATE 
          BETWEEN p_period_start AND p_period_end
      LOOP
        RETURN QUERY SELECT v_date, v_leave.leave_type, v_leave.status;
      END LOOP;
    ELSE
      -- Handle date range
      FOR v_date IN 
        SELECT generate_series(
          GREATEST(v_leave.start_date, p_period_start),
          LEAST(v_leave.end_date, p_period_end),
          '1 day'::interval
        )::DATE
      LOOP
        RETURN QUERY SELECT v_date, v_leave.leave_type, v_leave.status;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION get_leave_dates_for_period IS
  'Returns all leave dates for an employee within a period. Used by application code to update attendance_data with leave days.';








