-- Biometric (ZKTeco LX50) and office locations support
-- Run in Supabase: SQL Editor or CLI (supabase db push). Use same time_entries table for web + device punches.

-- Ensure office_locations exists (for web location locking and assigning devices to a location)
CREATE TABLE IF NOT EXISTS public.office_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 1000,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: add columns to time_entries for biometric vs web and device/location
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'time_entries' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.time_entries ADD COLUMN source text DEFAULT 'web';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'time_entries' AND column_name = 'device_serial'
  ) THEN
    ALTER TABLE public.time_entries ADD COLUMN device_serial text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'time_entries' AND column_name = 'office_location_id'
  ) THEN
    ALTER TABLE public.time_entries ADD COLUMN office_location_id uuid REFERENCES public.office_locations(id);
  END IF;
END $$;

-- Comment for clarity
COMMENT ON COLUMN public.time_entries.source IS 'web = from web app, biometric = from ZKTeco/device';
COMMENT ON COLUMN public.time_entries.device_serial IS 'Device serial or identifier (e.g. ZKTeco LX50 serial)';
COMMENT ON COLUMN public.time_entries.office_location_id IS 'Office location where punch was recorded (for devices assigned to a location)';
