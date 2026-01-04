-- =====================================================
-- 136: Fix Night Differential for Supervisory and Managerial Employees
-- =====================================================
-- Office-based SUPERVISORY and MANAGERIAL employees should NOT have night differential
-- Only RANK AND FILE office-based employees should get night differential
-- Account Supervisors (client-based) also don't get night differential
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_time_clock_hours()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  total_minutes DECIMAL(10,2);
  work_minutes DECIMAL(10,2);
  shift_start TIME;
  shift_end TIME;
  v_clock_in_ph TIMESTAMP WITH TIME ZONE;
  v_clock_out_ph TIMESTAMP WITH TIME ZONE;
  v_clock_in_time TIME;
  v_clock_out_time TIME;
  v_clock_in_date DATE;
  v_clock_out_date DATE;
  v_day_of_week INTEGER;
  shift_duration DECIMAL(10,2);
  break_hours DECIMAL(10,2);
  expected_hours DECIMAL(10,2);
  night_start_time TIME := '17:00:00'; -- 5PM
  night_end_time TIME := '06:00:00';   -- 6AM next day
  night_hours DECIMAL(10,2);
  is_account_supervisor BOOLEAN;
  v_job_level TEXT;
  should_calculate_nd BOOLEAN := TRUE;
BEGIN
  IF NEW.clock_out_time IS NOT NULL AND NEW.clock_in_time IS NOT NULL THEN
    -- Convert to Philippines timezone for accurate time comparisons
    v_clock_in_ph := NEW.clock_in_time AT TIME ZONE 'Asia/Manila';
    v_clock_out_ph := NEW.clock_out_time AT TIME ZONE 'Asia/Manila';
    v_clock_in_time := v_clock_in_ph::TIME;
    v_clock_out_time := v_clock_out_ph::TIME;
    v_clock_in_date := v_clock_in_ph::DATE;
    v_clock_out_date := v_clock_out_ph::DATE;

    total_minutes := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 60;
    work_minutes := total_minutes - COALESCE(NEW.total_break_minutes, 0);
    NEW.total_hours := ROUND(work_minutes / 60.0, 2);

    v_day_of_week := EXTRACT(DOW FROM v_clock_in_ph);

    -- Check employee details for night differential eligibility
    SELECT
      UPPER(COALESCE(e.position, '')) LIKE '%ACCOUNT SUPERVISOR%',
      e.job_level
    INTO is_account_supervisor, v_job_level
    FROM public.employees e
    WHERE e.id = NEW.employee_id;

    -- Default to false if employee not found
    is_account_supervisor := COALESCE(is_account_supervisor, false);
    v_job_level := COALESCE(v_job_level, '');

    -- Determine if night differential should be calculated
    -- NO night differential for:
    -- 1. Account Supervisors (client-based)
    -- 2. Office-based SUPERVISORY employees
    -- 3. Office-based MANAGERIAL employees
    -- YES night differential for:
    -- 1. Office-based RANK AND FILE employees
    IF is_account_supervisor THEN
      should_calculate_nd := FALSE;
    ELSIF UPPER(v_job_level) = 'SUPERVISORY' THEN
      should_calculate_nd := FALSE;
    ELSIF UPPER(v_job_level) = 'MANAGERIAL' THEN
      should_calculate_nd := FALSE;
    END IF;

    SELECT es.shift_start_time, es.shift_end_time
    INTO shift_start, shift_end
    FROM public.employee_schedules es
    WHERE es.employee_id = NEW.employee_id
      AND es.day_of_week = v_day_of_week
      AND es.is_active = true
    LIMIT 1;

    IF shift_start IS NOT NULL AND shift_end IS NOT NULL THEN
      shift_duration := EXTRACT(EPOCH FROM (shift_end::TIME - shift_start::TIME)) / 3600;
      break_hours := COALESCE(NEW.total_break_minutes, 0) / 60.0;
      expected_hours := shift_duration - break_hours;
      NEW.regular_hours := LEAST(NEW.total_hours, expected_hours);
    ELSE
      -- No schedule defined, assume 8-hour fixed schedule (8am-5pm)
      NEW.regular_hours := LEAST(NEW.total_hours, 8);
    END IF;

    -- IMPORTANT: OT hours should NOT be auto-calculated
    -- OT hours must come from approved overtime_requests table
    -- Set overtime_hours to 0 - it will be populated from overtime_requests when generating timesheet
    NEW.overtime_hours := 0;

    -- Calculate night differential hours (5PM - 6AM next day)
    -- Using Philippines timezone for accurate calculation
    night_hours := 0;

    IF should_calculate_nd THEN
      -- Case 1: Clock in and out on the same day, both after 5PM
      IF v_clock_in_time >= night_start_time AND v_clock_out_time >= night_start_time AND v_clock_in_date = v_clock_out_date THEN
        night_hours := EXTRACT(EPOCH FROM (v_clock_out_ph - v_clock_in_ph)) / 3600.0;

      -- Case 2: Clock in before 5PM, clock out after 5PM (SAME DAY)
      ELSIF v_clock_in_time < night_start_time AND v_clock_out_time >= night_start_time AND v_clock_in_date = v_clock_out_date THEN
        night_hours := EXTRACT(EPOCH FROM (v_clock_out_ph - (v_clock_in_date + night_start_time))) / 3600.0;

      -- Case 3: Clock in after 5PM, clock out after midnight but before 6AM next day
      ELSIF v_clock_in_time >= night_start_time AND v_clock_out_time < night_end_time AND v_clock_out_date > v_clock_in_date THEN
        -- Hours from clock_in to midnight + hours from midnight to clock_out
        night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - v_clock_in_ph)) / 3600.0;
        night_hours := night_hours + EXTRACT(EPOCH FROM (v_clock_out_ph - v_clock_out_date)) / 3600.0;

      -- Case 4: Clock in before 5PM, clock out after midnight but before 6AM next day
      ELSIF v_clock_in_time < night_start_time AND v_clock_out_time < night_end_time AND v_clock_out_date > v_clock_in_date THEN
        -- Hours from 5PM to midnight + hours from midnight to clock_out
        night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - (v_clock_in_date + night_start_time))) / 3600.0;
        night_hours := night_hours + EXTRACT(EPOCH FROM (v_clock_out_ph - v_clock_out_date)) / 3600.0;

      -- Case 5: Clock in after 5PM, clock out after 6AM next day
      ELSIF v_clock_in_time >= night_start_time AND v_clock_out_time >= night_end_time AND v_clock_out_date > v_clock_in_date THEN
        -- Hours from clock_in to midnight + 6 hours (midnight to 6AM)
        night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - v_clock_in_ph)) / 3600.0;
        night_hours := night_hours + 6.0;

      -- Case 6: Clock in before 5PM, clock out after 6AM next day
      ELSIF v_clock_in_time < night_start_time AND v_clock_out_time >= night_end_time AND v_clock_out_date > v_clock_in_date THEN
        -- Hours from 5PM to midnight + 6 hours (midnight to 6AM)
        night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - (v_clock_in_date + night_start_time))) / 3600.0;
        night_hours := night_hours + 6.0;
      END IF;
    END IF;

    -- Set night differential hours
    -- Only RANK AND FILE office-based employees get night differential
    -- Account Supervisors, SUPERVISORY, and MANAGERIAL employees get 0
    IF should_calculate_nd THEN
      NEW.total_night_diff_hours := ROUND(GREATEST(0, LEAST(night_hours, NEW.total_hours)), 2);
    ELSE
      NEW.total_night_diff_hours := 0;
    END IF;

    NEW.status := 'auto_approved';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION calculate_time_clock_hours IS
  'Calculates regular hours and night differential for time clock entries. Night differential is ONLY calculated for office-based RANK AND FILE employees. Account Supervisors, SUPERVISORY, and MANAGERIAL employees get 0 night differential hours. OT hours are NOT auto-calculated - they must come from approved overtime_requests table.';