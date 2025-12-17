-- =====================================================
-- Fix ACID Compliance Issues
-- 1. Fix replace_week_schedule atomicity (UPSERT instead of DELETE+INSERT)
-- 2. Add isolation locks (FOR UPDATE) to prevent race conditions
-- 3. Fix employee_clock_in race condition
-- =====================================================

-- =====================================================
-- Fix replace_week_schedule: Use UPSERT + Add Locking
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

  -- Lock existing records for isolation (ACID compliance)
  SELECT COUNT(*) INTO v_existing
  FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
  FOR UPDATE;

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
    -- Delete is safe here as we have the lock
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

  -- Use UPSERT instead of DELETE+INSERT for atomicity (ACID compliance)
  -- First, delete entries not in the new set
  DELETE FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
    AND schedule_date NOT IN (
      SELECT (entry->>'schedule_date')::date
      FROM jsonb_array_elements(p_entries) entry
    );

  -- Then UPSERT the entries (atomic operation)
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
  ON CONFLICT (employee_id, schedule_date)
  DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    tasks = EXCLUDED.tasks,
    week_start = EXCLUDED.week_start,
    updated_at = NOW()
  RETURNING * INTO v_rows;

  RETURN QUERY
    SELECT * FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
    ORDER BY schedule_date, start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_week_schedule(UUID, DATE, JSONB) TO anon, authenticated;

-- =====================================================
-- Fix employee_clock_in: Add FOR UPDATE SKIP LOCKED
-- =====================================================
DROP FUNCTION IF EXISTS public.employee_clock_in(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.employee_clock_in(
  p_employee_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  entry_id UUID,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
  v_existing_entry RECORD;
BEGIN
  -- Check if employee exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = p_employee_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Employee not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Lock existing entry to prevent race conditions (ACID compliance)
  -- Use SKIP LOCKED to avoid blocking if another transaction is processing
  SELECT * INTO v_existing_entry
  FROM public.time_clock_entries
  WHERE employee_id = p_employee_id
    AND status = 'clocked_in'
  ORDER BY clock_in_time DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Auto-close previous day's entry at PH midnight so next-day clock-in is allowed
  IF v_existing_entry.id IS NOT NULL THEN
    DECLARE
      v_entry_date_ph DATE;
      v_today_ph DATE;
      v_entry_midnight_utc TIMESTAMP WITH TIME ZONE;
    BEGIN
      v_entry_date_ph := (v_existing_entry.clock_in_time AT TIME ZONE 'Asia/Manila')::DATE;
      v_today_ph := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
      
      IF v_entry_date_ph < v_today_ph THEN
        -- Close at 23:59:59 PH time of the clock-in date, converted back to UTC
        v_entry_midnight_utc := ((v_entry_date_ph + 1)::TIMESTAMP AT TIME ZONE 'Asia/Manila') - INTERVAL '1 second';
        
        UPDATE public.time_clock_entries
        SET 
          clock_out_time = v_entry_midnight_utc,
          status = 'auto_approved',
          total_hours = NULL,
          regular_hours = NULL
        WHERE id = v_existing_entry.id;
      END IF;
    END;
  END IF;

  -- Check if already clocked in today (with lock to prevent race condition)
  IF EXISTS (
    SELECT 1 FROM public.time_clock_entries
    WHERE employee_id = p_employee_id
      AND status = 'clocked_in'
      AND DATE(clock_in_time AT TIME ZONE 'UTC') = CURRENT_DATE
    FOR UPDATE SKIP LOCKED
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Already clocked in today'::TEXT;
    RETURN;
  END IF;

  -- Insert new clock in entry
  INSERT INTO public.time_clock_entries (
    employee_id,
    clock_in_time,
    clock_in_location,
    status
  ) VALUES (
    p_employee_id,
    NOW(),
    p_location,
    'clocked_in'
  )
  RETURNING id INTO v_entry_id;

  RETURN QUERY SELECT TRUE, v_entry_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_in(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_in(UUID, TEXT) TO anon;

-- =====================================================
-- Fix employee_clock_out: Add FOR UPDATE for consistency
-- =====================================================
DROP FUNCTION IF EXISTS public.employee_clock_out(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  -- Lock the entry to prevent concurrent clock-out (ACID compliance)
  SELECT * INTO v_entry
  FROM public.time_clock_entries
  WHERE id = p_entry_id
    AND employee_id = p_employee_id
    AND status = 'clocked_in'
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No active clock-in entry found'::TEXT;
    RETURN;
  END IF;

  -- Update clock out
  UPDATE public.time_clock_entries
  SET 
    clock_out_time = NOW(),
    clock_out_location = p_location
  WHERE id = p_entry_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO anon;
