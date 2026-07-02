ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS rejection_history jsonb NOT NULL DEFAULT '[]'::jsonb;
