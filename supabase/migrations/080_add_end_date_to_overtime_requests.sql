-- =====================================================
-- 080: Add end_date to overtime_requests for cross-day OT
-- =====================================================
-- Allows overtime requests that span midnight (e.g., 10 PM Dec 15 to 6 AM Dec 16)
-- =====================================================

-- Add end_date column (nullable, defaults to ot_date if not provided)
ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS end_date DATE;

-- Update existing records to set end_date = ot_date
UPDATE public.overtime_requests
SET end_date = ot_date
WHERE end_date IS NULL;

-- Add comment
COMMENT ON COLUMN public.overtime_requests.end_date IS 
  'End date for overtime. If NULL or same as ot_date, OT is on single day. If different, OT spans midnight.';

-- Update create_overtime_request RPC to accept end_date
CREATE OR REPLACE FUNCTION public.create_overtime_request(
  p_employee_id UUID,
  p_ot_date DATE,
  p_start_time TIME,
  p_end_time TIME,
  p_total_hours NUMERIC,
  p_reason TEXT DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS public.overtime_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.overtime_requests;
  v_end_date DATE;
BEGIN
  -- Default end_date to ot_date if not provided
  v_end_date := COALESCE(p_end_date, p_ot_date);
  
  INSERT INTO public.overtime_requests (
    employee_id,
    ot_date,
    end_date,
    start_time,
    end_time,
    total_hours,
    reason,
    status
  )
  VALUES (
    p_employee_id,
    p_ot_date,
    v_end_date,
    p_start_time,
    p_end_time,
    p_total_hours,
    p_reason,
    'pending'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_overtime_request(UUID, DATE, TIME, TIME, NUMERIC, TEXT, DATE) TO anon, authenticated;
