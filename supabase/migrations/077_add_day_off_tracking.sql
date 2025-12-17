-- =====================================================
-- Add day_off tracking to employee_week_schedules
-- =====================================================

-- Add day_off column
ALTER TABLE public.employee_week_schedules
  ADD COLUMN IF NOT EXISTS day_off BOOLEAN DEFAULT false;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_employee_week_schedules_day_off 
  ON public.employee_week_schedules(employee_id, schedule_date, day_off) 
  WHERE day_off = true;

-- =====================================================
-- Update replace_week_schedule to handle day_off
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
  v_day_off BOOLEAN;
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
    v_day_off := COALESCE((v_entry->>'day_off')::boolean, false);
    
    -- schedule_date is required
    IF v_date IS NULL THEN
      RAISE EXCEPTION 'Invalid schedule entry: schedule_date is required';
    END IF;
    
    -- Validate date is within the week
    IF v_date < v_week_start OR v_date > v_week_start + INTERVAL '6 days' THEN
      RAISE EXCEPTION 'schedule_date must be within the selected week (Mon-Sun)';
    END IF;
    
    -- If day_off is true, times should be NULL
    IF v_day_off AND (v_start IS NOT NULL OR v_end IS NOT NULL) THEN
      RAISE EXCEPTION 'Day off entries cannot have start_time or end_time';
    END IF;
    
    -- If times are provided, both must be present and valid
    IF NOT v_day_off AND ((v_start IS NOT NULL AND v_end IS NULL) OR (v_start IS NULL AND v_end IS NOT NULL)) THEN
      RAISE EXCEPTION 'Both start_time and end_time must be provided together, or both must be NULL';
    END IF;
    
    -- If both times are present, validate they are in correct order
    IF NOT v_day_off AND v_start IS NOT NULL AND v_end IS NOT NULL AND v_start >= v_end THEN
      RAISE EXCEPTION 'start_time must be before end_time';
    END IF;
    
    -- Check for overlapping entries (only if times are present and not day off)
    IF NOT v_day_off AND v_start IS NOT NULL AND v_end IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_entries) WITH ORDINALITY e2(val, ord)
        WHERE e2.ord <> v_idx
          AND (e2.val->>'schedule_date')::date = v_date
          AND COALESCE((e2.val->>'day_off')::boolean, false) = false
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
    employee_id, week_start, schedule_date, start_time, end_time, tasks, day_off
  )
  SELECT
    p_employee_id,
    v_week_start,
    (entry->>'schedule_date')::date,
    CASE WHEN COALESCE((entry->>'day_off')::boolean, false) THEN NULL ELSE NULLIF(entry->>'start_time', '')::time END,
    CASE WHEN COALESCE((entry->>'day_off')::boolean, false) THEN NULL ELSE NULLIF(entry->>'end_time', '')::time END,
    NULLIF(entry->>'tasks', ''),
    COALESCE((entry->>'day_off')::boolean, false)
  FROM jsonb_array_elements(p_entries) entry
  ON CONFLICT (employee_id, schedule_date)
  DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    tasks = EXCLUDED.tasks,
    day_off = EXCLUDED.day_off,
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
-- Update get_my_week_schedule to include day_off
-- =====================================================
DROP FUNCTION IF EXISTS public.get_my_week_schedule(UUID, DATE);

CREATE OR REPLACE FUNCTION public.get_my_week_schedule(p_employee_id UUID, p_week_start DATE)
RETURNS TABLE (
  id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  tasks TEXT,
  day_off BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.tasks,
    COALESCE(s.day_off, false) AS day_off
  FROM public.employee_week_schedules s
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
  ORDER BY s.schedule_date, s.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_week_schedule(UUID, DATE) TO anon, authenticated;

-- =====================================================
-- Create RPC function to get employees on day off today
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_employees_on_day_off_today()
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  employee_id_text TEXT,
  schedule_date DATE,
  profile_picture_url TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id AS employee_id,
    e.full_name AS employee_name,
    e.employee_id AS employee_id_text,
    s.schedule_date,
    e.profile_picture_url
  FROM public.employee_week_schedules s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.schedule_date = CURRENT_DATE
    AND s.day_off = true
    AND e.is_active = true
  ORDER BY e.full_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_employees_on_day_off_today() TO authenticated;
