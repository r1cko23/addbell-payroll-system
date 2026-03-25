-- Add client_code to clients table (short unique identifier, e.g. PUC, SMC)
ALTER TABLE public.clients
ADD COLUMN IF NOT EXISTS client_code TEXT;

COMMENT ON COLUMN public.clients.client_code IS 'Short unique identifier for the client (e.g. PUC, SMC)';

-- Unique index so non-null codes are unique; allow multiple NULLs for existing rows
CREATE UNIQUE INDEX IF NOT EXISTS clients_client_code_key
ON public.clients (client_code)
WHERE client_code IS NOT NULL;
