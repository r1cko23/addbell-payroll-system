  -- Structured UM return-to-purchasing correction fields (multi-select + snapshot).
  ALTER TABLE public.fund_requests
  ADD COLUMN IF NOT EXISTS return_correction jsonb;

  COMMENT ON COLUMN public.fund_requests.return_correction IS
    'UM return-to-purchasing payload: fields to correct, optional Others reason, value snapshot, and PO resubmit diffs.';
