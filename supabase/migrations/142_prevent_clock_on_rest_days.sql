-- =====================================================
-- 142: Prevent Clock In/Out on Rest Days
-- =====================================================
-- Employees should not be able to clock in or out on their rest days
-- For client-based employees: Check employee_week_schedules for day_off flag
-- For office-based employees: Sunday is the fixed rest day
-- =====================================================

-- Helper function to check if today is a rest day for an employee
CREATE OR REPLACE FUNCTION public.is_rest_day_today(p_employee_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee_type TEXT;
  v_today_ph DATE;
  v_is_rest_day BOOLEAN;
BEGIN
  -- Get today's date in Asia/Manila timezone
  v_today_ph := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
  
  -- Get employee type
  SELECT employee_type INTO v_employee_type
  FROM public.employees
  WHERE id = p_employee_id;
  
  -- If employee not found, return false (allow clock in/out)
  IF v_employee_type IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- For client-based employees: Check employee_week_schedules for day_off flag
  IF v_employee_type = 'client-based' THEN
    SELECT COALESCE(day_off, false) INTO v_is_rest_day
    FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date = v_today_ph
    LIMIT 1;
    
    -- If no schedule found, default to false (not a rest day)
    RETURN COALESCE(v_is_rest_day, FALSE);
  ELSE
    -- For office-based employees: Sunday is the fixed rest day
    -- Get day of week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
    RETURN EXTRACT(DOW FROM v_today_ph) = 0;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_rest_day_today(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_rest_day_today(UUID) TO anon;

-- Update employee_clock_in to check rest day
CREATE OR REPLACE FUNCTION public.employee_clock_in(
  p_employee_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  entry_id UUID,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry_id UUID;
  v_existing_entry RECORD;
BEGIN
  -- Check if employee exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = p_employee_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Employee not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Check if today is a rest day
  IF public.is_rest_day_today(p_employee_id) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Cannot clock in on rest day'::TEXT;
    RETURN;
  END IF;

  -- Lock existing entry to prevent race conditions (ACID compliance)
  -- Use SKIP LOCKED to avoid blocking if another transaction is processing
  SELECT * INTO v_existing_entry
  FROM public.time_clock_entries
  WHERE employee_id = p_employee_id
    AND status = 'clocked_in'
  ORDER BY clock_in_time DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- Note: We no longer auto-close incomplete entries from previous days
  -- They remain incomplete until the employee files a failure-to-log request
  -- Employees can clock in for the next day even with an incomplete previous entry

  -- Check if already clocked in today (with lock to prevent race condition)
  IF EXISTS (
    SELECT 1 FROM public.time_clock_entries
    WHERE employee_id = p_employee_id
      AND status = 'clocked_in'
      AND DATE(clock_in_time AT TIME ZONE 'Asia/Manila') = (NOW() AT TIME ZONE 'Asia/Manila')::DATE
    FOR UPDATE SKIP LOCKED
  ) THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, 'Already clocked in today'::TEXT;
    RETURN;
  END IF;

  -- Insert new clock in entry
  INSERT INTO public.time_clock_entries (
    employee_id,
    clock_in_time,
    clock_in_location,
    status
  ) VALUES (
    p_employee_id,
    NOW(),
    p_location,
    'clocked_in'
  )
  RETURNING id INTO v_entry_id;

  RETURN QUERY SELECT TRUE, v_entry_id, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_in(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_in(UUID, TEXT) TO anon;

-- Update employee_clock_out to check rest day
CREATE OR REPLACE FUNCTION public.employee_clock_out(
  p_employee_id UUID,
  p_entry_id UUID,
  p_location TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_entry RECORD;
BEGIN
  -- Check if employee exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = p_employee_id AND is_active = true
  ) THEN
    RETURN QUERY SELECT FALSE, 'Employee not found or inactive'::TEXT;
    RETURN;
  END IF;

  -- Check if today is a rest day
  IF public.is_rest_day_today(p_employee_id) THEN
    RETURN QUERY SELECT FALSE, 'Cannot clock out on rest day'::TEXT;
    RETURN;
  END IF;

  -- Lock the entry to prevent concurrent clock-out (ACID compliance)
  SELECT * INTO v_entry
  FROM public.time_clock_entries
  WHERE id = p_entry_id
    AND employee_id = p_employee_id
    AND status = 'clocked_in'
  FOR UPDATE;

  IF v_entry.id IS NULL THEN
    RETURN QUERY SELECT FALSE, 'No active clock-in entry found'::TEXT;
    RETURN;
  END IF;

  -- Update clock out
  UPDATE public.time_clock_entries
  SET 
    clock_out_time = NOW(),
    clock_out_location = p_location
  WHERE id = p_entry_id;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO anon;

