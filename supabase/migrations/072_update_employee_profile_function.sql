-- =====================================================
-- Update get_employee_profile function to include profile_picture_url
-- =====================================================

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
  assigned_locations TEXT[],
  address TEXT,
  birth_date DATE,
  tin_number TEXT,
  sss_number TEXT,
  philhealth_number TEXT,
  pagibig_number TEXT,
  hmo_provider TEXT,
  profile_picture_url TEXT,
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
    COALESCE(
      array_remove(array_agg(ol.name ORDER BY ol.name), NULL),
      ARRAY[]::TEXT[]
    ) AS assigned_locations,
    e.address,
    e.birth_date,
    e.tin_number,
    e.sss_number,
    e.philhealth_number,
    e.pagibig_number,
    e.hmo_provider,
    e.profile_picture_url,
    e.is_active,
    e.created_at
  FROM public.employees e
  LEFT JOIN public.employee_location_assignments ela
    ON ela.employee_id = e.id
  LEFT JOIN public.office_locations ol
    ON ol.id = ela.location_id
  WHERE e.id = p_employee_uuid
  GROUP BY e.id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_profile(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_employee_profile(UUID) IS
  'Returns employee profile details for the portal using the employee UUID. Runs with elevated privileges to bypass RLS.';

