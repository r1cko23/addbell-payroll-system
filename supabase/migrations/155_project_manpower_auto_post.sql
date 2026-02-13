-- =====================================================
-- PROJECT MANPOWER AUTO-POSTING
-- =====================================================
-- Connect approved project_time_entries -> project_manpower_costs -> project_cost_ledger

-- Ensure each time entry maps to at most one manpower cost row
CREATE UNIQUE INDEX IF NOT EXISTS uq_project_manpower_costs_time_entry_id
  ON public.project_manpower_costs(time_entry_id)
  WHERE time_entry_id IS NOT NULL;

-- Post (or update) manpower cost from one approved project time entry
CREATE OR REPLACE FUNCTION public.post_project_time_entry_manpower_cost(
  p_time_entry_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_te public.project_time_entries%ROWTYPE;
  v_daily_rate NUMERIC(12,2);
  v_hourly_rate NUMERIC(12,6);
  v_regular_cost NUMERIC(14,2);
  v_overtime_cost NUMERIC(14,2);
  v_night_diff_cost NUMERIC(14,2);
  v_total_cost NUMERIC(14,2);
BEGIN
  SELECT * INTO v_te
  FROM public.project_time_entries
  WHERE id = p_time_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'project_time_entry % not found', p_time_entry_id;
  END IF;

  -- Only approved entries should be posted
  IF COALESCE(v_te.is_approved, FALSE) = FALSE THEN
    RETURN;
  END IF;

  -- Pull labor rate from employee master (daily_rate); convert to hourly
  SELECT COALESCE(e.daily_rate, 0)
    INTO v_daily_rate
  FROM public.employees e
  WHERE e.id = v_te.employee_id;

  v_hourly_rate := COALESCE(v_daily_rate, 0) / 8.0;

  -- Philippine baseline assumptions:
  -- regular = 1.0x hourly, overtime = 1.25x hourly, night diff add-on = 0.10x hourly
  v_regular_cost := ROUND(COALESCE(v_te.regular_hours, 0) * v_hourly_rate, 2);
  v_overtime_cost := ROUND(COALESCE(v_te.overtime_hours, 0) * v_hourly_rate * 1.25, 2);
  v_night_diff_cost := ROUND(COALESCE(v_te.night_diff_hours, 0) * v_hourly_rate * 0.10, 2);
  v_total_cost := ROUND(v_regular_cost + v_overtime_cost + v_night_diff_cost, 2);

  INSERT INTO public.project_manpower_costs (
    project_id,
    employee_id,
    time_entry_id,
    period_start_date,
    period_end_date,
    regular_hours,
    overtime_hours,
    night_diff_hours,
    regular_cost,
    overtime_cost,
    night_diff_cost,
    total_cost,
    is_invoiced
  ) VALUES (
    v_te.project_id,
    v_te.employee_id,
    v_te.id,
    (v_te.clock_in AT TIME ZONE 'UTC')::date,
    COALESCE((v_te.clock_out AT TIME ZONE 'UTC')::date, (v_te.clock_in AT TIME ZONE 'UTC')::date),
    COALESCE(v_te.regular_hours, 0),
    COALESCE(v_te.overtime_hours, 0),
    COALESCE(v_te.night_diff_hours, 0),
    v_regular_cost,
    v_overtime_cost,
    v_night_diff_cost,
    v_total_cost,
    FALSE
  )
  ON CONFLICT (time_entry_id) DO UPDATE
    SET project_id = EXCLUDED.project_id,
        employee_id = EXCLUDED.employee_id,
        period_start_date = EXCLUDED.period_start_date,
        period_end_date = EXCLUDED.period_end_date,
        regular_hours = EXCLUDED.regular_hours,
        overtime_hours = EXCLUDED.overtime_hours,
        night_diff_hours = EXCLUDED.night_diff_hours,
        regular_cost = EXCLUDED.regular_cost,
        overtime_cost = EXCLUDED.overtime_cost,
        night_diff_cost = EXCLUDED.night_diff_cost,
        total_cost = EXCLUDED.total_cost,
        updated_at = NOW();

  INSERT INTO public.project_cost_ledger (
    project_id,
    source_type,
    source_id,
    ledger_date,
    amount,
    status,
    notes,
    created_by
  ) VALUES (
    v_te.project_id,
    'manpower',
    v_te.id,
    (v_te.clock_in AT TIME ZONE 'UTC')::date,
    v_total_cost,
    'posted',
    'Auto-posted from approved project time entry',
    v_te.created_by
  )
  ON CONFLICT (source_type, source_id) DO UPDATE
    SET project_id = EXCLUDED.project_id,
        ledger_date = EXCLUDED.ledger_date,
        amount = EXCLUDED.amount,
        notes = EXCLUDED.notes;

  -- Keep project manpower rollup in sync
  UPDATE public.projects p
  SET total_manpower_cost = COALESCE((
      SELECT SUM(pm.total_cost)
      FROM public.project_manpower_costs pm
      WHERE pm.project_id = p.id
    ), 0),
    updated_at = NOW()
  WHERE p.id = v_te.project_id;
END;
$$;

-- Trigger wrapper: post whenever an entry becomes approved or its approved hours are edited
CREATE OR REPLACE FUNCTION public.trigger_post_project_time_entry_manpower_cost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_approved, FALSE) = TRUE THEN
    PERFORM public.post_project_time_entry_manpower_cost(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_post_project_time_entry_manpower_cost ON public.project_time_entries;
CREATE TRIGGER trigger_auto_post_project_time_entry_manpower_cost
  AFTER INSERT OR UPDATE OF is_approved, regular_hours, overtime_hours, night_diff_hours, clock_out
  ON public.project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_post_project_time_entry_manpower_cost();
