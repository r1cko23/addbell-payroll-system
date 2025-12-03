-- Secure helper for employee portal profile view
DROP FUNCTION IF EXISTS public.get_employee_profile(UUID);

CREATE OR REPLACE FUNCTION public.get_employee_profile(
  p_employee_uuid UUID
)
RETURNS TABLE (
  employee_id TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  middle_initial TEXT,
  assigned_hotel TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.employee_id,
    e.full_name,
    e.first_name,
    e.last_name,
    e.middle_initial,
    e.assigned_hotel,
    e.is_active,
    e.created_at
  FROM public.employees e
  WHERE e.id = p_employee_uuid
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_employee_profile(UUID) IS
  'Returns employee profile details for the portal using the employee UUID. Runs with elevated privileges to bypass RLS.';

