-- =====================================================
-- Allow nullable start_time and end_time for partial schedules
-- =====================================================

-- Make start_time and end_time nullable
ALTER TABLE public.employee_week_schedules
  ALTER COLUMN start_time DROP NOT NULL,
  ALTER COLUMN end_time DROP NOT NULL;

-- Update check constraint to only validate when both times are present
ALTER TABLE public.employee_week_schedules
  DROP CONSTRAINT IF EXISTS employee_week_schedules_time_check;

ALTER TABLE public.employee_week_schedules
  ADD CONSTRAINT employee_week_schedules_time_check 
  CHECK (
    (start_time IS NULL AND end_time IS NULL) OR 
    (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  );

-- =====================================================
-- Update replace_week_schedule to allow NULL times
-- =====================================================
DROP FUNCTION IF EXISTS public.replace_week_schedule(UUID, DATE, JSONB);

CREATE OR REPLACE FUNCTION public.replace_week_schedule(
  p_employee_id UUID,
  p_week_start DATE,
  p_entries JSONB
)
RETURNS SETOF public.employee_week_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_existing INT;
  v_entry JSONB;
  v_idx INT;
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_tasks TEXT;
  v_rows public.employee_week_schedules[];
  v_week_start DATE := date_trunc('week', p_week_start)::date; -- Monday
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = (SELECT auth.uid());

  SELECT COUNT(*) INTO v_existing
  FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');

  -- If already exists and caller not AM/Admin, lock after Monday (current_date > Monday)
  IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
    IF CURRENT_DATE > v_week_start THEN
      RAISE EXCEPTION 'Week already submitted; edits allowed only until end of Monday';
    END IF;
  END IF;

  -- If no entries provided
  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
      RETURN QUERY
        SELECT * FROM public.employee_week_schedules
        WHERE employee_id = p_employee_id
          AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
        ORDER BY schedule_date, start_time;
      RETURN;
    END IF;
    DELETE FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');
    RETURN QUERY
      SELECT * FROM public.employee_week_schedules
      WHERE employee_id = p_employee_id
        AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
      ORDER BY schedule_date, start_time;
    RETURN;
  END IF;

  -- Validate entries
  FOR v_entry, v_idx IN
    SELECT val, ord FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS t(val, ord)
  LOOP
    v_date := (v_entry->>'schedule_date')::date;
    v_start := NULLIF(v_entry->>'start_time', '')::time;
    v_end := NULLIF(v_entry->>'end_time', '')::time;
    v_tasks := NULLIF(v_entry->>'tasks', '');
    
    -- schedule_date is required
    IF v_date IS NULL THEN
      RAISE EXCEPTION 'Invalid schedule entry: schedule_date is required';
    END IF;
    
    -- Validate date is within the week
    IF v_date < v_week_start OR v_date > v_week_start + INTERVAL '6 days' THEN
      RAISE EXCEPTION 'schedule_date must be within the selected week (Mon-Sun)';
    END IF;
    
    -- If times are provided, both must be present and valid
    IF (v_start IS NOT NULL AND v_end IS NULL) OR (v_start IS NULL AND v_end IS NOT NULL) THEN
      RAISE EXCEPTION 'Both start_time and end_time must be provided together, or both must be NULL';
    END IF;
    
    -- If both times are present, validate they are in correct order
    IF v_start IS NOT NULL AND v_end IS NOT NULL AND v_start >= v_end THEN
      RAISE EXCEPTION 'start_time must be before end_time';
    END IF;
    
    -- Check for overlapping entries (only if times are present)
    IF v_start IS NOT NULL AND v_end IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_entries) WITH ORDINALITY e2(val, ord)
        WHERE e2.ord <> v_idx
          AND (e2.val->>'schedule_date')::date = v_date
          AND NULLIF(e2.val->>'start_time', '')::time IS NOT NULL
          AND NULLIF(e2.val->>'end_time', '')::time IS NOT NULL
          AND tsrange(
                NULLIF(e2.val->>'start_time', '')::time,
                NULLIF(e2.val->>'end_time', '')::time,
                '[)'
              ) &&
              tsrange(
                v_start,
                v_end,
                '[)'
              )
      ) THEN
        RAISE EXCEPTION 'Overlapping entries for the same day';
      END IF;
    END IF;
  END LOOP;

  -- Replace
  DELETE FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');

  INSERT INTO public.employee_week_schedules (
    employee_id, week_start, schedule_date, start_time, end_time, tasks
  )
  SELECT
    p_employee_id,
    v_week_start,
    (entry->>'schedule_date')::date,
    NULLIF(entry->>'start_time', '')::time,
    NULLIF(entry->>'end_time', '')::time,
    NULLIF(entry->>'tasks', '')
  FROM jsonb_array_elements(p_entries) entry
  RETURNING * INTO v_rows;

  RETURN QUERY
    SELECT * FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
    ORDER BY schedule_date, start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_week_schedule(UUID, DATE, JSONB) TO anon, authenticated;