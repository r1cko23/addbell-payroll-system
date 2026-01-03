-- =====================================================
-- Auto-credit rules for Maternity Leave and SIL
-- =====================================================
-- - Add hire_date to track tenure for SIL eligibility
-- - Auto-set maternity credits to 105 days (PH mandate)
-- - Track SIL accrual state per year with monthly pro-rating after year 1
-- - Provide RPC get_employee_leave_credits used by the app to fetch balances
-- - Extend leave_requests check constraint to allow new leave types

-- Add required columns on employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS hire_date DATE,
  ADD COLUMN IF NOT EXISTS sil_balance_year INT,
  ADD COLUMN IF NOT EXISTS sil_last_accrual DATE,
  ADD COLUMN IF NOT EXISTS maternity_credits NUMERIC DEFAULT 105,
  ADD COLUMN IF NOT EXISTS paternity_credits NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS offset_hours NUMERIC DEFAULT 0;

-- Backfill hire_date with created_at as a best-effort default where missing
UPDATE public.employees
SET hire_date = COALESCE(hire_date, created_at::date)
WHERE hire_date IS NULL;

-- Initialize current-year tracking for SIL balances if missing
UPDATE public.employees
SET sil_balance_year = COALESCE(sil_balance_year, EXTRACT(YEAR FROM CURRENT_DATE)::int)
WHERE sil_balance_year IS NULL;

-- Ensure leave_requests supports the extended leave types used by the UI
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_leave_type_check
    CHECK (
      leave_type = ANY (
        ARRAY[
          'SIL',
          'LWOP',
          'Maternity Leave',
          'Paternity Leave',
          'Off-setting'
        ]
      )
    );

-- =====================================================
-- FUNCTION: refresh_employee_leave_balances
-- =====================================================
-- Handles:
--   * One-time grant of 10 SIL days at 1-year anniversary (valid until Dec 31 of that year)
--   * Annual reset on Jan 1
--   * Monthly pro-rated accrual (10/12 ≈ 0.8333) in years after the first anniversary
--   * Caps yearly SIL accrual at 10 days
--   * Keeps maternity credits at mandated 105 by default
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

  -- Persist computed values
  UPDATE public.employees
  SET
    sil_credits = v_emp.sil_credits,
    sil_last_accrual = v_emp.sil_last_accrual,
    sil_balance_year = v_emp.sil_balance_year,
    maternity_credits = COALESCE(v_emp.maternity_credits, 105),
    paternity_credits = COALESCE(v_emp.paternity_credits, 0)
  WHERE id = v_emp.id;

  RETURN QUERY
  SELECT
    COALESCE(v_emp.sil_credits, 0),
    COALESCE(v_emp.maternity_credits, 105),
    COALESCE(v_emp.paternity_credits, 0),
    COALESCE(v_emp.offset_hours, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employee_leave_balances(UUID) TO anon;

-- =====================================================
-- FUNCTION: get_employee_leave_credits (RPC)
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_employee_leave_credits(p_employee_uuid UUID)
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
BEGIN
  RETURN QUERY
  SELECT *
  FROM public.refresh_employee_leave_balances(p_employee_uuid);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_employee_leave_credits(UUID) TO anon;