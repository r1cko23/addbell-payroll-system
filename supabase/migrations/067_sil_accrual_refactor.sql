-- =====================================================
-- 067: SIL accrual refactor
--  - Prorate 10 SIL days across the first 12 months from hire
--    (10/12 per month) with partial months prorated by day count.
--  - Accrual starts in the hire month (pro-rated for partial month).
--  - First-year accrued balance remains usable through Dec 31 of the
--    anniversary year.
--  - Every January 1 after the first anniversary resets to full 10 credits.
-- =====================================================

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
  v_month_accrual NUMERIC := 10.0 / 12.0; -- monthly slice of the 10-day yearly entitlement
  v_accrual_start DATE;
  v_accrual_end DATE;
  v_cursor DATE;
  v_month_start DATE;
  v_month_end DATE;
  v_segment_end DATE;
  v_days_in_month INT;
  v_days_covered INT;
  v_fraction NUMERIC;
BEGIN
  SELECT *
  INTO v_emp
  FROM public.employees
  WHERE id = p_employee_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_emp.sil_credits := COALESCE(v_emp.sil_credits, 0);
  v_emp.sil_balance_year := COALESCE(v_emp.sil_balance_year, v_current_year);

  IF v_emp.hire_date IS NOT NULL AND v_emp.hire_date <= v_today THEN
    v_first_anniv := (v_emp.hire_date + INTERVAL '1 year')::date;

    IF v_today < v_first_anniv THEN
      -- First 12 months: monthly accrual starting the hire month, with partial months prorated by day count.
      v_accrual_start := GREATEST(v_emp.hire_date, COALESCE(v_emp.sil_last_accrual, v_emp.hire_date));
      v_accrual_end := LEAST(v_today, v_first_anniv);

      IF v_accrual_end > v_accrual_start THEN
        v_cursor := v_accrual_start;

        WHILE v_cursor <= v_accrual_end LOOP
          v_month_start := date_trunc('month', v_cursor)::date;
          v_month_end := (v_month_start + INTERVAL '1 month - 1 day')::date;
          v_segment_end := LEAST(v_month_end, v_accrual_end);

          v_days_in_month := (v_month_end - v_month_start + 1);
          v_days_covered := (v_segment_end - v_cursor + 1);
          v_fraction := v_days_covered::numeric / v_days_in_month::numeric;

          v_emp.sil_credits := LEAST(
            10,
            COALESCE(v_emp.sil_credits, 0) + (v_month_accrual * v_fraction)
          );

          v_cursor := v_segment_end + 1;
        END LOOP;

        v_emp.sil_last_accrual := v_accrual_end;
        -- Track the anniversary year so we don't reset during the first calendar crossing.
        v_emp.sil_balance_year := EXTRACT(YEAR FROM v_first_anniv)::int;
      END IF;
    ELSE
      -- After the first anniversary:
      --  * Keep the prorated balance through Dec 31 of the anniversary year.
      --  * Starting the January 1 after that, always reset to full 10 credits once per year.
      IF v_current_year > EXTRACT(YEAR FROM v_first_anniv) THEN
        IF v_emp.sil_balance_year IS DISTINCT FROM v_current_year THEN
          v_emp.sil_credits := 10;
          v_emp.sil_last_accrual := date_trunc('year', v_today)::date;
          v_emp.sil_balance_year := v_current_year;
        END IF;
      ELSE
        -- In the anniversary year but before the first January reset: keep accrued values.
        IF v_emp.sil_balance_year IS DISTINCT FROM EXTRACT(YEAR FROM v_first_anniv)::int THEN
          v_emp.sil_balance_year := EXTRACT(YEAR FROM v_first_anniv)::int;
        END IF;
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
    COALESCE(v_emp.paternity_credits, 0),
    COALESCE(v_emp.offset_hours, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;
