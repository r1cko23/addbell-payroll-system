-- Backfill catalog projects and purchase orders from approved Subcontractor Payment
-- fund requests. Those requests stored job/PO text only; projects and
-- purchase_orders were empty so the directory pages had nothing to show.
--
-- Same client PO number can apply to more than one subcontractor, so uniqueness
-- is (company, vendor, po_number) rather than (company, po_number).

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_company_id_po_number_key;

ALTER TABLE public.purchase_orders
  DROP CONSTRAINT IF EXISTS purchase_orders_company_id_vendor_id_po_number_key;

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_company_id_vendor_id_po_number_key
  UNIQUE (company_id, vendor_id, po_number);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_vendor_id
  ON public.purchase_orders (vendor_id);

INSERT INTO public.projects (
  company_id,
  client_id,
  code,
  name,
  site_address,
  status,
  start_date,
  progress_percentage,
  contract_value,
  is_active
)
SELECT
  j.company_id,
  CASE
    WHEN j.name_key LIKE '%pick up coffee%' THEN (
      SELECT c.id
      FROM public.clients c
      WHERE c.company_id IS NOT DISTINCT FROM j.company_id
        AND c.name ILIKE '%pick up coffee%'
      ORDER BY c.created_at
      LIMIT 1
    )
    ELSE NULL
  END,
  'FR-' || upper(substr(md5(j.company_id::text || chr(31) || j.name_key || chr(31) || j.loc_key), 1, 10)),
  j.name,
  j.site_address,
  'active',
  j.start_date,
  least(j.progress_percentage, 100),
  j.contract_value,
  true
FROM (
  SELECT
    COALESCE(
      fr.company_id,
      (SELECT c.id FROM public.companies c ORDER BY c.created_at LIMIT 1)
    ) AS company_id,
    lower(btrim(fr.project_title)) AS name_key,
    lower(btrim(COALESCE(fr.project_location, ''))) AS loc_key,
    (array_agg(btrim(fr.project_title) ORDER BY fr.request_date DESC, fr.created_at DESC))[1] AS name,
    NULLIF(
      (array_agg(btrim(fr.project_location) ORDER BY fr.request_date DESC, fr.created_at DESC))[1],
      ''
    ) AS site_address,
    min(fr.request_date) AS start_date,
    max(
      GREATEST(
        COALESCE(fr.current_project_percentage, 0),
        COALESCE(fr.subcontractor_progress_completion_percentage, 0)
      )
    ) AS progress_percentage,
    NULLIF(max(COALESCE(fr.po_amount, 0)), 0) AS contract_value
  FROM public.fund_requests fr
  WHERE fr.purpose = 'Subcontractor Payment'
    AND fr.status = 'management_approved'
    AND NULLIF(btrim(fr.project_title), '') IS NOT NULL
  GROUP BY 1, 2, 3
) j
WHERE NOT EXISTS (
  SELECT 1
  FROM public.projects p
  WHERE p.company_id IS NOT DISTINCT FROM j.company_id
    AND lower(p.name) = j.name_key
    AND lower(COALESCE(p.site_address, '')) = j.loc_key
);

