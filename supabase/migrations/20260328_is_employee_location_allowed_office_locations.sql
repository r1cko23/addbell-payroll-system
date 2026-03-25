-- Bundy clock: validate GPS against public.office_locations (replaces hardcoded test coords)
CREATE OR REPLACE FUNCTION public.is_employee_location_allowed(
  p_employee_uuid uuid,
  p_latitude double precision,
  p_longitude double precision
)
RETURNS TABLE(
  is_allowed boolean,
  nearest_location_name text,
  distance_meters double precision,
  error_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_earth CONSTANT double precision := 6371000.0;
  rec RECORD;
  v_dlat double precision;
  v_dlon double precision;
  v_a double precision;
  v_c double precision;
  v_dist double precision;
  v_best_any double precision := NULL;
  v_min_name text;
  v_match_dist double precision := NULL;
  v_match_name text;
BEGIN
  FOR rec IN
    SELECT name, latitude, longitude, radius_meters
    FROM public.office_locations
    WHERE is_active = true
  LOOP
    v_dlat := radians(p_latitude - rec.latitude);
    v_dlon := radians(p_longitude - rec.longitude);
    v_a := power(sin(v_dlat / 2), 2)
      + cos(radians(rec.latitude)) * cos(radians(p_latitude)) * power(sin(v_dlon / 2), 2);
    v_c := 2 * atan2(sqrt(v_a), sqrt(1 - v_a));
    v_dist := v_earth * v_c;

    IF v_best_any IS NULL OR v_dist < v_best_any THEN
      v_best_any := v_dist;
      v_min_name := rec.name;
    END IF;

    IF v_dist <= rec.radius_meters::double precision THEN
      IF v_match_dist IS NULL OR v_dist < v_match_dist THEN
        v_match_dist := v_dist;
        v_match_name := rec.name;
      END IF;
    END IF;
  END LOOP;

  IF v_match_dist IS NOT NULL THEN
    is_allowed := true;
    nearest_location_name := v_match_name;
    distance_meters := v_match_dist;
    error_message := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_best_any IS NULL THEN
    is_allowed := false;
    nearest_location_name := NULL;
    distance_meters := NULL;
    error_message := 'No office locations configured. Ask HR to add approved sites.';
    RETURN NEXT;
    RETURN;
  END IF;

  is_allowed := false;
  nearest_location_name := v_min_name;
  distance_meters := v_best_any;
  error_message := 'Location not allowed';
  RETURN NEXT;
END;
$function$;

COMMENT ON FUNCTION public.is_employee_location_allowed(uuid, double precision, double precision) IS
  'Returns whether (lat,lng) is within radius_meters of any active office_locations row.';
