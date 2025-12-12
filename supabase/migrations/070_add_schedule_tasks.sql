-- =====================================================
-- Add tasks field to employee_week_schedules
-- =====================================================

-- Add tasks column
ALTER TABLE public.employee_week_schedules
  ADD COLUMN IF NOT EXISTS tasks TEXT;

-- Drop existing functions to recreate with new return types
DROP FUNCTION IF EXISTS public.replace_week_schedule(UUID, DATE, JSONB);
DROP FUNCTION IF EXISTS public.get_my_week_schedule(UUID, DATE);
DROP FUNCTION IF EXISTS public.get_week_schedule_for_manager(DATE, UUID, UUID);

-- =====================================================
-- Update replace_week_schedule to handle tasks
-- =====================================================
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
    v_start := (v_entry->>'start_time')::time;
    v_end := (v_entry->>'end_time')::time;
    v_tasks := NULLIF(v_entry->>'tasks', '');
    IF v_start IS NULL OR v_end IS NULL OR v_date IS NULL THEN
      RAISE EXCEPTION 'Invalid schedule entry';
    END IF;
    IF v_date < v_week_start OR v_date > v_week_start + INTERVAL '6 days' THEN
      RAISE EXCEPTION 'schedule_date must be within the selected week (Mon-Sun)';
    END IF;
    IF v_start >= v_end THEN
      RAISE EXCEPTION 'start_time must be before end_time';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_entries) WITH ORDINALITY e2(val, ord)
      WHERE e2.ord <> v_idx
        AND (e2.val->>'schedule_date')::date = v_date
        AND tsrange(
              v_start,
              v_end,
              '[)'
            ) &&
            tsrange(
              (e2.val->>'start_time')::time,
              (e2.val->>'end_time')::time,
              '[)'
            )
    ) THEN
      RAISE EXCEPTION 'Overlapping entries for the same day';
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
    (entry->>'start_time')::time,
    (entry->>'end_time')::time,
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

-- =====================================================
-- Update get_my_week_schedule to include tasks
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_week_schedule(p_employee_id UUID, p_week_start DATE)
RETURNS TABLE (
  id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  tasks TEXT
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
    s.tasks
  FROM public.employee_week_schedules s
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
  ORDER BY s.schedule_date, s.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_week_schedule(UUID, DATE) TO anon, authenticated;

-- =====================================================
-- Update get_week_schedule_for_manager to include tasks
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_week_schedule_for_manager(
  p_week_start DATE,
  p_location_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  employee_name TEXT,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  tasks TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.employee_id,
    e.full_name AS employee_name,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.tasks
  FROM public.employee_week_schedules s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
    AND (p_employee_id IS NULL OR s.employee_id = p_employee_id)
  ORDER BY s.schedule_date, s.start_time, employee_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_week_schedule_for_manager(DATE, UUID, UUID) TO authenticated;
