-- Employee-level shift schedule fields used for lateness/undertime calculations in UI.

ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS shift_start_time time without time zone,
ADD COLUMN IF NOT EXISTS shift_end_time time without time zone;

COMMENT ON COLUMN public.employees.shift_start_time IS
  'Default daily shift start time used for late/undertime calculations.';

COMMENT ON COLUMN public.employees.shift_end_time IS
  'Default daily shift end time used for late/undertime calculations.';
