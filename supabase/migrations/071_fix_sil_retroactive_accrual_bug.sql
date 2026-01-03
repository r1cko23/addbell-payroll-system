-- =====================================================
-- 071: Fix SIL retroactive accrual bug for employees < 1 year
--  - After year reset, employees < 1 year should only accrue
--    from the current year, not retroactively from previous year
--  - Fixes issue where employees were getting 10 credits immediately
-- =====================================================

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
  v_reset_happened BOOLEAN := FALSE;
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
    v_reset_happened := TRUE;
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);

  IF v_emp.hire_date IS NOT NULL AND v_emp.hire_date <= v_today THEN
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;
    v_hire_day := EXTRACT(DAY FROM v_emp.hire_date)::int;

    IF v_today < v_first_anniv THEN
      -- Before 1-year anniversary: Accrue monthly on hire date (e.g., 20th of each month)
      IF v_emp.sil_last_accrual IS NULL THEN
        -- After reset or first time: Start from hire date day in current year
        -- If hire date day hasn't occurred yet this year, start from that day
        -- Otherwise, start from next month's hire date day
        v_next_accrual_date := date_trunc('year', v_today)::date + (v_hire_day - 1) * INTERVAL '1 day';
        
        -- If hire date day already passed this year, move to next month
        IF v_next_accrual_date < v_today THEN
          v_next_accrual_date := date_trunc('month', v_today)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        END IF;
        
        -- Handle cases where hire day doesn't exist in the month
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
        
        -- Ensure we don't go back to previous year
        IF v_next_accrual_date < v_year_start THEN
          v_next_accrual_date := v_year_start + (v_hire_day - 1) * INTERVAL '1 day';
          IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
            v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
          END IF;
        END IF;
      ELSE
        -- Continue from last accrual: next month's hire date
        v_next_accrual_date := date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        -- Handle cases where hire day doesn't exist in next month
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
      END IF;

      -- Process all accruals up to today, but only from current year onwards
      WHILE v_next_accrual_date <= v_today 
        AND v_next_accrual_date < v_first_anniv 
        AND v_next_accrual_date >= v_year_start LOOP
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
        v_emp.sil_last_accrual := v_next_accrual_date;
        
        -- Move to next month's hire date
        v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month' + (v_hire_day - 1) * INTERVAL '1 day';
        -- Handle cases where hire day doesn't exist in next month
        IF EXTRACT(DAY FROM v_next_accrual_date) != v_hire_day THEN
          v_next_accrual_date := date_trunc('month', v_next_accrual_date)::date + INTERVAL '1 month - 1 day';
        END IF;
      END LOOP;
    ELSE
      -- After 1-year anniversary: Accrue monthly on 1st of each month
      IF v_emp.sil_last_accrual IS NULL THEN
        -- After reset or first time: Start from January 1st of current year
        v_cursor := v_year_start;
      ELSIF v_emp.sil_last_accrual < v_first_anniv THEN
        -- Just reached 1-year anniversary: Start from 1st of next month after anniversary
        v_cursor := date_trunc('month', v_first_anniv)::date + INTERVAL '1 month';
      ELSE
        -- Continue from last accrual: 1st of next month
        v_cursor := date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month';
      END IF;

      -- Process all accruals up to today (1st of each month)
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
    0::NUMERIC as offset_hours;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;