ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS rejection_undo_snapshot jsonb;
