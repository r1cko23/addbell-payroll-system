-- =====================================================
-- 115: Update Attendance Records with Leave Days
-- =====================================================
-- Function to update existing attendance_data to include leave days with BH = 8
-- This ensures leave days are properly counted in payslip calculations
-- =====================================================

-- Function to update attendance_data for a specific attendance record
CREATE OR REPLACE FUNCTION update_attendance_with_leave_days(p_attendance_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance RECORD;
  v_leave_data RECORD;
  v_attendance_data JSONB;
  v_day JSONB;
  v_date_str TEXT;
  v_leave_dates JSONB := '[]'::JSONB;
  v_leave_date TEXT;
BEGIN
  -- Get the attendance record
  SELECT *
  INTO v_attendance
  FROM weekly_attendance
  WHERE id = p_attendance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Attendance record not found: %', p_attendance_id;
  END IF;

  -- Get approved leave requests for this period
  FOR v_leave_data IN
    SELECT
      leave_type,
      start_date,
      end_date,
      selected_dates,
      status
    FROM leave_requests
    WHERE employee_id = v_attendance.employee_id
      AND status IN ('approved_by_manager', 'approved_by_hr')
      AND lte(start_date, v_attendance.period_end)
      AND gte(end_date, v_attendance.period_start)
  LOOP
    -- Handle selected_dates if available
    IF v_leave_data.selected_dates IS NOT NULL THEN
      -- Add each selected date to the leave dates array
      FOR v_leave_date IN SELECT jsonb_array_elements_text(v_leave_data.selected_dates)
      LOOP
        -- Only include dates within the attendance period
        IF v_leave_date >= v_attendance.period_start::TEXT
           AND v_leave_date <= v_attendance.period_end::TEXT THEN
          v_leave_dates := v_leave_dates || jsonb_build_object(
            'date', v_leave_date,
            'leaveType', v_leave_data.leave_type,
            'status', v_leave_data.status
          );
        END IF;
      END LOOP;
    ELSE
      -- Handle date range (start_date to end_date)
      FOR v_date_str IN
        SELECT generate_series(
          GREATEST(v_leave_data.start_date, v_attendance.period_start),
          LEAST(v_leave_data.end_date, v_attendance.period_end),
          '1 day'::interval
        )::DATE::TEXT
      LOOP
        v_leave_dates := v_leave_dates || jsonb_build_object(
          'date', v_date_str,
          'leaveType', v_leave_data.leave_type,
          'status', v_leave_data.status
        );
      END LOOP;
    END IF;
  END LOOP;

  -- Update attendance_data to include leave days
  v_attendance_data := v_attendance.attendance_data;

  -- Update each day in attendance_data
  FOR v_day IN SELECT * FROM jsonb_array_elements(v_attendance_data)
  LOOP
    v_date_str := v_day->>'date';

    -- Check if this date has a leave request
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_leave_dates) AS leave
      WHERE leave->>'date' = v_date_str
        AND leave->>'leaveType' != 'LWOP'
    ) THEN
      -- Update the day to have regularHours = 8 if it's currently 0
      IF (v_day->>'regularHours')::numeric = 0 THEN
        v_attendance_data := jsonb_set(
          v_attendance_data,
          ARRAY[(jsonb_array_elements(v_attendance_data)::text = v_day::text)::int - 1]::text[],
          jsonb_set(v_day, '{regularHours}', '8'::jsonb)
        );
      END IF;
    END IF;
  END LOOP;

  -- Recalculate total_regular_hours
  UPDATE weekly_attendance
  SET
    attendance_data = v_attendance_data,
    total_regular_hours = (
      SELECT COALESCE(SUM((day->>'regularHours')::numeric), 0)
      FROM jsonb_array_elements(v_attendance_data) AS day
    ),
    updated_at = NOW()
  WHERE id = p_attendance_id;
END;
$$;

-- Function to update all attendance records for a specific employee
CREATE OR REPLACE FUNCTION update_all_attendance_with_leave_days(p_employee_id UUID)
RETURNS TABLE(attendance_id UUID, updated BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance RECORD;
BEGIN
  FOR v_attendance IN
    SELECT id
    FROM weekly_attendance
    WHERE employee_id = p_employee_id
  LOOP
    BEGIN
      PERFORM update_attendance_with_leave_days(v_attendance.id);
      RETURN QUERY SELECT v_attendance.id, TRUE;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_attendance.id, FALSE;
    END;
  END LOOP;
END;
$$;

-- Function to update all attendance records (use with caution)
CREATE OR REPLACE FUNCTION update_all_attendance_records_with_leave_days()
RETURNS TABLE(attendance_id UUID, updated BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attendance RECORD;
BEGIN
  FOR v_attendance IN
    SELECT id
    FROM weekly_attendance
  LOOP
    BEGIN
      PERFORM update_attendance_with_leave_days(v_attendance.id);
      RETURN QUERY SELECT v_attendance.id, TRUE;
    EXCEPTION WHEN OTHERS THEN
      RETURN QUERY SELECT v_attendance.id, FALSE;
    END;
  END LOOP;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION update_attendance_with_leave_days IS
  'Updates a specific attendance record to include leave days with regularHours = 8. Leave days (except LWOP) are counted as 8 hours.';

COMMENT ON FUNCTION update_all_attendance_with_leave_days IS
  'Updates all attendance records for a specific employee to include leave days.';

COMMENT ON FUNCTION update_all_attendance_records_with_leave_days IS
  'Updates all attendance records in the database to include leave days. Use with caution.';