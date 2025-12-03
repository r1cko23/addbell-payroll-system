-- Restrict clocking to an employee's assigned office location
DROP FUNCTION IF EXISTS public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION);

CREATE OR REPLACE FUNCTION public.is_employee_location_allowed(
  p_employee_uuid UUID,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  nearest_location_name TEXT,
  distance_meters DOUBLE PRECISION,
  error_message TEXT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_location office_locations%ROWTYPE;
  v_distance DOUBLE PRECISION;
BEGIN
  SELECT ol.*
  INTO v_location
  FROM employees e
  JOIN office_locations ol
    ON lower(ol.name) = lower(e.assigned_hotel)
  WHERE e.id = p_employee_uuid
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL, NULL, 'No assigned location on record';
    RETURN;
  END IF;

  v_distance := earth_distance(
    ll_to_earth(p_latitude, p_longitude),
    ll_to_earth(v_location.latitude, v_location.longitude)
  );

  RETURN QUERY
  SELECT
    v_distance <= v_location.radius_meters AS is_allowed,
    v_location.name,
    v_distance,
    CASE
      WHEN v_distance <= v_location.radius_meters THEN NULL
      ELSE format('You must be at %s to clock in/out.', v_location.name)
    END AS error_message;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO anon;
GRANT EXECUTE ON FUNCTION public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

COMMENT ON FUNCTION public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) IS
  'Validates coordinates against the assigned office location of an employee.';

