-- Cost PO edits are purchasing+admin only. Project managers fix missing/wrong
-- client POs on Fund Request + Projects masterlist, not on Purchase Orders.

COMMENT ON COLUMN public.purchase_orders.masterlist_link_status IS
  'linked = matched to masterlist; needs_review = purchasing must link/correct this cost PO. PMs fix missing/wrong client POs on Fund Request and Projects.';

UPDATE public.purchase_orders
SET
  masterlist_link_note = CASE
    WHEN length(public.normalize_po_number_key(po_number)) < 5 THEN
      'PO number is missing or too weak to match the Projects masterlist. Purchasing: link or correct this cost PO. Project managers: if the client PO is missing/wrong on Operations → Projects, update the masterlist and the Fund Request PO.'
    ELSE
      'No unique Projects masterlist match for this cost PO. Purchasing: link it to the correct masterlist job. Project managers: fix missing/wrong client POs on Fund Request and Projects — not on Purchase Orders.'
  END,
  updated_at = now()
WHERE masterlist_link_status = 'needs_review';
