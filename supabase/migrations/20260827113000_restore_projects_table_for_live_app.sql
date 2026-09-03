-- Emergency restore: recreate projects catalog dropped by
-- drop_projects_table_masterlist_sot while production app still depended on it.
-- Rebuilds projects primarily from po_masterlist_jobs.

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  code text NOT NULL,
  name text NOT NULL,
  site_address text,
  city text,
  province text,
  description text,
  start_date date,
  target_end_date date,
  actual_end_date date,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('active', 'pending', 'on_hold', 'completed')),
  contract_value numeric,
  budget_labor numeric,
  budget_materials numeric,
  budget_subcontract numeric,
  budget_other numeric,
  project_manager_id uuid,
  progress_percentage numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_code_unique ON public.projects (code);
CREATE INDEX IF NOT EXISTS projects_client_id_idx ON public.projects (client_id);
CREATE INDEX IF NOT EXISTS projects_status_idx ON public.projects (status);

-- Empty child tables production may still query
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  role text,
  start_date date,
  end_date date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  progress_date date,
  progress_percentage numeric,
  notes text,
  milestone text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  clock_in timestamptz,
  clock_out timestamptz,
  regular_hours numeric,
  total_hours numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_manpower_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_cost_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_cost_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.project_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  vendor_id uuid REFERENCES public.vendors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Restore FK columns live app still writes/reads
ALTER TABLE public.po_masterlist_jobs
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.fund_requests
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

ALTER TABLE public.time_entries
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_po_masterlist_jobs_project_id
  ON public.po_masterlist_jobs (project_id);
CREATE INDEX IF NOT EXISTS idx_fund_requests_project_id
  ON public.fund_requests (project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_project_id
  ON public.purchase_orders (project_id);

-- Rebuild projects from masterlist jobs (unique title+location)
WITH company AS (
  SELECT id FROM public.companies ORDER BY created_at LIMIT 1
),
src AS (
  SELECT
    (SELECT id FROM company) AS company_id,
    lower(btrim(j.project_title)) AS name_key,
    lower(btrim(COALESCE(j.location, ''))) AS loc_key,
    (array_agg(btrim(j.project_title) ORDER BY j.updated_at DESC NULLS LAST, j.created_at DESC))[1] AS name,
    NULLIF((array_agg(btrim(j.location) ORDER BY j.updated_at DESC NULLS LAST, j.created_at DESC))[1], '') AS site_address,
    (array_agg(j.client_id ORDER BY j.updated_at DESC NULLS LAST) FILTER (WHERE j.client_id IS NOT NULL))[1] AS client_id,
    max(j.po_amount) AS contract_value,
    min(j.po_date) AS start_date,
    CASE
      WHEN bool_or(upper(COALESCE(j.project_status, '')) IN ('COMPLETED', 'COMPLETE', 'DONE'))
        THEN 'completed'
      WHEN bool_or(upper(COALESCE(j.project_status, '')) IN ('ON-GOING', 'ONGOING', 'ACTIVE'))
        THEN 'active'
      WHEN bool_or(upper(COALESCE(j.project_status, '')) IN ('ON HOLD', 'ON_HOLD', 'ON-HOLD'))
        THEN 'on_hold'
      ELSE 'pending'
    END AS status
  FROM public.po_masterlist_jobs j
  WHERE NULLIF(btrim(j.project_title), '') IS NOT NULL
  GROUP BY 1, 2, 3
),
ins AS (
  INSERT INTO public.projects (
    company_id, client_id, code, name, site_address, status,
    start_date, contract_value, progress_percentage, is_active
  )
  SELECT
    s.company_id,
    s.client_id,
    'ML-' || upper(substr(md5(COALESCE(s.company_id::text, '') || chr(31) || s.name_key || chr(31) || s.loc_key), 1, 10)),
    s.name,
    s.site_address,
    s.status,
    s.start_date,
    s.contract_value,
    CASE WHEN s.status = 'completed' THEN 100 ELSE 0 END,
    s.status <> 'on_hold'
  FROM src s
  ON CONFLICT (code) DO UPDATE
    SET
      client_id = COALESCE(public.projects.client_id, EXCLUDED.client_id),
      contract_value = GREATEST(
        COALESCE(public.projects.contract_value, 0),
        COALESCE(EXCLUDED.contract_value, 0)
      ),
      status = CASE
        WHEN EXCLUDED.status = 'completed' THEN 'completed'
        WHEN public.projects.status = 'completed' THEN 'completed'
        ELSE EXCLUDED.status
      END,
      updated_at = now()
  RETURNING id, name, site_address, company_id
)
UPDATE public.po_masterlist_jobs j
SET project_id = p.id,
    updated_at = now()
FROM public.projects p
WHERE j.project_id IS NULL
  AND NULLIF(btrim(j.project_title), '') IS NOT NULL
  AND lower(btrim(j.project_title)) = lower(btrim(p.name))
  AND lower(btrim(COALESCE(j.location, ''))) = lower(btrim(COALESCE(p.site_address, '')))
  AND (p.company_id IS NOT DISTINCT FROM j.company_id OR j.company_id IS NULL OR p.company_id IS NULL);

-- Relink fund requests by matching title (+ optional location)
UPDATE public.fund_requests fr
SET project_id = p.id
FROM public.projects p
WHERE fr.project_id IS NULL
  AND NULLIF(btrim(fr.project_title), '') IS NOT NULL
  AND lower(btrim(fr.project_title)) = lower(btrim(p.name))
  AND (
    NULLIF(btrim(fr.project_location), '') IS NULL
    OR lower(btrim(fr.project_location)) = lower(btrim(COALESCE(p.site_address, '')))
  );

-- Clear the applied drop-migration history entry so it is not treated as still desired
DELETE FROM supabase_migrations.schema_migrations
WHERE version IN ('20260827014857', '20260827020000')
   OR name ILIKE '%drop_projects_table_masterlist_sot%';
