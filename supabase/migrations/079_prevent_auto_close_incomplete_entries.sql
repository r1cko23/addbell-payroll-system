-- =====================================================
-- 079: Prevent auto-close of incomplete entries
-- =====================================================
-- When employees forget to clock out, they must file a failure-to-log request
-- instead of auto-closing the entry at 11:59 PM or on next clock-in
-- Employees can still clock in the next day, but won't get credit for the
-- incomplete entry until they file and get approval for a failure-to-log request
-- =====================================================

-- Update employee_clock_in to allow clock-in even with incomplete previous entry
-- The incomplete entry remains incomplete until failure-to-log is filed and approved
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