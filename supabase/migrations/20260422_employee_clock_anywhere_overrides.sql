-- Allow selected employees to clock in/out from any GPS location.
-- This keeps existing office/radius validation for everyone else.

CREATE TABLE IF NOT EXISTS public.employee_clock_anywhere_overrides (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  reason text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.employee_clock_anywhere_overrides IS
  'Employees listed here can clock in/out from any location (mobile field staff exception).';

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
  v_has_assignments boolean := false;
  v_has_anywhere_override boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM public.employee_clock_anywhere_overrides eco
    WHERE eco.employee_id = p_employee_uuid
  )
  INTO v_has_anywhere_override;

  IF v_has_anywhere_override THEN
    is_allowed := true;
    nearest_location_name := 'Field/mobile assignment';
    distance_meters := 0;
    error_message := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.employee_location_assignments ela
    WHERE ela.employee_id = p_employee_uuid
  )
  INTO v_has_assignments;

  FOR rec IN
    SELECT ol.name, ol.latitude, ol.longitude, ol.radius_meters
    FROM public.office_locations ol
    WHERE ol.is_active = true
      AND (
        NOT v_has_assignments
        OR EXISTS (
          SELECT 1
          FROM public.employee_location_assignments ela2
          WHERE ela2.employee_id = p_employee_uuid
            AND ela2.location_id = ol.id
        )
      )
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
    IF v_has_assignments THEN
      error_message := 'No allowed office locations found for this employee. Contact HR.';
    ELSE
      error_message := 'No office locations configured. Ask HR to add approved sites.';
    END IF;
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
  'Returns whether (lat,lng) is within allowed office radius, unless employee has a clock-anywhere override.';

INSERT INTO public.employee_clock_anywhere_overrides (employee_id, reason)
SELECT e.id, 'Always on the go - clock anywhere approved by HR'
FROM public.employees e
WHERE upper(trim(e.full_name)) IN (
  'CARIZZA LEONARDO',
  'JOEL MALLARI',
  'DANIEL JACOB A. TABADA'
)
ON CONFLICT (employee_id) DO NOTHING;
