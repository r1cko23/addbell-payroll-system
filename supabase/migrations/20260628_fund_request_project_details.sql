ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS project_details jsonb;
