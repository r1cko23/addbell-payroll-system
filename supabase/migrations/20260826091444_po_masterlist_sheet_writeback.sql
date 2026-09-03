-- Client P.O. masterlist jobs: app is source of truth; Google Sheets is a one-way backup mirror.
-- sheet_tab + sheet_row enable direct values.update without scanning the workbook.

CREATE TABLE IF NOT EXISTS public.po_masterlist_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  po_number text NOT NULL,
  po_date date,
  po_received_date date,
  po_amount numeric,
  project_title text,
  client_name text,
  location text,
  payment_terms text,
  cari text,
  cari_expiry date,
  project_status text,
  payment_status text,
  invoice_numbers text,
  general_remarks text,
  sheet_tab text,
  sheet_row integer,
  sheet_synced_at timestamptz,
  sheet_sync_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT po_masterlist_jobs_sheet_row_positive
    CHECK (sheet_row IS NULL OR sheet_row >= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_po_masterlist_jobs_sheet_coords
  ON public.po_masterlist_jobs (sheet_tab, sheet_row)
  WHERE sheet_tab IS NOT NULL AND sheet_row IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_po_masterlist_jobs_po_number
  ON public.po_masterlist_jobs (po_number);

CREATE INDEX IF NOT EXISTS idx_po_masterlist_jobs_client_id
  ON public.po_masterlist_jobs (client_id);

CREATE INDEX IF NOT EXISTS idx_po_masterlist_jobs_project_id
  ON public.po_masterlist_jobs (project_id);

COMMENT ON TABLE public.po_masterlist_jobs IS
  'Client P.O. masterlist jobs. Postgres is source of truth; Google Sheets is an async one-way mirror.';
COMMENT ON COLUMN public.po_masterlist_jobs.sheet_tab IS
  'Google Sheets tab title for the mirrored row (null until linked).';
COMMENT ON COLUMN public.po_masterlist_jobs.sheet_row IS
  '1-based row index in sheet_tab for direct values.update (null until linked).';

CREATE TABLE IF NOT EXISTS public.po_masterlist_sheet_writeback_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.po_masterlist_jobs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_po_masterlist_sheet_writeback_queue_pending
  ON public.po_masterlist_sheet_writeback_queue (status, created_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS idx_po_masterlist_sheet_writeback_queue_job_id
  ON public.po_masterlist_sheet_writeback_queue (job_id);

COMMENT ON TABLE public.po_masterlist_sheet_writeback_queue IS
  'Async one-way push of po_masterlist_jobs rows to Google Sheets. App save never waits on Google.';

ALTER TABLE public.po_masterlist_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_masterlist_sheet_writeback_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS po_masterlist_jobs_authenticated_all ON public.po_masterlist_jobs;
CREATE POLICY po_masterlist_jobs_authenticated_all
  ON public.po_masterlist_jobs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Queue is service-role only (no authenticated policies).
GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_masterlist_jobs TO authenticated;
GRANT ALL ON public.po_masterlist_jobs TO service_role;
GRANT ALL ON public.po_masterlist_sheet_writeback_queue TO service_role;