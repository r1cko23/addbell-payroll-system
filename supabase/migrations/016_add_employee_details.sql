-- Add extended personal information to employees
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS tin_number TEXT,
ADD COLUMN IF NOT EXISTS sss_number TEXT,
ADD COLUMN IF NOT EXISTS philhealth_number TEXT,
ADD COLUMN IF NOT EXISTS pagibig_number TEXT,
ADD COLUMN IF NOT EXISTS hmo_provider TEXT;