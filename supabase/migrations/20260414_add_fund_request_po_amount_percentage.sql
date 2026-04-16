ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS po_amount_percentage numeric;
