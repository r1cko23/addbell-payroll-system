-- =====================================================
-- 061: Round clock-in/out to the minute and tighten schedule RPC
-- =====================================================

-- Round server time helper to the minute
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT date_trunc('minute', NOW());
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon;

-- Clock in using rounded server time
CREATE OR REPLACE FUNCTION public.clock_in_now(
  p_employee_id UUID,
  p_location TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.time_clock_entries;
BEGIN
  INSERT INTO public.time_clock_entries (
    employee_id,
    clock_in_time,
    clock_in_location,
    clock_in_ip,
    clock_in_device,
    employee_notes,
    status
  )
  VALUES (
    p_employee_id,
    date_trunc('minute', NOW()),
    p_location,
    p_ip,
    p_device,
    p_notes,
    'clocked_in'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_in_now(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Clock out using rounded server time; updates the latest open clock_in
CREATE OR REPLACE FUNCTION public.clock_out_now(
  p_employee_id UUID,
  p_location TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.time_clock_entries;
BEGIN
  UPDATE public.time_clock_entries
  SET
    clock_out_time = date_trunc('minute', NOW()),
    clock_out_location = p_location,
    clock_out_ip = p_ip,
    clock_out_device = p_device,
    employee_notes = COALESCE(p_notes, employee_notes)
  WHERE id = (
    SELECT id
    FROM public.time_clock_entries
    WHERE employee_id = p_employee_id
      AND status = 'clocked_in'
    ORDER BY clock_in_time DESC
    LIMIT 1
  )
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No active clock-in found';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_out_now(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- =====================================================
-- replace_week_schedule: lock after Monday; validate week and overlaps (time-only)
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
    employee_id, week_start, schedule_date, start_time, end_time
  )
  SELECT
    p_employee_id,
    v_week_start,
    (entry->>'schedule_date')::date,
    (entry->>'start_time')::time,
    (entry->>'end_time')::time
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
