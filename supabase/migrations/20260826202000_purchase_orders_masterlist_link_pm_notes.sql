-- Projects masterlist is source of truth. Tagged cost POs need the project
-- manager to update the purchase order (link/correct PO#) to match masterlist.

COMMENT ON COLUMN public.purchase_orders.masterlist_link_status IS
  'linked = matched to masterlist; needs_review = project manager must update this cost PO to match Operations → Projects.';

UPDATE public.purchase_orders
SET
  masterlist_link_note = CASE
    WHEN length(public.normalize_po_number_key(po_number)) < 5 THEN
      'PO number is missing or too weak to match the Projects masterlist. Project manager: update this purchase order’s PO number and project to the correct masterlist job.'
    WHEN EXISTS (
      SELECT 1
      FROM public.po_masterlist_jobs j
      WHERE public.normalize_po_number_key(j.po_number) = public.normalize_po_number_key(purchase_orders.po_number)
      GROUP BY public.normalize_po_number_key(j.po_number)
      HAVING count(*) > 1
    ) THEN
      'Multiple Projects masterlist jobs share this PO number. Project manager: pick the correct masterlist job and update this purchase order.'
    ELSE
      'No matching Projects masterlist PO found for this cost PO. Project manager: update this purchase order’s PO number and project to match the correct job on Operations → Projects.'
  END,
  updated_at = now()
WHERE masterlist_link_status = 'needs_review';
