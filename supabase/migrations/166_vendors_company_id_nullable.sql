-- Only one company (Addbell); company_id is redundant for vendors.
ALTER TABLE public.vendors
ALTER COLUMN company_id DROP NOT NULL;
