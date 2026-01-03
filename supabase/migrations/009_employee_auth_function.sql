-- =====================================================
-- EMPLOYEE PORTAL AUTHENTICATION FUNCTION
-- =====================================================
-- Secure server-side authentication for employee portal
-- This bypasses RLS and doesn't expose passwords to client

-- Drop existing function if any
DROP FUNCTION IF EXISTS public.authenticate_employee(TEXT, TEXT);

-- Create authentication function
CREATE OR REPLACE FUNCTION public.authenticate_employee(
  p_employee_id TEXT,
  p_password TEXT
)
RETURNS TABLE (
  success BOOLEAN,
  employee_data JSON,
  error_message TEXT
) 
SECURITY DEFINER -- Run with elevated privileges to bypass RLS
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_employee RECORD;
BEGIN
  -- Validate inputs
  IF p_employee_id IS NULL OR p_employee_id = '' THEN
    RETURN QUERY SELECT FALSE, NULL::JSON, 'Employee ID is required'::TEXT;
    RETURN;
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RETURN QUERY SELECT FALSE, NULL::JSON, 'Password is required'::TEXT;
    RETURN;
  END IF;

  -- Find employee with matching credentials
  SELECT 
    id, 
    employee_id, 
    full_name, 
    is_active,
    portal_password
  INTO v_employee
  FROM public.employees
  WHERE employee_id = p_employee_id
  LIMIT 1;

  -- Check if employee exists
  IF v_employee.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::JSON, 'Employee ID not found'::TEXT;
    RETURN;
  END IF;

  -- Check if employee is active
  IF v_employee.is_active = FALSE THEN
    RETURN QUERY SELECT FALSE, NULL::JSON, 'Employee account is inactive'::TEXT;
    RETURN;
  END IF;

  -- Check password (simple comparison for now)
  IF v_employee.portal_password IS NULL OR v_employee.portal_password != p_password THEN
    RETURN QUERY SELECT FALSE, NULL::JSON, 'Incorrect password'::TEXT;
    RETURN;
  END IF;

  -- Authentication successful - return employee data (without password!)
  RETURN QUERY SELECT 
    TRUE,
    json_build_object(
      'id', v_employee.id,
      'employee_id', v_employee.employee_id,
      'full_name', v_employee.full_name,
      'is_active', v_employee.is_active
    ),
    NULL::TEXT;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.authenticate_employee(TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.authenticate_employee(TEXT, TEXT) IS 
  'Authenticates employee for portal access. Returns employee data on success, error message on failure.';