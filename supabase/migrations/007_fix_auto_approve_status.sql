-- =====================================================
-- FIX AUTO-APPROVAL STATUS
-- =====================================================
-- Update the calculate_time_clock_hours function to set status to 'auto_approved'
-- instead of 'clocked_out' when an employee clocks out

CREATE OR REPLACE FUNCTION calculate_time_clock_hours()
RETURNS TRIGGER AS $$
DECLARE
  total_minutes INTEGER;
  work_minutes INTEGER;
  shift_start TIME;
  shift_end TIME;
  night_minutes INTEGER;
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
      AND es.is_active = true
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
    
    -- Set status to 'auto_approved' for regular clock entries
    -- This allows them to sync to timesheet immediately
    NEW.status := 'auto_approved';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the conflicting trigger and function from migration 006
DROP TRIGGER IF EXISTS trigger_auto_approve_regular_hours ON public.time_clock_entries;
DROP FUNCTION IF EXISTS auto_approve_regular_hours();

-- Update any existing entries with 'clocked_out' status to 'auto_approved'
UPDATE public.time_clock_entries
SET status = 'auto_approved'
WHERE status = 'clocked_out' AND clock_out_time IS NOT NULL;
