-- =====================================================
-- 134: Fix SIL Credits Function and Location Issues
-- =====================================================
-- 1. Fix get_employee_leave_credits to match refresh_employee_leave_balances return type
--    (removed offset_hours column)
-- 2. Increase White Plains location radius for better coverage
-- =====================================================

-- Fix get_employee_leave_credits function return type
CREATE OR REPLACE FUNCTION public.get_employee_leave_credits(p_employee_uuid UUID)
RETURNS TABLE (
  sil_credits NUMERIC,
  maternity_credits NUMERIC,
  paternity_credits NUMERIC
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

-- Increase White Plains location radius to 10000 meters (10km) for better coverage
-- This helps account for GPS inaccuracies and ensures employees can clock in
UPDATE office_locations 
SET radius_meters = 10000
WHERE name = 'White Plains - Pinesville'
RETURNING id, name, latitude, longitude, radius_meters;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION get_employee_leave_credits IS
  'Returns employee leave credits (SIL, maternity, paternity). Updated to match refresh_employee_leave_balances return type after removing offset_hours.';

