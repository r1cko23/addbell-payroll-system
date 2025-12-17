-- Create join table for employees and multiple office locations
CREATE TABLE IF NOT EXISTS public.employee_location_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.office_locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS employee_location_unique
  ON public.employee_location_assignments (employee_id, location_id);

