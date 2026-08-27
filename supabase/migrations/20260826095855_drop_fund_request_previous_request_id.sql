-- Revert fund request → previous request linking
ALTER TABLE public.fund_requests
  DROP CONSTRAINT IF EXISTS fund_requests_previous_request_id_fkey;

ALTER TABLE public.fund_requests
  DROP CONSTRAINT IF EXISTS fund_requests_previous_request_id_not_self;

DROP INDEX IF EXISTS public.idx_fund_requests_previous_request_id;

ALTER TABLE public.fund_requests
  DROP COLUMN IF EXISTS previous_request_id;
