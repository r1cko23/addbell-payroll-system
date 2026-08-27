-- Fuzzy rematch remaining needs_review cost POs using unique near-PO#
-- and/or exact unique project titles. Leaves placeholders and ambiguous
-- near-misses tagged needs_review for project managers.
-- Strong masterlist PO#s are copied onto the cost PO (masterlist is source of truth).

WITH links (po_id, job_id, note, sync_po_number) AS (
  VALUES
    (
      '9977d018-e8a5-4d3f-906c-ffb01536826a'::uuid,
      'd15c692e-b811-43aa-af49-3b030a397312'::uuid,
      'Matched to Projects masterlist PO TCP30012657-1.',
      true
    ),
    (
      '12ec0f55-b419-469e-b926-5d25ca39a385'::uuid,
      '7f1232d6-23db-44a6-8f67-bcf6e89f01fc'::uuid,
      'Matched to Projects masterlist PO PO-RE1350007690.',
      true
    ),
    (
      '9556d8b9-a8d3-48b5-a0da-22e0b3d900c6'::uuid,
      '48d04db8-d40f-4f06-ac93-6bc39063feec'::uuid,
      'Matched to Projects masterlist job (PO 250) via unique project title DROP CEILING AT PRODUCE SECTION.',
      false -- masterlist PO# "250" is too weak to overwrite RSC-PO0130277846
    )
),
jobs AS (
  SELECT
    l.po_id,
    l.note,
    l.sync_po_number,
    j.id AS job_id,
    j.project_id,
    j.project_title,
    j.po_number AS masterlist_po_number
  FROM links l
  JOIN public.po_masterlist_jobs j ON j.id = l.job_id
)
UPDATE public.purchase_orders po
SET
  po_masterlist_job_id = jobs.job_id,
  po_number = CASE
    WHEN jobs.sync_po_number THEN jobs.masterlist_po_number
    ELSE po.po_number
  END,
  project_id = COALESCE(jobs.project_id, po.project_id),
  project_title = COALESCE(NULLIF(btrim(jobs.project_title), ''), po.project_title),
  masterlist_link_status = 'linked',
  masterlist_link_note = jobs.note,
  updated_at = now()
FROM jobs
WHERE po.id = jobs.po_id
  AND po.masterlist_link_status = 'needs_review'
  AND po.po_masterlist_job_id IS NULL;

-- Enrich unresolved rows with suggested near-matches (still needs_review).
UPDATE public.purchase_orders po
SET
  masterlist_link_note = CASE po.id
    WHEN '216287fa-d15a-4843-a037-e4e66b85e4cd'::uuid THEN
      'Near masterlist PO 22880000359503 (SMT ACU) but titles/amounts differ (cost: SLM 5 UNITS AC / 410k vs compressor replacement / 550k). Project manager: confirm or relink manually.'
    WHEN '67782da8-4e70-410f-a162-6d495b627165'::uuid THEN
      'Near masterlist PO 153245 (REPAINTING AND TILES REPAIR / 58k) — off by 1 from cost PO 153246 / Maintenance 48k. Not auto-linked. Project manager: confirm or correct PO#.'
    WHEN '58982ba5-f768-412c-9031-f53fa3a24584'::uuid THEN
      'No masterlist job found for PHL20008145 or title "REPAIR COST FOR ACU 45…". Project manager: set the correct Projects masterlist job.'
    WHEN 'cd254dfb-dc25-419f-aac9-7a25126f0115'::uuid THEN
      'Placeholder PO#. Possible masterlist job PO0000010144 (GENBER COMMERCE BUILDING / 950k) — title related, amount differs. Project manager: confirm link manually.'
    WHEN 'fbd171f5-a5e6-44e1-841b-9b04184e2f2f'::uuid THEN
      'Placeholder PO# "1" (Signage support). No unique masterlist Signage Support job. Project manager: set correct masterlist job + PO#.'
    WHEN 'a1006ed9-8771-4247-8e91-fa7dc0d8b71f'::uuid THEN
      'Placeholder PO# "1" (Civil works). Too many Civil works masterlist jobs to auto-match. Project manager: set correct masterlist job + PO#.'
    WHEN 'ed033de3-819e-49a6-b3a9-644f8563b693'::uuid THEN
      'Placeholder PO# (No PO, with NTP / Sugnage support). No unique masterlist match. Project manager: set correct masterlist job + PO#.'
    WHEN 'a16acc29-90c9-464f-855c-91bd9916755f'::uuid THEN
      'Placeholder PO# (No PO, With NTP / Signage support). No unique masterlist match. Project manager: set correct masterlist job + PO#.'
    WHEN '116beca0-3aba-4d93-814d-2f6f73bba97a'::uuid THEN
      'Placeholder PO# (With NTP only / Civil works). Too many Civil works masterlist jobs to auto-match. Project manager: set correct masterlist job + PO#.'
    ELSE po.masterlist_link_note
  END,
  updated_at = now()
WHERE po.masterlist_link_status = 'needs_review'
  AND po.id IN (
    '216287fa-d15a-4843-a037-e4e66b85e4cd',
    '67782da8-4e70-410f-a162-6d495b627165',
    '58982ba5-f768-412c-9031-f53fa3a24584',
    'cd254dfb-dc25-419f-aac9-7a25126f0115',
    'fbd171f5-a5e6-44e1-841b-9b04184e2f2f',
    'a1006ed9-8771-4247-8e91-fa7dc0d8b71f',
    'ed033de3-819e-49a6-b3a9-644f8563b693',
    'a16acc29-90c9-464f-855c-91bd9916755f',
    '116beca0-3aba-4d93-814d-2f6f73bba97a'
  );
