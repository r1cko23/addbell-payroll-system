-- =====================================================
-- 117: Fix OT Calculation for Fixed Schedule Employees
-- =====================================================
-- For employees with fixed schedule (8am-5pm) who are NOT Account Supervisors:
-- - Hours worked after 5pm should be counted as OT
-- - ND is already calculated correctly (from 5pm onwards)
-- - OT and ND can overlap (hours after 5pm count as both OT and ND)
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
  overtime_hours DECIMAL(10,2);
  is_account_supervisor BOOLEAN;
  fixed_schedule_end TIME := '17:00:00'; -- 5PM for fixed schedule employees
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
      NEW.regular_hours := LEAST(NEW.total_hours, expected_hours);
      
      -- Calculate OT for fixed schedule employees (NOT Account Supervisors)
      -- OT = hours worked after shift_end (typically 5pm)
      IF NOT is_account_supervisor AND NEW.total_hours > expected_hours THEN
        -- Calculate hours worked after shift_end
        IF v_clock_out_time > shift_end THEN
          -- Same day: OT = hours from shift_end to clock_out (using PH timezone)
          IF v_clock_in_date = v_clock_out_date THEN
            overtime_hours := EXTRACT(EPOCH FROM (v_clock_out_ph - (v_clock_in_date + shift_end))) / 3600.0;
          ELSE
            -- Crosses midnight: OT = hours from shift_end to midnight + hours from midnight to clock_out
            overtime_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - (v_clock_in_date + shift_end))) / 3600.0;
            overtime_hours := overtime_hours + EXTRACT(EPOCH FROM (v_clock_out_ph - v_clock_out_date)) / 3600.0;
          END IF;
          -- Ensure OT doesn't exceed total hours minus regular hours
          overtime_hours := LEAST(overtime_hours, NEW.total_hours - NEW.regular_hours);
        ELSE
          overtime_hours := 0;
        END IF;
      ELSE
        overtime_hours := 0;
      END IF;
    ELSE
      -- No schedule defined, assume 8-hour fixed schedule (8am-5pm)
      NEW.regular_hours := LEAST(NEW.total_hours, 8);
      
      -- Calculate OT for fixed schedule employees (NOT Account Supervisors)
      -- OT = hours worked after 5pm
      IF NOT is_account_supervisor AND NEW.total_hours > 8 THEN
        IF v_clock_out_time > fixed_schedule_end THEN
          -- Same day: OT = hours from 5pm to clock_out (using PH timezone)
          IF v_clock_in_date = v_clock_out_date THEN
            overtime_hours := EXTRACT(EPOCH FROM (v_clock_out_ph - (v_clock_in_date + fixed_schedule_end))) / 3600.0;
          ELSE
            -- Crosses midnight: OT = hours from 5pm to midnight + hours from midnight to clock_out
            overtime_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - (v_clock_in_date + fixed_schedule_end))) / 3600.0;
            overtime_hours := overtime_hours + EXTRACT(EPOCH FROM (v_clock_out_ph - v_clock_out_date)) / 3600.0;
          END IF;
          -- Ensure OT doesn't exceed total hours minus regular hours
          overtime_hours := LEAST(overtime_hours, NEW.total_hours - NEW.regular_hours);
        ELSE
          overtime_hours := 0;
        END IF;
      ELSE
        overtime_hours := 0;
      END IF;
    END IF;

    -- Set overtime_hours (round to 2 decimal places)
    NEW.overtime_hours := ROUND(GREATEST(0, overtime_hours), 2);

    -- Calculate night differential hours (5PM - 6AM next day)
    -- Using Philippines timezone for accurate calculation
    night_hours := 0;
    
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
    
    -- Ensure night hours don't exceed total hours worked
    -- Only calculate ND for non-Account Supervisors (they have flexi time)
    IF is_account_supervisor THEN
      NEW.total_night_diff_hours := 0;
    ELSE
      NEW.total_night_diff_hours := ROUND(GREATEST(0, LEAST(night_hours, NEW.total_hours)), 2);
    END IF;

    NEW.status := 'auto_approved';
  END IF;

  RETURN NEW;
END;
$$;

-- =====================================================
-- Recalculate OT for existing entries
-- =====================================================
-- Temporarily disable trigger to prevent recalculation during update
ALTER TABLE time_clock_entries DISABLE TRIGGER trigger_calculate_time_clock_hours;

-- Simple OT calculation: OT = total_hours - regular_hours when clocked out after 5pm
-- This matches the function logic for fixed schedule employees
UPDATE public.time_clock_entries
SET overtime_hours = CASE
  WHEN EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = time_clock_entries.employee_id
      AND UPPER(COALESCE(e.position, '')) LIKE '%ACCOUNT SUPERVISOR%'
  ) THEN 0
  WHEN (clock_out_time AT TIME ZONE 'Asia/Manila')::TIME > '17:00:00'
    AND total_hours > regular_hours
    AND clock_out_time IS NOT NULL
    AND clock_in_time IS NOT NULL
  THEN ROUND(GREATEST(0, total_hours - regular_hours), 2)
  ELSE 0
END
WHERE clock_out_time IS NOT NULL AND clock_in_time IS NOT NULL;

-- Re-enable trigger
ALTER TABLE time_clock_entries ENABLE TRIGGER trigger_calculate_time_clock_hours;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION calculate_time_clock_hours IS
  'Calculates regular hours, overtime hours, and night differential for time clock entries. For fixed schedule employees (8am-5pm) who are NOT Account Supervisors, hours after 5pm are counted as OT and ND.';






