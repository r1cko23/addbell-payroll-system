-- =====================================================
-- 120: Fix Attendance Calculation Rules
-- =====================================================
-- Rules:
-- 1. For non-Account Supervisors: Only full completed 8 hours are recorded as working days
-- 2. OT and ND should come from overtime_requests once approved (not from clock times)
-- 3. For Account Supervisors: As long as they complete 8 hours, that's counted as 1 working day (flexi time)
-- 4. Night differential should NOT be calculated from clock times - it comes from overtime_requests
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
  is_account_supervisor BOOLEAN;
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
    
    -- Automatically apply 1-hour break (60 minutes) for all working days if not already set
    -- Every working day has a 1-hour break by default
    IF COALESCE(NEW.total_break_minutes, 0) = 0 THEN
      NEW.total_break_minutes := 60;
    END IF;
    
    work_minutes := total_minutes - COALESCE(NEW.total_break_minutes, 0);
    NEW.total_hours := ROUND(work_minutes / 60.0, 2);

    v_day_of_week := EXTRACT(DOW FROM v_clock_in_ph);

    -- Check if employee is Account Supervisor
    SELECT 
      UPPER(COALESCE(e.position, '')) LIKE '%ACCOUNT SUPERVISOR%'
    INTO is_account_supervisor
    FROM public.employees e
    WHERE e.id = NEW.employee_id;

    -- Default to false if employee not found
    is_account_supervisor := COALESCE(is_account_supervisor, false);

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
      
      -- For Account Supervisors: count all hours up to expected hours (flexi time)
      -- As long as they complete 8 hours, that's counted as 1 working day
      IF is_account_supervisor THEN
        -- Account Supervisors: flexi time - if they complete 8 hours, count as 8 hours
        IF NEW.total_hours >= 8 THEN
          NEW.regular_hours := 8;
        ELSE
          NEW.regular_hours := NEW.total_hours;
        END IF;
      ELSE
        -- Non-Account Supervisors: only full completed 8 hours are recorded
        -- If they work less than 8 hours, it doesn't count as a working day (regular_hours = 0)
        -- If they work exactly 8 hours or more, cap at 8 hours
        IF NEW.total_hours >= expected_hours THEN
          NEW.regular_hours := expected_hours;
        ELSE
          -- Less than full 8 hours - don't count as working day
          NEW.regular_hours := 0;
        END IF;
      END IF;
    ELSE
      -- No schedule defined, assume 8-hour fixed schedule (8am-5pm)
      IF is_account_supervisor THEN
        -- Account Supervisors: flexi time - if they complete 8 hours, count as 8 hours
        IF NEW.total_hours >= 8 THEN
          NEW.regular_hours := 8;
        ELSE
          NEW.regular_hours := NEW.total_hours;
        END IF;
      ELSE
        -- Non-Account Supervisors: only full completed 8 hours are recorded
        -- If they work less than 8 hours, it doesn't count as a working day (regular_hours = 0)
        IF NEW.total_hours >= 8 THEN
          NEW.regular_hours := 8;
        ELSE
          -- Less than full 8 hours - don't count as working day
          NEW.regular_hours := 0;
        END IF;
      END IF;
    END IF;

    -- IMPORTANT: OT hours should NOT be auto-calculated
    -- OT hours must come from approved overtime_requests table
    -- Set overtime_hours to 0 - it will be populated from overtime_requests when generating timesheet
    NEW.overtime_hours := 0;

    -- IMPORTANT: Night differential should NOT be calculated from clock times
    -- ND must come from approved overtime_requests table
    -- Set night_diff_hours to 0 - it will be populated from overtime_requests when generating timesheet
    NEW.total_night_diff_hours := 0;

    NEW.status := 'auto_approved';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION calculate_time_clock_hours IS
  'Calculates regular hours for time clock entries. OT and ND hours are NOT auto-calculated - they must come from approved overtime_requests table. For non-Account Supervisors, only full 8 hours count as working days.';
