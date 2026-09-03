-- Improve PO# matching: collapse spaces, strip RSC-PO/TCP-style prefixes,
-- and rematch needs_review rows via digit core (leading-zero tolerant).

CREATE OR REPLACE FUNCTION public.normalize_po_number_key(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN cleaned = '' THEN ''
    ELSE regexp_replace(cleaned, '^(TCP|RSC)(?=[0-9])', '')
  END
  FROM (
    SELECT upper(
      regexp_replace(
        regexp_replace(
          regexp_replace(trim(coalesce(raw, '')), '\s+', '', 'g'),
          '^(RSC-?)?PO[#\-]*',
          '',
          'i'
        ),
        '[^A-Z0-9]',
        '',
        'g'
      )
    ) AS cleaned
  ) s;
$$;

CREATE OR REPLACE FUNCTION public.normalize_po_number_digit_core(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ltrim(
    regexp_replace(public.normalize_po_number_key(raw), '[^0-9]', '', 'g'),
    '0'
  );
$$;

-- Rematch needs_review cost POs that uniquely match a masterlist job
-- by improved key or digit core (len >= 6).
WITH review AS (
  SELECT
    po.id,
    public.normalize_po_number_key(po.po_number) AS po_key,
    public.normalize_po_number_digit_core(po.po_number) AS digit_core
  FROM public.purchase_orders po
  WHERE po.masterlist_link_status = 'needs_review'
    AND po.po_masterlist_job_id IS NULL
),
ml AS (
  SELECT
    j.id,
    j.project_id,
    j.project_title,
    j.po_number,
    public.normalize_po_number_key(j.po_number) AS po_key,
    public.normalize_po_number_digit_core(j.po_number) AS digit_core
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
unique_cores AS (
  SELECT digit_core
  FROM ml
  WHERE length(digit_core) >= 5
  GROUP BY digit_core
  HAVING count(*) = 1
),
matches AS (
  SELECT DISTINCT ON (r.id)
    r.id AS purchase_order_id,
    m.id AS job_id,
    m.project_id AS masterlist_project_id,
    m.project_title AS masterlist_project_title,
    m.po_number AS masterlist_po_number,
    CASE
      WHEN m.po_key = r.po_key THEN 'key'
      ELSE 'digit_core'
    END AS match_via
  FROM review r
  INNER JOIN ml m ON (
    (length(r.po_key) >= 5 AND m.po_key = r.po_key AND EXISTS (
      SELECT 1 FROM unique_keys uk WHERE uk.po_key = r.po_key
    ))
    OR (
      length(r.digit_core) >= 5
      AND m.digit_core = r.digit_core
      AND EXISTS (
        SELECT 1 FROM unique_cores uc WHERE uc.digit_core = r.digit_core
      )
    )
  )
  ORDER BY r.id,
    CASE WHEN m.po_key = r.po_key THEN 0 ELSE 1 END,
    m.po_number
)
UPDATE public.purchase_orders po
SET
  po_masterlist_job_id = matches.job_id,
  project_id = COALESCE(matches.masterlist_project_id, po.project_id),
  project_title = COALESCE(NULLIF(btrim(matches.masterlist_project_title), ''), po.project_title),
  masterlist_link_status = 'linked',
  masterlist_link_note = 'Re-matched to Projects masterlist PO '
    || matches.masterlist_po_number
    || ' (' || matches.match_via || ' / spacing-prefix tolerant).',
  updated_at = now()
FROM matches
WHERE po.id = matches.purchase_order_id;
