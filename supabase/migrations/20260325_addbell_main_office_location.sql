-- Addbell Main Office — Villa Olympia, San Pedro, Laguna (location locking / clock-in radius)
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters, is_active)
SELECT
  'Addbell Main Office',
  'B6 L26 Phase 1A, London St., Villa Olympia, Brgy. Maharlika, San Pedro, Laguna',
  14.34215320000576,
  121.04295527329714,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_locations
  WHERE name = 'Addbell Main Office'
);
