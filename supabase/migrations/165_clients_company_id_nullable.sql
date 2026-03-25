-- Only one company (Addbell); company_id is redundant for clients.
ALTER TABLE public.clients
ALTER COLUMN company_id DROP NOT NULL;
