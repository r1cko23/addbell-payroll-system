-- =====================================================
-- Apply create_leave_request with p_half_day_dates
-- =====================================================
-- Run this in Supabase Dashboard → SQL Editor against
-- the project used by timelog.greenpasture.ph to fix
-- PGRST202 when creating half-day LWOP/SIL.

-- 1) Ensure half_day_dates column exists (idempotent)
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS half_day_dates JSONB DEFAULT '[]'::jsonb;

-- 2) Ensure total_days allows 0.5 (idempotent)
ALTER TABLE public.leave_requests
  DROP CONSTRAINT IF EXISTS leave_requests_total_days_check;
ALTER TABLE public.leave_requests
  ADD CONSTRAINT leave_requests_total_days_check
  CHECK (total_days > 0);

-- 3) Drop old 7-arg overload (no p_half_day_dates)
DROP FUNCTION IF EXISTS public.create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT);

-- 4) Create 8-arg function (with p_half_day_dates)
CREATE OR REPLACE FUNCTION public.create_leave_request(
  p_employee_id UUID,
  p_leave_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_total_days NUMERIC,
  p_selected_dates JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_half_day_dates JSONB DEFAULT '[]'::jsonb
)
RETURNS leave_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row leave_requests;
BEGIN
  INSERT INTO public.leave_requests (
    employee_id,
    leave_type,
    start_date,
    end_date,
    total_days,
    selected_dates,
    half_day_dates,
    reason,
    status
  )
  VALUES (
    p_employee_id,
    p_leave_type,
    p_start_date,
    p_end_date,
    p_total_days,
    p_selected_dates,
    COALESCE(p_half_day_dates, '[]'::jsonb),
    p_reason,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- 5) Grants for anon (employee portal) and authenticated
GRANT EXECUTE ON FUNCTION public.create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT, JSONB) TO anon;
GRANT EXECUTE ON FUNCTION public.create_leave_request(UUID, TEXT, DATE, DATE, NUMERIC, JSONB, TEXT, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_leave_request IS
  'Creates a leave request. half_day_dates: JSONB array of date strings (YYYY-MM-DD) for half-day. Supports SIL and LWOP half-day.';