ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS phones text[] NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS emails text[] NOT NULL DEFAULT '{}';

UPDATE public.vendors
SET
  phones = CASE
    WHEN phone IS NOT NULL AND trim(phone) <> '' THEN ARRAY[trim(phone)]
    ELSE '{}'::text[]
  END,
  emails = CASE
    WHEN email IS NOT NULL AND trim(email) <> '' THEN ARRAY[lower(trim(email))]
    ELSE '{}'::text[]
  END
WHERE phones = '{}'::text[] OR emails = '{}'::text[];
