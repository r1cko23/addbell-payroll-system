-- Split HR "Company ID no." from numeric time-clock / biometric user ID (employee_code).
-- company_id_no: official personnel ID (e.g. AX-10001); any printable text.
-- employee_code: digits only, matches ZKTeco PIN and POST /api/biometric/punch lookup.

ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS company_id_no TEXT;

UPDATE public.employees
SET company_id_no = employee_code
WHERE company_id_no IS NULL;

-- Biometric / time-clock IDs: 1, 2, 3, … in stable order (hire date, then created_at, then id).
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY hire_date NULLS LAST, created_at, id) AS n
  FROM public.employees
)
UPDATE public.employees e
SET employee_code = o.n::text
FROM ordered o
WHERE e.id = o.id;

ALTER TABLE public.employees
  ALTER COLUMN company_id_no SET NOT NULL;

ALTER TABLE public.employees
  DROP CONSTRAINT IF EXISTS employees_employee_code_numeric;

ALTER TABLE public.employees
  ADD CONSTRAINT employees_employee_code_numeric
  CHECK (employee_code ~ '^[0-9]+$');

CREATE UNIQUE INDEX IF NOT EXISTS employees_company_id_no_key ON public.employees (company_id_no);
