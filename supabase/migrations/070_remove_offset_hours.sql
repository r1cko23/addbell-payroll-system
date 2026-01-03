-- =====================================================
-- 070: Remove offset_hours functionality
--  - Removes offset_hours column from employees table
--  - Removes offset_hours from all functions and triggers
--  - No more offsetting hours will be tracked
-- =====================================================

-- 1. Update refresh_employee_leave_balances to remove offset_hours from return
DROP FUNCTION IF EXISTS public.refresh_employee_leave_balances(UUID);

CREATE OR REPLACE FUNCTION public.refresh_employee_leave_balances(p_employee_id UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC,
  offset_hours NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_emp RECORD;
  v_today DATE := CURRENT_DATE;
  v_current_year INT := EXTRACT(YEAR FROM v_today)::int;
  v_first_anniv DATE;
  v_month_accrual NUMERIC := 10.0 / 12.0;
  v_year_start DATE;
  v_year_end DATE;
  v_next_accrual_date DATE;
  v_hire_day INT;
  v_cursor DATE;
BEGIN
  SELECT *
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Reset credits on year-end (Dec 31)
  v_year_start := date_trunc('year', v_today)::date;
  v_year_end := (date_trunc('year', v_today) + INTERVAL '1 year - 1 day')::date;
  
  IF v_emp.sil_balance_year IS DISTINCT FROM v_current_year THEN
    v_emp.sil_credits := 0;
    v_emp.sil_last_accrual := NULL;
    v_emp.sil_balance_year := v_current_year;
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);

  IF v_emp.hire_date IS NOT NULL AND v_emp.hire_date <= v_today THEN
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;
    v_hire_day := EXTRACT(DAY FROM v_emp.hire_date)::int;

    IF v_today < v_first_anniv THEN
      -- Before 1-year anniversary: Accrue monthly on hire date (e.g., 20th of each month)
      IF v_emp.sil_last_accrual IS NULL THEN
        v_next_accrual_date := date_trunc('month', v_emp.hire_date)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
      ELSE
        v_next_accrual_date := date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
      END IF;

      WHILE v_next_accrual_date <= v_today AND v_next_accrual_date < v_first_anniv LOOP
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
        v_emp.sil_last_accrual := v_next_accrual_date;
        
        v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
      END LOOP;
    ELSE
      -- After 1-year anniversary: Accrue monthly on 1st of each month
      IF v_emp.sil_last_accrual IS NULL THEN
        v_cursor := v_year_start;
      ELSIF v_emp.sil_last_accrual < v_first_anniv THEN
        v_cursor := date_trunc('month', v_first_anniv)::date + INTERVAL '1 month';
      ELSE
        v_cursor := date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month';
      END IF;

      WHILE v_cursor <= v_today LOOP
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
        v_emp.sil_last_accrual := v_cursor;
        v_cursor := date_trunc('month', v_cursor)::date + INTERVAL '1 month';
      END LOOP;
    END IF;
  END IF;

  v_emp.maternity_credits := CASE WHEN v_emp.gender = 'female' THEN 105 ELSE 0 END;
  v_emp.paternity_credits := CASE WHEN v_emp.gender = 'male' THEN COALESCE(v_emp.paternity_credits, 0) ELSE 0 END;

  UPDATE public.employees
  SET
    sil_credits = v_emp.sil_credits,
    sil_last_accrual = v_emp.sil_last_accrual,
    sil_balance_year = v_emp.sil_balance_year,
    maternity_credits = v_emp.maternity_credits,
    paternity_credits = v_emp.paternity_credits
  WHERE id = v_emp.id;

  RETURN QUERY
  SELECT
    COALESCE(v_emp.sil_credits, 0),
    COALESCE(v_emp.maternity_credits, 0),
    COALESCE(v_emp.paternity_credits, 0),
    0::NUMERIC as offset_hours; -- Always return 0 since offset_hours is deprecated
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;

-- 2. Update approve_overtime_request to remove offset_hours crediting
CREATE OR REPLACE FUNCTION public.approve_overtime_request(p_request_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_req public.overtime_requests;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  -- Allow both account managers and admins to approve OT
  IF v_role NOT IN ('account_manager', 'admin') THEN
    RAISE EXCEPTION 'Only account managers and admins can approve OT requests';
  END IF;

  SELECT * INTO v_req FROM public.overtime_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF v_req.status = 'approved' THEN
    RETURN;
  END IF;

  UPDATE public.overtime_requests
  SET status = 'approved',
      approved_at = NOW(),
      approved_by = auth.uid(),
      account_manager_id = CASE WHEN v_role = 'account_manager' THEN auth.uid() ELSE account_manager_id END
  WHERE id = p_request_id;

  -- Offset hours crediting removed - no longer tracking offset hours
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_overtime_request(UUID) TO authenticated;

-- 3. Update calculate_time_clock_hours trigger to remove offset_hours crediting
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
      AND es.is_active = TRUE
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

    -- Offset hours crediting removed - no longer tracking offset hours

    -- Set status to 'auto_approved' for regular clock entries
    -- This allows them to sync to timesheet immediately
    NEW.status := 'auto_approved';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Update get_offset_balance_rpc to always return 0
CREATE OR REPLACE FUNCTION public.get_offset_balance_rpc(p_employee_uuid UUID)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 0::NUMERIC; -- Offset hours deprecated - always return 0
$$;

GRANT EXECUTE ON FUNCTION public.get_offset_balance_rpc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offset_balance_rpc(UUID) TO anon;

-- 5. Drop the offset_hours column from employees table
ALTER TABLE public.employees
DROP COLUMN IF EXISTS offset_hours;

