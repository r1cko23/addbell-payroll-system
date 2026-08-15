-- Mark a fund request as printed on its own cheque, excluded from the
-- combined payee cheque while the payee header total stays unchanged.
ALTER TABLE public.fund_requests
  ADD COLUMN IF NOT EXISTS separate_cheque boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.fund_requests.separate_cheque IS
  'When true, this request is printed on its own cheque and excluded from the combined payee cheque amount.';
