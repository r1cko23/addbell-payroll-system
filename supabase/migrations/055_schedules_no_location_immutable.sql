-- =====================================================
-- Schedules: remove location, make employee week immutable after first save
-- =====================================================

-- Drop location column
ALTER TABLE public.employee_week_schedules
  DROP COLUMN IF EXISTS location_id;

-- Replace RPC: replace_week_schedule
-- Employees (auth.uid is null in portal) can write only if no existing rows for that week
-- Account managers/admins (users.role in table) can overwrite
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
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_rows public.employee_week_schedules[];
  v_idx INT := 1;
BEGIN
  -- Determine caller role (if any)
  SELECT role INTO v_role FROM public.users WHERE id = (select auth.uid());

  SELECT COUNT(*) INTO v_existing
  FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');

  IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
    RAISE EXCEPTION 'Week already submitted; contact account manager to update';
  END IF;

  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    -- Clear the week (only AM/Admin if already exists)
    IF v_role IS NULL OR v_role NOT IN ('account_manager','admin') THEN
      RAISE EXCEPTION 'Only account managers/admin can clear an existing week';
    END IF;
    DELETE FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');
    RETURN QUERY
      SELECT * FROM public.employee_week_schedules
      WHERE employee_id = p_employee_id
        AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');
    RETURN;
  END IF;

  -- Validate overlaps within provided entries
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_date := (v_entry->>'schedule_date')::date;
    v_start := (v_entry->>'start_time')::time;
    v_end := (v_entry->>'end_time')::time;
    IF v_start IS NULL OR v_end IS NULL OR v_date IS NULL THEN
      RAISE EXCEPTION 'Invalid schedule entry';
    END IF;
    IF v_start >= v_end THEN
      RAISE EXCEPTION 'start_time must be before end_time';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements(p_entries) WITH ORDINALITY e2(val, ord)
      WHERE (e2.val->>'schedule_date')::date = v_date
        AND e2.ord <> v_idx
        AND tstzrange(
              (v_date::text || ' ' || v_start::text)::timestamptz,
              (v_date::text || ' ' || v_end::text)::timestamptz,
              '[)'
            ) &&
            tstzrange(
              ( (e2.val->>'schedule_date')::date::text || ' ' || (e2.val->>'start_time') )::timestamptz,
              ( (e2.val->>'schedule_date')::date::text || ' ' || (e2.val->>'end_time') )::timestamptz,
              '[)'
            )
    ) THEN
      RAISE EXCEPTION 'Overlapping entries for the same day';
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  -- Replace (AM/Admin) or first-time insert (employee)
  DELETE FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');

  INSERT INTO public.employee_week_schedules (
    employee_id, week_start, schedule_date, start_time, end_time
  )
  SELECT
    p_employee_id,
    p_week_start,
    (entry->>'schedule_date')::date,
    (entry->>'start_time')::time,
    (entry->>'end_time')::time
  FROM jsonb_array_elements(p_entries) entry
  RETURNING * INTO v_rows;

  RETURN QUERY
    SELECT * FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
    ORDER BY schedule_date, start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_week_schedule(UUID, DATE, JSONB) TO anon, authenticated;

-- RPC: get_my_week_schedule (no location)
CREATE OR REPLACE FUNCTION public.get_my_week_schedule(p_employee_id UUID, p_week_start DATE)
RETURNS TABLE (
  id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.schedule_date,
    s.start_time,
    s.end_time
  FROM public.employee_week_schedules s
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
  ORDER BY s.schedule_date, s.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_week_schedule(UUID, DATE) TO anon, authenticated;

-- RPC: get_week_schedule_for_manager (no location, filters remain but location filter ignored)
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
  end_time TIME
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
    s.end_time
  FROM public.employee_week_schedules s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
    AND (p_employee_id IS NULL OR s.employee_id = p_employee_id)
  ORDER BY s.schedule_date, s.start_time, employee_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_week_schedule_for_manager(DATE, UUID, UUID) TO authenticated;
