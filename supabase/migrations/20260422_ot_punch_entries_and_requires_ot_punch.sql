-- OT punch-in/out tracking for selected employees only.
-- This does not change regular time_entries behavior.

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS requires_ot_punch boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.employees.requires_ot_punch IS
  'If true, employee must submit OT punch-in/out records for OT approval.';

CREATE TABLE IF NOT EXISTS public.ot_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  ot_request_id uuid NOT NULL REFERENCES public.overtime_requests(id) ON DELETE CASCADE,
  punch_type text NOT NULL CHECK (punch_type IN ('in', 'out')),
  punched_at timestamptz NOT NULL,
  lat double precision NULL,
  lng double precision NULL,
  office_location_id uuid NULL REFERENCES public.office_locations(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'web',
  device_info text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ot_time_entries_employee_id
  ON public.ot_time_entries(employee_id);

CREATE INDEX IF NOT EXISTS idx_ot_time_entries_ot_request_id
  ON public.ot_time_entries(ot_request_id);

CREATE INDEX IF NOT EXISTS idx_ot_time_entries_punched_at
  ON public.ot_time_entries(punched_at);

COMMENT ON TABLE public.ot_time_entries IS
  'Stores OT-specific punch in/out records, separate from regular time_entries.';

UPDATE public.employees
SET requires_ot_punch = true
WHERE upper(trim(full_name)) IN (
  'CONSTANTINO VERANO MILO',
  'CARIZZA CONTE LEONARDO',
  'DANIEL JACOB A. TABADA',
  'JOEL FLORES MALLARI'
);
