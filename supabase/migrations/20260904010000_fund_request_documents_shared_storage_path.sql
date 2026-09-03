-- One payment check file is linked to every same-payee request in a cutoff by
-- inserting extra fund_request_documents rows that share storage_path.
-- The unique index made that insert fail with "duplicate key", so the UI
-- showed an error even though the first request's row was already saved.

DROP INDEX IF EXISTS public.idx_fund_request_documents_storage_path;

CREATE INDEX IF NOT EXISTS idx_fund_request_documents_storage_path
  ON public.fund_request_documents (storage_path)
  WHERE storage_path IS NOT NULL;
