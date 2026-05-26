-- Link OT filings to regular Bundy time_entries in/out punch pairs (with GPS).

ALTER TABLE public.overtime_requests
  ADD COLUMN IF NOT EXISTS bundy_in_punch_id uuid NULL
    REFERENCES public.time_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS bundy_out_punch_id uuid NULL
    REFERENCES public.time_entries(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_overtime_requests_bundy_in_punch
  ON public.overtime_requests(bundy_in_punch_id)
  WHERE bundy_in_punch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_overtime_requests_bundy_pair_unique
  ON public.overtime_requests(bundy_in_punch_id, bundy_out_punch_id)
  WHERE bundy_in_punch_id IS NOT NULL AND bundy_out_punch_id IS NOT NULL;

COMMENT ON COLUMN public.overtime_requests.bundy_in_punch_id IS
  'Regular Bundy TIME IN punch linked to this OT filing.';
COMMENT ON COLUMN public.overtime_requests.bundy_out_punch_id IS
  'Regular Bundy TIME OUT punch linked to this OT filing.';
