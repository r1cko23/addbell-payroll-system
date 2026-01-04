-- =====================================================
-- MIGRATION: Fix Night Differential Calculation (5PM onwards)
-- =====================================================
-- Update night differential calculation to start from 5PM (17:00) instead of 10PM (22:00)
-- Night differential applies from 5PM to 6AM the next day

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
  v_day_of_week INTEGER;
  shift_duration DECIMAL(10,2);
  break_hours DECIMAL(10,2);
  expected_hours DECIMAL(10,2);
  night_start_time TIME := '17:00:00'; -- 5PM
  night_end_time TIME := '06:00:00';   -- 6AM next day
  night_hours DECIMAL(10,2);
BEGIN
  IF NEW.clock_out_time IS NOT NULL AND NEW.clock_in_time IS NOT NULL THEN
    v_clock_in_ph := NEW.clock_in_time AT TIME ZONE 'Asia/Manila';
    total_minutes := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 60;
    work_minutes := total_minutes - COALESCE(NEW.total_break_minutes, 0);
    NEW.total_hours := ROUND(work_minutes / 60.0, 2);

    v_day_of_week := EXTRACT(DOW FROM v_clock_in_ph);

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
      NEW.regular_hours := LEAST(NEW.total_hours, 8);
    END IF;

    -- Calculate night differential hours (5PM - 6AM next day)
    -- Night diff applies from 5PM (17:00) onwards until 6AM (06:00) the next day
    night_hours := 0;

    -- Case 1: Clock in and out on the same day, both after 5PM
    IF NEW.clock_in_time::TIME >= night_start_time AND NEW.clock_out_time::TIME >= night_start_time THEN
      night_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600.0;

    -- Case 2: Clock in before 5PM, clock out after 5PM (same day)
    ELSIF NEW.clock_in_time::TIME < night_start_time AND NEW.clock_out_time::TIME >= night_start_time THEN
      night_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - (NEW.clock_in_time::DATE + night_start_time))) / 3600.0;

    -- Case 3: Clock in after 5PM, clock out after midnight but before 6AM next day
    ELSIF NEW.clock_in_time::TIME >= night_start_time AND NEW.clock_out_time::TIME < night_end_time THEN
      -- Hours from clock_in to midnight + hours from midnight to clock_out
      night_hours := EXTRACT(EPOCH FROM ((NEW.clock_in_time::DATE + INTERVAL '1 day') - NEW.clock_in_time)) / 3600.0;
      night_hours := night_hours + EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_out_time::DATE)) / 3600.0;

    -- Case 4: Clock in before 5PM, clock out after midnight but before 6AM next day
    ELSIF NEW.clock_in_time::TIME < night_start_time AND NEW.clock_out_time::TIME < night_end_time THEN
      -- Hours from 5PM to midnight + hours from midnight to clock_out
      night_hours := EXTRACT(EPOCH FROM ((NEW.clock_in_time::DATE + INTERVAL '1 day') - (NEW.clock_in_time::DATE + night_start_time))) / 3600.0;
      night_hours := night_hours + EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_out_time::DATE)) / 3600.0;

    -- Case 5: Clock in after 5PM, clock out after 6AM next day
    ELSIF NEW.clock_in_time::TIME >= night_start_time AND NEW.clock_out_time::TIME >= night_end_time THEN
      -- Hours from clock_in to midnight + 6 hours (midnight to 6AM)
      night_hours := EXTRACT(EPOCH FROM ((NEW.clock_in_time::DATE + INTERVAL '1 day') - NEW.clock_in_time)) / 3600.0;
      night_hours := night_hours + 6.0;

    -- Case 6: Clock in before 5PM, clock out after 6AM next day
    ELSIF NEW.clock_in_time::TIME < night_start_time AND NEW.clock_out_time::TIME >= night_end_time THEN
      -- Hours from 5PM to midnight + 6 hours (midnight to 6AM)
      night_hours := EXTRACT(EPOCH FROM ((NEW.clock_in_time::DATE + INTERVAL '1 day') - (NEW.clock_in_time::DATE + night_start_time))) / 3600.0;
      night_hours := night_hours + 6.0;
    END IF;

    -- Ensure night hours don't exceed total hours worked
    NEW.total_night_diff_hours := ROUND(GREATEST(0, LEAST(night_hours, NEW.total_hours)), 2);

    NEW.status := 'auto_approved';
  END IF;

  RETURN NEW;
END;
$$;

-- Update existing entries to recalculate night differential
-- This will recalculate night diff for all entries with clock_out_time
UPDATE public.time_clock_entries
SET total_night_diff_hours = (
  SELECT ROUND(GREATEST(0, LEAST(
    CASE
      -- Same day, both after 5PM
      WHEN clock_in_time::TIME >= '17:00:00' AND clock_out_time::TIME >= '17:00:00' THEN
        EXTRACT(EPOCH FROM (clock_out_time - clock_in_time)) / 3600.0
      -- Clock in before 5PM, clock out after 5PM (same day)
      WHEN clock_in_time::TIME < '17:00:00' AND clock_out_time::TIME >= '17:00:00' AND clock_out_time::DATE = clock_in_time::DATE THEN
        EXTRACT(EPOCH FROM (clock_out_time - (clock_in_time::DATE + TIME '17:00:00'))) / 3600.0
      -- Clock in after 5PM, clock out after midnight but before 6AM next day
      WHEN clock_in_time::TIME >= '17:00:00' AND clock_out_time::TIME < '06:00:00' AND clock_out_time::DATE > clock_in_time::DATE THEN
        EXTRACT(EPOCH FROM ((clock_in_time::DATE + INTERVAL '1 day') - clock_in_time)) / 3600.0 +
        EXTRACT(EPOCH FROM (clock_out_time - clock_out_time::DATE)) / 3600.0
      -- Clock in before 5PM, clock out after midnight but before 6AM next day
      WHEN clock_in_time::TIME < '17:00:00' AND clock_out_time::TIME < '06:00:00' AND clock_out_time::DATE > clock_in_time::DATE THEN
        EXTRACT(EPOCH FROM ((clock_in_time::DATE + INTERVAL '1 day') - (clock_in_time::DATE + TIME '17:00:00'))) / 3600.0 +
        EXTRACT(EPOCH FROM (clock_out_time - clock_out_time::DATE)) / 3600.0
      -- Clock in after 5PM, clock out after 6AM next day
      WHEN clock_in_time::TIME >= '17:00:00' AND clock_out_time::TIME >= '06:00:00' AND clock_out_time::DATE > clock_in_time::DATE THEN
        EXTRACT(EPOCH FROM ((clock_in_time::DATE + INTERVAL '1 day') - clock_in_time)) / 3600.0 + 6.0
      -- Clock in before 5PM, clock out after 6AM next day
      WHEN clock_in_time::TIME < '17:00:00' AND clock_out_time::TIME >= '06:00:00' AND clock_out_time::DATE > clock_in_time::DATE THEN
        EXTRACT(EPOCH FROM ((clock_in_time::DATE + INTERVAL '1 day') - (clock_in_time::DATE + TIME '17:00:00'))) / 3600.0 + 6.0
      ELSE 0
    END,
    total_hours
  )), 2)
)
WHERE clock_out_time IS NOT NULL AND clock_in_time IS NOT NULL;



