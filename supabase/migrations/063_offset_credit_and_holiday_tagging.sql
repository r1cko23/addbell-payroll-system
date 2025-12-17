-- =====================================================
-- 063: Holiday-aware clock-out + offset credits
--  - Grants offset hours up to 8h for regular holidays per clock entry.
--  - Extra holiday hours beyond 8h should be credited via approved OT
--    (see approve_overtime_request), avoiding double-credit in this trigger.
--  - Keeps existing hour calculations and auto-approve behavior.
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_time_clock_hours()
RETURNS TRIGGER AS $$
DECLARE
  total_minutes INTEGER;
  work_minutes INTEGER;
  shift_start TIME;
  shift_end TIME;
  night_minutes INTEGER;
  v_clock_date DATE;
  v_holiday_type TEXT;
  is_first_clock_out BOOLEAN := FALSE;
  v_offset_credit NUMERIC := 0;
BEGIN
  -- Only calculate if clock_out_time is set and clock_in_time exists
  IF NEW.clock_out_time IS NOT NULL AND NEW.clock_in_time IS NOT NULL THEN
    -- Calculate total minutes worked
    total_minutes := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 60;

    -- Subtract break time
    work_minutes := total_minutes - COALESCE(NEW.total_break_minutes, 0);

    -- Convert to hours
    NEW.total_hours := ROUND(work_minutes / 60.0, 2);

    -- Get employee's schedule for this day (if exists)
    SELECT
      es.shift_start_time,
      es.shift_end_time
    INTO shift_start, shift_end
    FROM public.employee_schedules es
    WHERE es.employee_id = NEW.employee_id
      AND es.day_of_week = EXTRACT(DOW FROM NEW.clock_in_time)
      AND es.is_active = TRUE
    LIMIT 1;

    -- Calculate regular vs overtime hours
    -- Cap regular hours at 8 hours
    -- Overtime only comes from approved OT requests
    IF NEW.total_hours > 8 THEN
      NEW.regular_hours := 8.0;
      NEW.overtime_hours := 0; -- OT must be filed separately
    ELSE
      NEW.regular_hours := NEW.total_hours;
      NEW.overtime_hours := 0;
    END IF;

    -- Calculate night differential hours (10PM - 6AM)
    -- This is a simplified calculation
    SELECT
      ROUND(
        GREATEST(0,
          (EXTRACT(EPOCH FROM (
            LEAST(NEW.clock_out_time, (NEW.clock_in_time::DATE + TIME '06:00:00' + INTERVAL '1 day')) -
            GREATEST(NEW.clock_in_time, (NEW.clock_in_time::DATE + TIME '22:00:00'))
          )) / 3600.0
          )
        ), 2
      )
    INTO NEW.night_diff_hours
    WHERE
      (NEW.clock_in_time::TIME >= TIME '22:00:00' AND NEW.clock_out_time::TIME <= TIME '23:59:59') OR
      (NEW.clock_in_time::TIME >= TIME '00:00:00' AND NEW.clock_out_time::TIME <= TIME '06:00:00') OR
      (NEW.clock_in_time::TIME >= TIME '22:00:00' AND NEW.clock_out_time::TIME <= TIME '06:00:00' + INTERVAL '1 day');

    -- Default to 0 if no night hours
    NEW.night_diff_hours := GREATEST(0, COALESCE(NEW.night_diff_hours, 0));

    -- Detect the first time this entry is being clocked out (or inserted with both times)
    IF TG_OP = 'INSERT' THEN
      is_first_clock_out := TRUE;
    ELSIF TG_OP = 'UPDATE' THEN
      is_first_clock_out := (OLD.clock_out_time IS NULL);
    END IF;

    -- Grant offset credits for full regular-holiday shifts (PH local date)
    v_clock_date := (NEW.clock_in_time AT TIME ZONE 'Asia/Manila')::DATE;
    SELECT holiday_type
      INTO v_holiday_type
    FROM public.holidays
    WHERE holiday_date = v_clock_date
      AND is_active = TRUE
    LIMIT 1;

    IF is_first_clock_out
       AND v_holiday_type = 'regular'
       AND NEW.total_hours > 0 THEN
      -- Cap at 8h; overtime approvals handle additional credits separately
      v_offset_credit := LEAST(8, GREATEST(0, COALESCE(NEW.total_hours, 0)));
      UPDATE public.employees
      SET offset_hours = COALESCE(offset_hours, 0) + v_offset_credit
      WHERE id = NEW.employee_id;
    END IF;

    -- Set status to 'auto_approved' for regular clock entries
    -- This allows them to sync to timesheet immediately
    NEW.status := 'auto_approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
