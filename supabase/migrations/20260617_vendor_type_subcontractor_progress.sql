ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS type text;

UPDATE public.vendors
SET type = 'supplier'
WHERE type IS NULL;

ALTER TABLE public.vendors
ALTER COLUMN type SET DEFAULT 'supplier';

ALTER TABLE public.vendors
ALTER COLUMN type SET NOT NULL;

ALTER TABLE public.vendors
DROP CONSTRAINT IF EXISTS vendors_type_check;

ALTER TABLE public.vendors
ADD CONSTRAINT vendors_type_check CHECK (type IN ('supplier', 'subcontractor'));

ALTER TABLE public.fund_requests
ADD COLUMN IF NOT EXISTS subcontractor_progress_completion_percentage numeric;
