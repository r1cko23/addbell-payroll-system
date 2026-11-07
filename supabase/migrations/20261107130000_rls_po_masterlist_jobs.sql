-- Lock down po_masterlist_jobs (docs/TODO.md item 3), the last public table that
-- let any signed-in staff login read and write every row.
--
-- Checked 2026-11-07:
--   - Every write (masterlist API create/update, sheet pull, sheet writeback, job sync)
--     runs as service_role, which bypasses RLS. Per-column edit rules stay in the API
--     (lib/po-masterlist-column-acl.ts).
--   - The only browser read is the project detail page (app/projects/[id]/page.tsx),
--     which needs the projects module.
--   - No other policy, function, view or trigger reads this table.
--
-- So: read with projects.read, no browser writes.
--
-- Rollback:
--   drop policy if exists po_masterlist_jobs_read on public.po_masterlist_jobs;
--   create policy po_masterlist_jobs_authenticated_all on public.po_masterlist_jobs
--     for all to authenticated using (true) with check (true);

drop policy if exists po_masterlist_jobs_authenticated_all on public.po_masterlist_jobs;

drop policy if exists po_masterlist_jobs_read on public.po_masterlist_jobs;
create policy po_masterlist_jobs_read on public.po_masterlist_jobs
  for select to authenticated
  using (public.has_module_permission('projects', 'read'));
