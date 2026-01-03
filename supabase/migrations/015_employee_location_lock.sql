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
  v_allowed_names TEXT := '';
  v_has_locations BOOLEAN := FALSE;
BEGIN
  FOR v_location IN
    SELECT DISTINCT ol.*
    FROM (
      SELECT ela.location_id
      FROM employee_location_assignments ela
      WHERE ela.employee_id = p_employee_uuid
    ) assigned
    JOIN office_locations ol ON ol.id = assigned.location_id
    WHERE ol.is_active = true
    UNION
    SELECT ol.*
    FROM employees e
    JOIN office_locations ol ON lower(ol.name) = lower(e.assigned_hotel)
    WHERE e.id = p_employee_uuid
      AND ol.is_active = true
  LOOP
    v_has_locations := TRUE;
    v_allowed_names := CASE
      WHEN v_allowed_names = '' THEN v_location.name
      ELSE v_allowed_names || ', ' || v_location.name
    END;

    v_distance := earth_distance(
      ll_to_earth(p_latitude, p_longitude),
      ll_to_earth(v_location.latitude, v_location.longitude)
    );

    IF v_distance <= v_location.radius_meters THEN
      RETURN QUERY
      SELECT TRUE, v_location.name, v_distance, NULL::TEXT;
      RETURN;
    END IF;
  END LOOP;

  IF NOT v_has_locations THEN
    RETURN QUERY SELECT FALSE, NULL, NULL, 'No assigned location on record';
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    FALSE,
    NULL::TEXT,
    NULL::DOUBLE PRECISION,
    format('You must be at one of your assigned locations: %s.', v_allowed_names);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO anon;
GRANT EXECUTE ON FUNCTION public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;

COMMENT ON FUNCTION public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) IS
  'Validates coordinates against the assigned office location of an employee.';