INSERT INTO public.purchase_orders (
  company_id,
  project_id,
  vendor_id,
  po_number,
  po_date,
  po_date_text,
  status,
  subtotal,
  vat_amount,
  total_amount,
  requisitioner,
  requested_by,
  prepared_by,
  reviewed_by,
  approved_by,
  approved_by_title,
  project_title,
  deliver_to,
  payment_terms,
  vendor_snapshot,
  company_snapshot
)
SELECT
  s.company_id,
  p.id,
  s.vendor_id,
  s.po_number,
  s.po_date,
  to_char(s.po_date, 'Mon. FMDD, YYYY'),
  'approved',
  s.amount,
  0,
  s.amount,
  '',
  '',
  'JOSEFINA E. CONTE',
  '',
  'DIOSDADO B. LEONARDO',
  'President',
  s.project_title,
  COALESCE(s.deliver_to, ''),
  ARRAY[
    '30% Down Payment',
    '30% Progress Billing (after 7 days)',
    '30% Progress Billing (after 7 days)',
    '10% Retention (7 to 15 days after COC)'
  ],
  jsonb_build_object(
    'name', v.name,
    'contactPerson', COALESCE(v.contact_person, ''),
    'tin', COALESCE(v.tin, ''),
    'address', COALESCE(v.address, ''),
    'phone', COALESCE(v.phone, ''),
    'email', COALESCE(v.email, '')
  ),
  jsonb_build_object(
    'name', 'ADD-BELL TECHNICAL SERVICES, INC.',
    'tin', '293 128 460 000000',
    'address', 'BLK 6 LOT 26 LONDON ST. VILLA OLYMPIA 1 BRGY. MAHARLIKA SAN PEDRO, LAGUNA',
    'phone', '(02) 7117-1628',
    'email', 'admin@addbell.com / phen.conte@addbell.com'
  )
FROM (
  SELECT
    COALESCE(
      fr.company_id,
      (SELECT c.id FROM public.companies c ORDER BY c.created_at LIMIT 1)
    ) AS company_id,
    fr.vendor_id,
    btrim(fr.po_number) AS po_number,
    (array_agg(btrim(fr.project_title) ORDER BY fr.request_date DESC, fr.created_at DESC))[1] AS project_title,
    NULLIF(
      (array_agg(btrim(fr.project_location) ORDER BY fr.request_date DESC, fr.created_at DESC))[1],
      ''
    ) AS deliver_to,
    min(fr.request_date) AS po_date,
    max(COALESCE(fr.subcontractor_po_amount, fr.po_amount, 0)) AS amount
  FROM public.fund_requests fr
  WHERE fr.purpose = 'Subcontractor Payment'
    AND fr.status = 'management_approved'
    AND fr.vendor_id IS NOT NULL
    AND NULLIF(btrim(fr.po_number), '') IS NOT NULL
  GROUP BY 1, 2, 3
) s
JOIN public.vendors v ON v.id = s.vendor_id
LEFT JOIN public.projects p
  ON p.company_id IS NOT DISTINCT FROM s.company_id
  AND lower(p.name) = lower(s.project_title)
  AND lower(COALESCE(p.site_address, '')) = lower(COALESCE(s.deliver_to, ''))
WHERE NOT EXISTS (
  SELECT 1
  FROM public.purchase_orders po
  WHERE po.company_id IS NOT DISTINCT FROM s.company_id
    AND po.vendor_id = s.vendor_id
    AND po.po_number = s.po_number
);

INSERT INTO public.purchase_order_items (
  purchase_order_id,
  line_no,
  description,
  quantity,
  qty_text,
  unit_price,
  line_total
)
SELECT
  po.id,
  1,
  COALESCE(NULLIF(btrim(po.project_title), ''), 'Subcontractor works'),
  1,
  '1',
  po.total_amount,
  po.total_amount
FROM public.purchase_orders po
WHERE NOT EXISTS (
  SELECT 1
  FROM public.purchase_order_items i
  WHERE i.purchase_order_id = po.id
)
AND EXISTS (
  SELECT 1
  FROM public.fund_requests fr
  WHERE fr.purpose = 'Subcontractor Payment'
    AND fr.status = 'management_approved'
    AND fr.vendor_id = po.vendor_id
    AND btrim(fr.po_number) = po.po_number
);

UPDATE public.fund_requests fr
SET
  project_id = p.id,
  updated_at = now()
FROM public.projects p
WHERE fr.project_id IS NULL
  AND fr.purpose = 'Subcontractor Payment'
  AND NULLIF(btrim(fr.project_title), '') IS NOT NULL
  AND p.company_id IS NOT DISTINCT FROM COALESCE(fr.company_id, p.company_id)
  AND lower(btrim(fr.project_title)) = lower(p.name)
  AND lower(btrim(COALESCE(fr.project_location, ''))) = lower(COALESCE(p.site_address, ''));
