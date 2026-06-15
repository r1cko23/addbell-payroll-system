ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS business_unit_sub_company text;
