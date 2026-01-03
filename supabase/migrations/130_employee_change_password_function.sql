-- =====================================================
-- EMPLOYEE CHANGE PASSWORD FUNCTION
-- =====================================================
-- Secure server-side password change for employee portal
-- This bypasses RLS and verifies current password before updating

-- Drop existing function if any
DROP FUNCTION IF EXISTS public.change_employee_password(TEXT, TEXT, TEXT);

-- Create password change function
CREATE OR REPLACE FUNCTION public.change_employee_password(
  p_employee_id TEXT,
  p_current_password TEXT,
  p_new_password TEXT
)
RETURNS TABLE (
  success BOOLEAN,
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
    RETURN QUERY SELECT FALSE, 'Employee ID is required'::TEXT;
    RETURN;
  END IF;

  IF p_current_password IS NULL OR p_current_password = '' THEN
    RETURN QUERY SELECT FALSE, 'Current password is required'::TEXT;
    RETURN;
  END IF;

  IF p_new_password IS NULL OR p_new_password = '' THEN
    RETURN QUERY SELECT FALSE, 'New password is required'::TEXT;
    RETURN;
  END IF;

  IF LENGTH(p_new_password) < 4 THEN
    RETURN QUERY SELECT FALSE, 'New password must be at least 4 characters long'::TEXT;
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
    RETURN QUERY SELECT FALSE, 'Employee ID not found'::TEXT;
    RETURN;
  END IF;

  -- Check if employee is active
  IF v_employee.is_active = FALSE THEN
    RETURN QUERY SELECT FALSE, 'Employee account is inactive'::TEXT;
    RETURN;
  END IF;

  -- Verify current password
  IF v_employee.portal_password IS NULL OR v_employee.portal_password != p_current_password THEN
    RETURN QUERY SELECT FALSE, 'Current password is incorrect'::TEXT;
    RETURN;
  END IF;

  -- Check if new password is different from current password
  IF v_employee.portal_password = p_new_password THEN
    RETURN QUERY SELECT FALSE, 'New password must be different from current password'::TEXT;
    RETURN;
  END IF;

  -- Update the password
  UPDATE public.employees
  SET portal_password = p_new_password
  WHERE id = v_employee.id;

  -- Return success
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

-- Grant execute permission to anon and authenticated users
GRANT EXECUTE ON FUNCTION public.change_employee_password(TEXT, TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.change_employee_password(TEXT, TEXT, TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.change_employee_password(TEXT, TEXT, TEXT) IS 
  'Changes employee portal password. Verifies current password before updating. Returns success status and error message if any.';