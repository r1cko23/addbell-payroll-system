-- Storage bucket review (docs/TODO.md item 7). Checked 2026-11-08.
--
-- fund-request-documents is the only bucket. It is private, 5 MB per file, with one
-- read policy and no write policies. Every upload, download and delete in the app goes
-- through the service role (signed upload URLs, signed download URLs after
-- assertCanViewFundRequestDocument), so the browser never reads the bucket directly.
-- All 591 document rows point at a file that exists.
--
-- Two tightenings:
-- 1. Only accept the file types the app's pickers offer. All 392 stored files are
--    jpeg, pdf or docx today.
-- 2. The read policy ignored deactivated staff. Middleware blocks them, but a token
--    issued before deactivation could still read the bucket over the API.
--
-- Rollback:
--   update storage.buckets set allowed_mime_types = null where id = 'fund-request-documents';
--   and recreate the policy below without "and p.is_active is true".

update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp'
]
where id = 'fund-request-documents';

drop policy if exists fund_request_documents_storage_read on storage.objects;
create policy fund_request_documents_storage_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'fund-request-documents'
    and exists (
      select 1
      from public.fund_request_documents d
      where d.storage_path = objects.name
        and (
          exists (
            select 1 from public.employees e
            where e.id = d.employee_id and e.user_id = auth.uid()
          )
          or exists (
            select 1 from public.profiles p
            where p.id = auth.uid()
              and p.is_active is true
              -- keep in step with FUND_REQUEST_DOCUMENT_VIEWER_ROLES in lib/fund-request-api.ts
              and p.role = any (array['hr', 'admin', 'upper_management', 'project_manager',
                'operations_manager', 'purchasing_officer', 'approver', 'viewer'])
          )
        )
    )
  );
