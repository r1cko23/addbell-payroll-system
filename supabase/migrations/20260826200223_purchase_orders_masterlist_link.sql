-- Map existing cost purchase_orders to Projects (po_masterlist_jobs) by normalized
-- client PO number. Linked rows point at the masterlist job + its project.
-- Unmatched / weak PO numbers are tagged needs_review so Operations Managers
-- can update the corresponding masterlist job under Operations → Projects.

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS po_masterlist_job_id uuid
    REFERENCES public.po_masterlist_jobs(id) ON DELETE SET NULL;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS masterlist_link_status text;

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS masterlist_link_note text;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_masterlist_link_status_check;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_masterlist_link_status_check
  CHECK (
    masterlist_link_status IS NULL
    OR masterlist_link_status IN ('linked', 'needs_review')
  );

CREATE INDEX IF NOT EXISTS idx_purchase_orders_po_masterlist_job_id
  ON public.purchase_orders (po_masterlist_job_id);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_masterlist_link_status
  ON public.purchase_orders (masterlist_link_status);

COMMENT ON COLUMN public.purchase_orders.po_masterlist_job_id IS
  'Projects masterlist job (client PO to Addbell) this cost PO maps to when linked.';
COMMENT ON COLUMN public.purchase_orders.masterlist_link_status IS
  'linked = matched to masterlist; needs_review = PM must confirm/update Projects masterlist.';
COMMENT ON COLUMN public.purchase_orders.masterlist_link_note IS
  'Human-readable reason for needs_review or confirmation of linked match.';

-- Normalize PO keys: strip leading PO#/PO-, then non-alphanumerics.
CREATE OR REPLACE FUNCTION public.normalize_po_number_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT upper(
    regexp_replace(
      regexp_replace(trim(coalesce(raw, '')), '^PO[#\-\s]*', '', 'i'),
      '[^A-Z0-9]',
      '',
      'g'
    )
  );
$$;

-- 1) Unique strong matches → link + reassign project_id to masterlist project
WITH cost_po AS (
  SELECT
    po.id,
    public.normalize_po_number_key(po.po_number) AS po_key
  FROM public.purchase_orders po
  WHERE po.po_masterlist_job_id IS NULL
),
ml AS (
  SELECT
    j.id,
    j.project_id,
    j.project_title,
    j.po_number,
    public.normalize_po_number_key(j.po_number) AS po_key
  FROM public.po_masterlist_jobs j
  WHERE nullif(trim(j.po_number), '') IS NOT NULL
),
unique_keys AS (
  SELECT po_key
  FROM ml
  WHERE length(po_key) >= 5
  GROUP BY po_key
  HAVING count(*) = 1
),
matches AS (
  SELECT
    c.id AS purchase_order_id,
    m.id AS job_id,
    m.project_id AS masterlist_project_id,
    m.project_title AS masterlist_project_title,
    m.po_number AS masterlist_po_number
  FROM cost_po c
  INNER JOIN unique_keys u ON u.po_key = c.po_key
  INNER JOIN ml m ON m.po_key = c.po_key
  WHERE length(c.po_key) >= 5
)
UPDATE public.purchase_orders po
SET
  po_masterlist_job_id = matches.job_id,
  project_id = COALESCE(matches.masterlist_project_id, po.project_id),
  project_title = COALESCE(NULLIF(btrim(matches.masterlist_project_title), ''), po.project_title),
  masterlist_link_status = 'linked',
  masterlist_link_note = 'Matched to Projects masterlist PO '
    || matches.masterlist_po_number
    || ' by PO number.',
  updated_at = now()
FROM matches
WHERE po.id = matches.purchase_order_id;

-- 2) Remaining rows → needs_review (weak / unmatched / ambiguous)
UPDATE public.purchase_orders po
SET
  masterlist_link_status = 'needs_review',
  masterlist_link_note = CASE
    WHEN length(public.normalize_po_number_key(po.po_number)) < 5 THEN
      'PO number is missing or too weak to match the Projects masterlist. Update the corresponding client PO under Operations → Projects.'
    WHEN EXISTS (
      SELECT 1
      FROM public.po_masterlist_jobs j
      WHERE public.normalize_po_number_key(j.po_number) = public.normalize_po_number_key(po.po_number)
      GROUP BY public.normalize_po_number_key(j.po_number)
      HAVING count(*) > 1
    ) THEN
      'Multiple Projects masterlist jobs share this PO number. Confirm the correct job under Operations → Projects.'
    ELSE
      'No matching Projects masterlist PO found. Add or correct this client PO under Operations → Projects.'
  END,
  updated_at = now()
WHERE po.masterlist_link_status IS NULL
   OR (po.po_masterlist_job_id IS NULL AND po.masterlist_link_status IS DISTINCT FROM 'needs_review');
