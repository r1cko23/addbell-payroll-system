-- Operations Manager submissions skip the OM approval step and go straight to
-- Purchasing. Older submissions incorrectly stored the requester as OM approver.
UPDATE public.fund_requests fr
SET
  project_manager_approved_by = NULL,
  project_manager_approved_at = NULL
FROM public.employees e
WHERE fr.requested_by = e.id
  AND e.user_id IS NOT NULL
  AND fr.project_manager_approved_by = e.user_id
  AND fr.status = 'project_manager_approved'
  AND fr.purchasing_officer_approved_at IS NULL;
