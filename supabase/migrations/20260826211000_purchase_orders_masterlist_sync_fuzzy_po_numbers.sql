-- Stabilize fuzzy-linked cost POs: sync strong masterlist PO#s onto the cost
-- PO and clear "typo" notes that made the UI look like it still needed update.

UPDATE public.purchase_orders po
SET
  po_number = j.po_number,
  masterlist_link_status = 'linked',
  masterlist_link_note = 'Matched to Projects masterlist PO ' || j.po_number || '.',
  updated_at = now()
FROM public.po_masterlist_jobs j
WHERE po.po_masterlist_job_id = j.id
  AND po.id IN (
    '12ec0f55-b419-469e-b926-5d25ca39a385', -- was PO- RE135000769
    '9977d018-e8a5-4d3f-906c-ffb01536826a'  -- was 30012657
  );

UPDATE public.purchase_orders
SET
  po_number = 'RSC-PO0130277846',
  masterlist_link_status = 'linked',
  masterlist_link_note =
    'Matched to Projects masterlist job (PO 250) via unique project title DROP CEILING AT PRODUCE SECTION.',
  updated_at = now()
WHERE id = '9556d8b9-a8d3-48b5-a0da-22e0b3d900c6';
