-- Remove fund request link to P.O. masterlist jobs
ALTER TABLE public.fund_requests
  DROP CONSTRAINT IF EXISTS fund_requests_po_masterlist_job_id_fkey;

DROP INDEX IF EXISTS public.idx_fund_requests_po_masterlist_job_id;

ALTER TABLE public.fund_requests
  DROP COLUMN IF EXISTS po_masterlist_job_id;
