-- =====================================================
-- EMPLOYEE CLOCK IN/OUT FUNCTIONS
-- =====================================================
-- These functions allow employees to clock in/out via RPC
-- They bypass RLS by using SECURITY DEFINER

-- Function to clock in
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

  -- Check if there's an unclosed entry from previous day (using PH local date)
  SELECT * INTO v_existing_entry
  FROM public.time_clock_entries
  WHERE employee_id = p_employee_id
    AND status = 'clocked_in'
  ORDER BY clock_in_time DESC
  LIMIT 1;

  -- Auto-close previous day's entry at PH midnight so next-day clock-in is allowed
  IF v_existing_entry.id IS NOT NULL THEN
    DECLARE
      v_entry_date_ph DATE;
      v_today_ph DATE;
      v_entry_midnight_utc TIMESTAMP WITH TIME ZONE;
    BEGIN
      v_entry_date_ph := (v_existing_entry.clock_in_time AT TIME ZONE 'Asia/Manila')::DATE;
      v_today_ph := (NOW() AT TIME ZONE 'Asia/Manila')::DATE;
      
      IF v_entry_date_ph < v_today_ph THEN
        -- Close at 23:59:59 PH time of the clock-in date, converted back to UTC
        v_entry_midnight_utc := ((v_entry_date_ph + 1)::TIMESTAMP AT TIME ZONE 'Asia/Manila') - INTERVAL '1 second';
        
        UPDATE public.time_clock_entries
        SET 
          clock_out_time = v_entry_midnight_utc,
          status = 'auto_approved',
          total_hours = NULL,
          regular_hours = NULL
        WHERE id = v_existing_entry.id;
      END IF;
    END;
  END IF;

  -- Check if already clocked in today
  IF EXISTS (
    SELECT 1 FROM public.time_clock_entries
    WHERE employee_id = p_employee_id
      AND status = 'clocked_in'
      AND DATE(clock_in_time) = CURRENT_DATE
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

-- Function to clock out
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
  -- Verify the entry belongs to the employee
  SELECT * INTO v_entry
  FROM public.time_clock_entries
  WHERE id = p_entry_id
    AND employee_id = p_employee_id
    AND status = 'clocked_in';

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

-- Grant execute permissions to authenticated users (for employees using the portal)
GRANT EXECUTE ON FUNCTION public.employee_clock_in(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_in(UUID, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.employee_clock_out(UUID, UUID, TEXT) TO anon;

