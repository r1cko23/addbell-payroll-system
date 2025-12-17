-- =====================================================
-- Server-time clock-in/clock-out RPCs to avoid client clock tampering
-- =====================================================

-- Helper: return current server time (timestamptz)
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT NOW();
$$;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_server_time() TO anon;

-- Clock in using server time
CREATE OR REPLACE FUNCTION public.clock_in_now(
  p_employee_id UUID,
  p_location TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.time_clock_entries;
BEGIN
  INSERT INTO public.time_clock_entries (
    employee_id,
    clock_in_time,
    clock_in_location,
    clock_in_ip,
    clock_in_device,
    employee_notes,
    status
  )
  VALUES (
    p_employee_id,
    NOW(),
    p_location,
    p_ip,
    p_device,
    p_notes,
    'clocked_in'
  )
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_in_now(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Clock out using server time; updates the latest open clock_in
CREATE OR REPLACE FUNCTION public.clock_out_now(
  p_employee_id UUID,
  p_location TEXT DEFAULT NULL,
  p_ip TEXT DEFAULT NULL,
  p_device TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS public.time_clock_entries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.time_clock_entries;
BEGIN
  -- Update the most recent clocked_in entry
  UPDATE public.time_clock_entries
  SET
    clock_out_time = NOW(),
    clock_out_location = p_location,
    clock_out_ip = p_ip,
    clock_out_device = p_device,
    employee_notes = COALESCE(p_notes, employee_notes)
  WHERE id = (
    SELECT id
    FROM public.time_clock_entries
    WHERE employee_id = p_employee_id
      AND status = 'clocked_in'
    ORDER BY clock_in_time DESC
    LIMIT 1
  )
  RETURNING * INTO v_row;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'No active clock-in found';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.clock_out_now(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
