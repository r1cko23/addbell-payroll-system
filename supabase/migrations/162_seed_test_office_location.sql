-- Seed a test office location (for location locking / biometric assignment)
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters, is_active)
SELECT
  'Test Office',
  'Test location for development',
  14.541356993932745,
  121.01902504362438,
  1000,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.office_locations
  WHERE latitude = 14.541356993932745 AND longitude = 121.01902504362438
);
