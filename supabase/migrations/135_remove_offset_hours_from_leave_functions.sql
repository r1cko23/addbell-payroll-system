-- =====================================================
-- 135: Remove offset_hours from Leave Balance Functions
-- =====================================================
-- Remove offset_hours from refresh_employee_leave_balances and get_employee_leave_credits
-- This completes the removal of offset_hours functionality
-- =====================================================

-- Drop and recreate refresh_employee_leave_balances without offset_hours
DROP FUNCTION IF EXISTS public.refresh_employee_leave_balances(UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.refresh_employee_leave_balances(p_employee_id UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC
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

  -- Reset credits on year-end
  v_year_start := date_trunc('year', v_today)::date;
  
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
      -- Before 1-year anniversary: Accrue ONCE on hire date day each month
      IF v_emp.sil_last_accrual IS NULL THEN
        -- After reset: Start from hire date day in current year (if hasn't passed) or next month
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

      -- Accrue ONLY ONCE if the accrual date has arrived (and is in current year)
      IF v_next_accrual_date <= v_today 
        AND v_next_accrual_date < v_first_anniv 
        AND v_next_accrual_date >= v_year_start THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
        v_emp.sil_last_accrual := v_next_accrual_date;
      END IF;
    ELSE
      -- After 1-year anniversary: Accrue ONCE on 1st of each month
      IF v_emp.sil_last_accrual IS NULL THEN
        -- After reset: Start from January 1st of current year
        v_cursor := v_year_start;
      ELSIF v_emp.sil_last_accrual < v_first_anniv THEN
        -- Just reached 1-year anniversary: Start from 1st of next month after anniversary
        v_cursor := date_trunc('month', v_first_anniv)::date + INTERVAL '1 month';
      ELSE
        -- Continue from last accrual: 1st of next month
        v_cursor := date_trunc('month', v_emp.sil_last_accrual)::date + INTERVAL '1 month';
      END IF;

      -- Accrue ONLY ONCE if the accrual date (1st of month) has arrived
      IF v_cursor <= v_today THEN
        v_emp.sil_credits := LEAST(10, v_emp.sil_credits + v_month_accrual);
        v_emp.sil_last_accrual := v_cursor;
      END IF;
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
    COALESCE(v_emp.paternity_credits, 0);
END;
$$;

-- Recreate get_employee_leave_credits to match the new return type
CREATE OR REPLACE FUNCTION public.get_employee_leave_credits(p_employee_uuid UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.refresh_employee_leave_balances(p_employee_uuid);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO anon;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION refresh_employee_leave_balances IS
  'Calculates and updates employee leave balances (SIL, maternity, paternity). Returns only leave credits, offset_hours has been removed.';
COMMENT ON FUNCTION get_employee_leave_credits IS
  'Returns employee leave credits (SIL, maternity, paternity). Updated to match refresh_employee_leave_balances return type after removing offset_hours.';

