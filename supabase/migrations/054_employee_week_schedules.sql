-- =====================================================
-- Weekly employee schedules + RPCs
-- =====================================================

CREATE TABLE IF NOT EXISTS public.employee_week_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start DATE NOT NULL, -- week anchor (e.g., Monday)
  schedule_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location_id UUID REFERENCES public.office_locations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT employee_week_schedules_time_check CHECK (start_time < end_time),
  CONSTRAINT employee_week_schedules_unique UNIQUE (employee_id, schedule_date)
);

-- Timestamps
DROP TRIGGER IF EXISTS trg_employee_week_schedules_updated ON public.employee_week_schedules;
CREATE TRIGGER trg_employee_week_schedules_updated
  BEFORE UPDATE ON public.employee_week_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.employee_week_schedules ENABLE ROW LEVEL SECURITY;

-- Employees: view own, manage own
CREATE POLICY "Employees can view own schedules" ON public.employee_week_schedules
  FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employees can manage own schedules" ON public.employee_week_schedules
  FOR ALL USING (employee_id = auth.uid());

-- Account managers/admin: view/manage all
CREATE POLICY "Account managers/admin can view schedules" ON public.employee_week_schedules
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );
CREATE POLICY "Account managers/admin can manage schedules" ON public.employee_week_schedules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );

-- =====================================================
-- RPC: replace_week_schedule (replace 7-day window for an employee)
-- entries jsonb array: [{schedule_date, start_time, end_time, location_id}]
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
  v_entry JSONB;
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_loc UUID;
  v_rows public.employee_week_schedules[];
  v_idx INT := 1;
BEGIN
  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    -- Clear the week
    DELETE FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');
    RETURN QUERY
      SELECT * FROM public.employee_week_schedules
      WHERE employee_id = p_employee_id
        AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');
    RETURN;
  END IF;

  -- Validate no overlaps inside provided entries
  FOR v_entry IN SELECT * FROM jsonb_array_elements(p_entries)
  LOOP
    v_date := (v_entry->>'schedule_date')::date;
    v_start := (v_entry->>'start_time')::time;
    v_end := (v_entry->>'end_time')::time;
    v_loc := NULLIF(v_entry->>'location_id','')::uuid;
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

  -- Replace
  DELETE FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days');

  INSERT INTO public.employee_week_schedules (
    employee_id, week_start, schedule_date, start_time, end_time, location_id
  )
  SELECT
    p_employee_id,
    p_week_start,
    (entry->>'schedule_date')::date,
    (entry->>'start_time')::time,
    (entry->>'end_time')::time,
    NULLIF(entry->>'location_id','')::uuid
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

-- =====================================================
-- RPC: get_my_week_schedule
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_my_week_schedule(p_employee_id UUID, p_week_start DATE)
RETURNS TABLE (
  id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  location_id UUID,
  location_name TEXT
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
    s.location_id,
    l.name AS location_name
  FROM public.employee_week_schedules s
  LEFT JOIN public.office_locations l ON l.id = s.location_id
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
  ORDER BY s.schedule_date, s.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_week_schedule(UUID, DATE) TO anon, authenticated;

-- =====================================================
-- RPC: get_week_schedule_for_manager (filters optional)
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
  location_id UUID,
  location_name TEXT
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
    s.location_id,
    l.name AS location_name
  FROM public.employee_week_schedules s
  JOIN public.employees e ON e.id = s.employee_id
  LEFT JOIN public.office_locations l ON l.id = s.location_id
  WHERE s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
    AND (p_location_id IS NULL OR s.location_id = p_location_id)
    AND (p_employee_id IS NULL OR s.employee_id = p_employee_id)
  ORDER BY s.schedule_date, s.start_time, employee_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_week_schedule_for_manager(DATE, UUID, UUID) TO authenticated;