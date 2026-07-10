ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS cutoff_adjustment_history jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.fund_requests.cutoff_adjustment_history IS
  'Audit trail when upper management moves a rolled-forward request back to the current processing cutoff.';
