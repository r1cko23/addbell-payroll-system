-- =====================================================
-- Gender-based leave defaults:
-- - Add gender to employees (male/female)
-- - Refresh function: maternity 105 only if female; paternity only if male (else 0)
-- =====================================================

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS gender TEXT CHECK (gender IN ('male','female'));

-- Override refresh function to enforce gender-based leave defaults
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
  v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_first_anniv DATE;
  v_month_accrual NUMERIC := 10.0 / 12.0;
  v_months_to_accrue INT := 0;
  v_month_diff INT;
BEGIN
  SELECT *
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_first_anniv := v_emp.hire_date + INTERVAL '1 year';

  -- Reset balances on year change
  IF v_emp.sil_balance_year IS DISTINCT FROM v_current_year THEN
    v_emp.sil_credits := 0;
    v_emp.sil_last_accrual := NULL;
    v_emp.sil_balance_year := v_current_year;
  END IF;

  IF v_emp.hire_date IS NOT NULL AND v_today >= v_first_anniv THEN
    -- Year of first anniversary: grant full 10 once
    IF EXTRACT(YEAR FROM v_first_anniv) = v_current_year THEN
      IF v_emp.sil_last_accrual IS NULL THEN
        v_emp.sil_credits := LEAST(10, COALESCE(v_emp.sil_credits, 0) + 10);
        v_emp.sil_last_accrual := v_today;
      END IF;
    ELSIF v_current_year > EXTRACT(YEAR FROM v_first_anniv) THEN
      -- Subsequent years: accrue monthly 10/12, capped at 10
      IF v_emp.sil_last_accrual IS NULL THEN
        v_emp.sil_last_accrual := DATE_TRUNC('year', v_today)::date;
      END IF;

      v_month_diff :=
        (EXTRACT(YEAR FROM v_today)::int - EXTRACT(YEAR FROM v_emp.sil_last_accrual)::int) * 12
        + (EXTRACT(MONTH FROM v_today)::int - EXTRACT(MONTH FROM v_emp.sil_last_accrual)::int);

      v_months_to_accrue := GREATEST(0, v_month_diff);

      IF v_months_to_accrue > 0 THEN
        v_emp.sil_credits := LEAST(
          10,
          COALESCE(v_emp.sil_credits, 0) + (v_months_to_accrue * v_month_accrual)
        );
        v_emp.sil_last_accrual := v_today;
      END IF;
    END IF;
  END IF;

  -- Gender-based defaults
  v_emp.maternity_credits := CASE WHEN v_emp.gender = 'female' THEN 105 ELSE 0 END;
  v_emp.paternity_credits := CASE WHEN v_emp.gender = 'male' THEN COALESCE(v_emp.paternity_credits, 0) ELSE 0 END;

  -- Persist computed values
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
    COALESCE(v_emp.offset_hours, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;
