-- Last successfully synced A:N fingerprint so pull can tell sheet edits from stale app rows.

ALTER TABLE public.po_masterlist_jobs
  ADD COLUMN IF NOT EXISTS sheet_sync_fingerprint text;

COMMENT ON COLUMN public.po_masterlist_jobs.sheet_sync_fingerprint IS
  'Joined A:N cell fingerprint from the last successful sheet pull or writeback.';
