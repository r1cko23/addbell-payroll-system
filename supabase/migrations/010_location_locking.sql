-- =====================================================
-- LOCATION LOCKING FOR TIME CLOCK
-- =====================================================
-- Allows restricting clock in/out to specific locations
-- Uses geofencing with configurable radius

-- Create office_locations table
CREATE TABLE IF NOT EXISTS public.office_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g., "Main Office", "Branch Office"
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL, -- Office latitude
  longitude DECIMAL(11, 8) NOT NULL, -- Office longitude
  radius_meters INTEGER DEFAULT 1000, -- Allowed radius in meters (default 1000m = 1km)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comment
COMMENT ON TABLE public.office_locations IS 'Stores allowed office locations for geofencing time clock entries';

-- Create function to calculate distance between two coordinates (Haversine formula)
CREATE OR REPLACE FUNCTION public.calculate_distance(
  lat1 DECIMAL,
  lon1 DECIMAL,
  lat2 DECIMAL,
  lon2 DECIMAL
)
RETURNS DECIMAL
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  earth_radius DECIMAL := 6371000; -- Earth radius in meters
  dlat DECIMAL;
  dlon DECIMAL;
  a DECIMAL;
  c DECIMAL;
BEGIN
  -- Convert degrees to radians
  dlat := radians(lat2 - lat1);
  dlon := radians(lon2 - lon1);
  
  -- Haversine formula
  a := sin(dlat / 2) * sin(dlat / 2) +
       cos(radians(lat1)) * cos(radians(lat2)) *
       sin(dlon / 2) * sin(dlon / 2);
  c := 2 * atan2(sqrt(a), sqrt(1 - a));
  
  RETURN earth_radius * c;
END;
$$;

-- Create function to check if location is within allowed radius
CREATE OR REPLACE FUNCTION public.is_location_allowed(
  p_latitude DECIMAL,
  p_longitude DECIMAL
)
RETURNS TABLE (
  is_allowed BOOLEAN,
  nearest_location_id UUID,
  nearest_location_name TEXT,
  distance_meters DECIMAL,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_location RECORD;
  v_distance DECIMAL;
  v_min_distance DECIMAL := NULL;
  v_nearest_location RECORD;
BEGIN
  -- Check if any active location exists
  IF NOT EXISTS (SELECT 1 FROM office_locations WHERE is_active = true) THEN
    -- If no locations configured, allow all (backward compatible)
    RETURN QUERY SELECT TRUE, NULL::UUID, NULL::TEXT, 0::DECIMAL, NULL::TEXT;
    RETURN;
  END IF;

  -- Find nearest active location
  FOR v_location IN 
    SELECT * FROM office_locations WHERE is_active = true
  LOOP
    v_distance := calculate_distance(
      p_latitude,
      p_longitude,
      v_location.latitude,
      v_location.longitude
    );
    
    -- Check if this is the nearest location so far
    IF v_min_distance IS NULL OR v_distance < v_min_distance THEN
      v_min_distance := v_distance;
      v_nearest_location := v_location;
    END IF;
  END LOOP;

  -- If no location found (shouldn't happen, but safety check)
  IF v_nearest_location.id IS NULL THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::TEXT, NULL::DECIMAL, 'No active office locations configured'::TEXT;
    RETURN;
  END IF;

  -- Check if within allowed radius
  IF v_min_distance <= v_nearest_location.radius_meters THEN
    RETURN QUERY SELECT 
      TRUE,
      v_nearest_location.id,
      v_nearest_location.name,
      v_min_distance,
      NULL::TEXT;
  ELSE
    RETURN QUERY SELECT 
      FALSE,
      v_nearest_location.id,
      v_nearest_location.name,
      v_min_distance,
      format('You are %.0f meters away from %s. Please be within %s meters to clock in/out.', 
        v_min_distance, 
        v_nearest_location.name,
        v_nearest_location.radius_meters)::TEXT;
  END IF;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.office_locations TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_location_allowed(DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL) TO anon;
GRANT EXECUTE ON FUNCTION public.is_location_allowed(DECIMAL, DECIMAL) TO anon;

-- Insert example office location (replace with your actual office coordinates)
-- To find your office coordinates: https://www.google.com/maps -> Right click -> "What's here?"
-- Example: Makati, Philippines office
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters)
VALUES (
  'Main Office',
  'Makati, Metro Manila, Philippines',
  14.5547,  -- Replace with your actual latitude
  121.0244, -- Replace with your actual longitude
  1000      -- 1000 meters (1 kilometer) radius
)
ON CONFLICT DO NOTHING;

-- Add comment
COMMENT ON FUNCTION public.is_location_allowed IS 'Checks if given coordinates are within allowed radius of any active office location. Returns nearest location info and distance.';

