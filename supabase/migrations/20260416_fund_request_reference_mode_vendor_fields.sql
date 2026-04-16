ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS reference_mode text DEFAULT 'client_linked',
ADD COLUMN IF NOT EXISTS vendor_id uuid,
ADD COLUMN IF NOT EXISTS vendor_po_number text;

UPDATE public.fund_requests
SET reference_mode = 'client_linked'
WHERE reference_mode IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fund_requests_reference_mode_check'
  ) THEN
    ALTER TABLE public.fund_requests
    ADD CONSTRAINT fund_requests_reference_mode_check
    CHECK (reference_mode IN ('client_linked', 'internal_stock'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fund_requests_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.fund_requests
    ADD CONSTRAINT fund_requests_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
    ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_fund_requests_vendor_id
ON public.fund_requests(vendor_id);
