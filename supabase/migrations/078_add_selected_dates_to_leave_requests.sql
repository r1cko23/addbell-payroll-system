-- =====================================================
-- ADD SELECTED DATES COLUMN TO LEAVE REQUESTS
-- =====================================================
-- This migration adds support for storing individual selected dates
-- for leave requests that have non-consecutive dates.
-- The selected_dates column stores an array of date strings (ISO format: YYYY-MM-DD)
-- as JSONB for efficient querying and flexibility.

-- Add selected_dates column (nullable for backward compatibility)
ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS selected_dates JSONB DEFAULT NULL;

-- Add index for efficient querying of selected dates
CREATE INDEX IF NOT EXISTS idx_leave_requests_selected_dates 
  ON public.leave_requests USING GIN (selected_dates);

-- Add comment
COMMENT ON COLUMN public.leave_requests.selected_dates IS 
  'Array of selected dates in ISO format (YYYY-MM-DD) for non-consecutive leave requests. When null, the leave request uses the date range from start_date to end_date. Example: ["2025-01-05", "2025-01-08", "2025-01-15"]';

-- =====================================================
-- HELPER FUNCTION: Check if a date is in selected dates
-- =====================================================
CREATE OR REPLACE FUNCTION is_date_in_selected_dates(
  p_selected_dates JSONB,
  p_check_date DATE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- If selected_dates is null, return false (use date range instead)
  IF p_selected_dates IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check if the date string exists in the JSONB array
  RETURN p_selected_dates ? p_check_date::TEXT;
END;
$$;

COMMENT ON FUNCTION is_date_in_selected_dates IS 
  'Checks if a specific date is in the selected_dates array';

-- =====================================================
-- HELPER FUNCTION: Get all dates for a leave request
-- =====================================================
CREATE OR REPLACE FUNCTION get_leave_request_dates(
  p_start_date DATE,
  p_end_date DATE,
  p_selected_dates JSONB
)
RETURNS TABLE(date_value DATE)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_date DATE;
  v_date_str TEXT;
BEGIN
  -- If selected_dates exists, use those dates
  IF p_selected_dates IS NOT NULL THEN
    FOR v_date_str IN SELECT jsonb_array_elements_text(p_selected_dates)
    LOOP
      BEGIN
        v_date := v_date_str::DATE;
        RETURN NEXT;
      EXCEPTION WHEN OTHERS THEN
        -- Skip invalid dates
        CONTINUE;
      END;
    END LOOP;
  ELSE
    -- Otherwise, return all dates in the range
    v_date := p_start_date;
    WHILE v_date <= p_end_date LOOP
      RETURN NEXT;
      v_date := v_date + INTERVAL '1 day';
    END LOOP;
  END IF;
  
  RETURN;
END;
$$;

COMMENT ON FUNCTION get_leave_request_dates IS 
  'Returns all dates for a leave request. Uses selected_dates if available, otherwise uses date range.';
