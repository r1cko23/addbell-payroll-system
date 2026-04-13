-- Techlog Center Philippines + Advance Energy Cavite office sites and per-employee location rules.
-- Employees with rows in employee_location_assignments may only punch within radius of those sites.
-- Employees with no assignments keep previous behavior: any active office_locations row.

CREATE TABLE IF NOT EXISTS public.employee_location_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.office_locations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_location_assignments_employee_id
  ON public.employee_location_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_location_assignments_location_id
  ON public.employee_location_assignments(location_id);

COMMENT ON TABLE public.employee_location_assignments IS
  'Maps employees to allowed office_locations for bundy GPS validation; empty set for an employee means all active locations.';

-- Sites (skip if name already exists)
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters, is_active)
SELECT v.name, v.address, v.lat, v.lng, 1000, true
FROM (
  VALUES
    ('Techlog Center Philippines'::text, NULL::text, 14.175963442559834::double precision, 121.12257610926565::double precision),
    ('Advance Energy Cavite'::text, NULL::text, 14.410423415725939::double precision, 120.873116030611::double precision)
) AS v(name, address, lat, lng)
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_locations ol WHERE ol.name = v.name
);

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
BEGIN
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
  'Returns whether (lat,lng) is within radius of an active office location; if employee has employee_location_assignments, only those locations count.';

-- Assignments: Techlog Center Philippines (names matched to public.employees as of migration)
INSERT INTO public.employee_location_assignments (employee_id, location_id)
SELECT e.id, ol.id
FROM public.employees e
CROSS JOIN public.office_locations ol
WHERE ol.name = 'Techlog Center Philippines'
  AND e.id IN (
    'eded33a3-b701-4a3d-94df-380dacd45675'::uuid, -- ALFREDO SAPITIN JR. CASENAS
    '99dd711f-d523-44cd-9ae9-33117bb19b99'::uuid, -- AMBROSIO PALERMO DE MESA
    '3171bcf5-c5fd-4797-bb8d-9c2d828404a2'::uuid, -- JOHN LLOYD BANCO IDANAN
    '5968c1c6-6145-4a86-849f-504ee724610d'::uuid, -- NOEL COMIA CALOSA
    '2e812177-fa54-4f17-a396-fc6a00e998e4'::uuid, -- Patrick HUYO-A. Blanca
    '6036f9f5-8b68-44fc-b5ef-509de621a6b1'::uuid, -- HENRY ENDRIGA SEBLOS
    'e1516b5b-9ffb-4bdf-9dfa-324f41950302'::uuid  -- EDWIN ANDRES DE CLARO
  )
ON CONFLICT (employee_id, location_id) DO NOTHING;

-- Advance Energy Cavite
INSERT INTO public.employee_location_assignments (employee_id, location_id)
SELECT e.id, ol.id
FROM public.employees e
CROSS JOIN public.office_locations ol
WHERE ol.name = 'Advance Energy Cavite'
  AND e.id IN (
    '7916efce-3b4a-45cc-b594-594b3cd097d6'::uuid, -- WILLIAM MATIBAG AGUILA
    '6b5bcbc9-007a-4a5f-a4ba-a23c21cdcf22'::uuid, -- JAY ALLAN BILAOS TUMLOS
    '1625c191-c6f5-4e60-a759-66b9b375fd17'::uuid, -- JEFFREY HOMBALEAS ESCOBAL
    '7fa2efbf-e442-4511-9ba4-affbabe38fba'::uuid, -- JUSTINE JOSEPH BORJA ATIENZA (only Atienza match in DB)
    '35627ba2-95e1-4e52-aca0-6728428ca2fc'::uuid, -- JESSIE DELA CRUZ ALLEGO
    '1c445dd1-dad6-46b3-9512-8f291956029c'::uuid, -- IAN MARIGOCIO CALINGASAN
    '1a0bc341-04e5-403f-9d7e-8bc6055a7024'::uuid  -- SAMUEL SORIANO MAGGAY
  )
ON CONFLICT (employee_id, location_id) DO NOTHING;
