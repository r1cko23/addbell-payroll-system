-- =====================================================
-- Fix replace_week_schedule: Monday week start, allow first submit, manager can overwrite
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
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_rows public.employee_week_schedules[];
  v_idx INT := 1;
  v_week_start DATE := date_trunc('week', p_week_start)::date; -- Monday start
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = (select auth.uid());

  SELECT COUNT(*) INTO v_existing
  FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');

  -- If already exists and caller is not AM/Admin, block edits
  IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
    RAISE EXCEPTION 'Week already submitted; contact account manager to update';
  END IF;

  -- If empty payload
  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
      RAISE EXCEPTION 'Only account managers/admin can clear an existing week';
    END IF;
    DELETE FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');
    RETURN QUERY
      SELECT * FROM public.employee_week_schedules
      WHERE employee_id = p_employee_id
        AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');
    RETURN;
  END IF;

  -- Validate overlaps
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

  -- Replace (if allowed)
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
