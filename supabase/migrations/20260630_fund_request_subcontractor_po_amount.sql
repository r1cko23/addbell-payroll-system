-- Subcontract P.O. amount entered by Purchasing Officer only (subcontractor payment requests).

ALTER TABLE public.fund_requests
  ADD COLUMN IF NOT EXISTS subcontractor_po_amount numeric;
