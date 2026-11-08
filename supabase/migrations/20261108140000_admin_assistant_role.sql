-- Admin assistant role (requested 2026-11-08 for l.grace.nopia@gmail.com).
--
-- The admin assistant sees the Upper Management fund request queue read-only and can
-- upload and download cheques. Nothing else: approve, reject, return to purchasing,
-- moving cutoffs and deleting cheques stay with upper_management / admin. Those checks
-- (fund_requests_approve RLS, lib/fund-request-approval.ts, the payment-check delete
-- assert) list roles explicitly, so a new role is refused there without changes.
--
-- 1. Allow the role on profiles.
-- 2. Permission defaults: fund_requests read only (DEFAULT_PERMISSIONS.admin_assistant).
--    Gives fund_requests_read through staff_can; every other staff_can policy stays false.
-- 3. Read the requester (employees) and the request's documents, like the other
--    fund request viewer roles (FUND_REQUEST_DOCUMENT_VIEWER_ROLES).
--
-- Rollback: delete or re-role any admin_assistant profile, then re-run
-- 20261107120000 (helpers), 20261108090000 (storage policy), and the previous
-- definitions of profiles_role_check, employees_select_own and fund_request_documents_select
-- (same lists without 'admin_assistant').

alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role = any (array[
  'employee', 'supervisor', 'hr', 'admin', 'upper_management', 'purchasing_officer',
  'operations_manager', 'admin_assistant'
]));

drop policy if exists employees_select_own on public.employees;
create policy employees_select_own on public.employees
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.role = any (array['hr', 'admin', 'upper_management', 'project_manager',
          'operations_manager', 'purchasing_officer', 'approver', 'viewer', 'admin_assistant'])
    )
  );

drop policy if exists fund_request_documents_select on public.fund_request_documents;
create policy fund_request_documents_select on public.fund_request_documents
  for select
  using (
    employee_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        -- keep in step with FUND_REQUEST_DOCUMENT_VIEWER_ROLES in lib/fund-request-api.ts
        and p.role = any (array['hr', 'admin', 'upper_management', 'project_manager',
          'operations_manager', 'purchasing_officer', 'approver', 'viewer', 'admin_assistant'])
    )
  );

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
                'operations_manager', 'purchasing_officer', 'approver', 'viewer', 'admin_assistant'])
          )
        )
    )
  );

-- Permission defaults: must equal DEFAULT_PERMISSIONS (lib/__tests__/rls-module-permission-defaults.test.ts).
create or replace function public.has_module_permission(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select coalesce(
    (select case
       when p.role = 'admin' and p_module in ('clients', 'projects', 'vendors') then true
       else coalesce(
         (p.permissions -> p_module ->> p_action)::boolean,
         (d.defaults -> p.role -> p_module ->> p_action)::boolean,
         false
       )
     end
     from public.profiles p
     cross join (select
-- DEFAULTS:BEGIN
$defaults${"admin":{"dashboard":{"create":true,"read":true,"update":true,"delete":true},"employees":{"create":true,"read":true,"update":true,"delete":true},"loans":{"create":true,"read":true,"update":true,"delete":true},"payslips":{"create":true,"read":true,"update":true,"delete":true},"fund_requests":{"create":true,"read":true,"update":true,"delete":true},"purchase_orders":{"create":true,"read":true,"update":true,"delete":true},"timesheet":{"create":true,"read":true,"update":true,"delete":true},"time_entries":{"create":true,"read":true,"update":true,"delete":true},"leave_approval":{"create":true,"read":true,"update":true,"delete":true},"overtime_approval":{"create":true,"read":true,"update":true,"delete":true},"failure_to_log":{"create":true,"read":true,"update":true,"delete":true},"audit":{"create":true,"read":true,"update":true,"delete":true},"bir_reports":{"create":true,"read":true,"update":true,"delete":true},"reports":{"create":true,"read":true,"update":true,"delete":true},"settings":{"create":true,"read":true,"update":true,"delete":true},"user_management":{"create":true,"read":true,"update":true,"delete":true},"clients":{"create":true,"read":true,"update":true,"delete":true},"projects":{"create":true,"read":true,"update":true,"delete":true},"vendors":{"create":true,"read":true,"update":true,"delete":true}},"upper_management":{"dashboard":{"create":true,"read":true,"update":true,"delete":true},"employees":{"create":true,"read":true,"update":true,"delete":true},"loans":{"create":true,"read":true,"update":true,"delete":true},"payslips":{"create":true,"read":true,"update":true,"delete":true},"fund_requests":{"create":true,"read":true,"update":true,"delete":true},"purchase_orders":{"create":true,"read":true,"update":true,"delete":true},"timesheet":{"create":true,"read":true,"update":true,"delete":true},"time_entries":{"create":true,"read":true,"update":true,"delete":true},"leave_approval":{"create":true,"read":true,"update":true,"delete":true},"overtime_approval":{"create":true,"read":true,"update":true,"delete":true},"failure_to_log":{"create":true,"read":true,"update":true,"delete":true},"audit":{"create":true,"read":true,"update":true,"delete":true},"bir_reports":{"create":true,"read":true,"update":true,"delete":true},"reports":{"create":true,"read":true,"update":true,"delete":true},"settings":{"create":true,"read":true,"update":true,"delete":true},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":false,"read":true,"update":false,"delete":false},"vendors":{"create":false,"read":true,"update":false,"delete":false}},"admin_assistant":{"dashboard":{"create":false,"read":false,"update":false,"delete":false},"employees":{"create":false,"read":false,"update":false,"delete":false},"loans":{"create":false,"read":false,"update":false,"delete":false},"payslips":{"create":false,"read":false,"update":false,"delete":false},"fund_requests":{"create":false,"read":true,"update":false,"delete":false},"purchase_orders":{"create":false,"read":false,"update":false,"delete":false},"timesheet":{"create":false,"read":false,"update":false,"delete":false},"time_entries":{"create":false,"read":false,"update":false,"delete":false},"leave_approval":{"create":false,"read":false,"update":false,"delete":false},"overtime_approval":{"create":false,"read":false,"update":false,"delete":false},"failure_to_log":{"create":false,"read":false,"update":false,"delete":false},"audit":{"create":false,"read":false,"update":false,"delete":false},"bir_reports":{"create":false,"read":false,"update":false,"delete":false},"reports":{"create":false,"read":false,"update":false,"delete":false},"settings":{"create":false,"read":false,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":false,"update":false,"delete":false},"projects":{"create":false,"read":false,"update":false,"delete":false},"vendors":{"create":false,"read":false,"update":false,"delete":false}},"hr":{"dashboard":{"create":false,"read":true,"update":false,"delete":false},"employees":{"create":true,"read":true,"update":true,"delete":false},"loans":{"create":true,"read":true,"update":true,"delete":false},"payslips":{"create":true,"read":true,"update":true,"delete":false},"fund_requests":{"create":true,"read":true,"update":true,"delete":false},"purchase_orders":{"create":true,"read":true,"update":true,"delete":false},"timesheet":{"create":false,"read":true,"update":true,"delete":false},"time_entries":{"create":true,"read":true,"update":false,"delete":true},"leave_approval":{"create":false,"read":true,"update":true,"delete":false},"overtime_approval":{"create":false,"read":true,"update":true,"delete":false},"failure_to_log":{"create":false,"read":true,"update":true,"delete":false},"audit":{"create":false,"read":true,"update":false,"delete":false},"bir_reports":{"create":false,"read":true,"update":false,"delete":false},"reports":{"create":false,"read":true,"update":false,"delete":false},"settings":{"create":false,"read":true,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":false,"read":true,"update":false,"delete":false},"vendors":{"create":false,"read":true,"update":false,"delete":false}},"operations_manager":{"dashboard":{"create":false,"read":true,"update":false,"delete":false},"employees":{"create":false,"read":false,"update":false,"delete":false},"loans":{"create":false,"read":false,"update":false,"delete":false},"payslips":{"create":false,"read":false,"update":false,"delete":false},"fund_requests":{"create":true,"read":true,"update":false,"delete":false},"purchase_orders":{"create":false,"read":true,"update":false,"delete":false},"timesheet":{"create":false,"read":false,"update":false,"delete":false},"time_entries":{"create":false,"read":false,"update":false,"delete":false},"leave_approval":{"create":false,"read":true,"update":true,"delete":false},"overtime_approval":{"create":false,"read":true,"update":true,"delete":false},"failure_to_log":{"create":false,"read":true,"update":true,"delete":false},"audit":{"create":false,"read":false,"update":false,"delete":false},"bir_reports":{"create":false,"read":false,"update":false,"delete":false},"reports":{"create":false,"read":false,"update":false,"delete":false},"settings":{"create":false,"read":false,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":true,"read":true,"update":true,"delete":true},"vendors":{"create":false,"read":true,"update":false,"delete":false}},"purchasing_officer":{"dashboard":{"create":false,"read":true,"update":false,"delete":false},"employees":{"create":false,"read":false,"update":false,"delete":false},"loans":{"create":false,"read":false,"update":false,"delete":false},"payslips":{"create":false,"read":false,"update":false,"delete":false},"fund_requests":{"create":true,"read":true,"update":true,"delete":false},"purchase_orders":{"create":true,"read":true,"update":true,"delete":false},"timesheet":{"create":false,"read":false,"update":false,"delete":false},"time_entries":{"create":false,"read":false,"update":false,"delete":false},"leave_approval":{"create":false,"read":true,"update":true,"delete":false},"overtime_approval":{"create":false,"read":true,"update":true,"delete":false},"failure_to_log":{"create":false,"read":true,"update":true,"delete":false},"audit":{"create":false,"read":false,"update":false,"delete":false},"bir_reports":{"create":false,"read":false,"update":false,"delete":false},"reports":{"create":false,"read":false,"update":false,"delete":false},"settings":{"create":false,"read":false,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":false,"read":true,"update":false,"delete":false},"vendors":{"create":true,"read":true,"update":true,"delete":true}},"approver":{"dashboard":{"create":false,"read":false,"update":false,"delete":false},"employees":{"create":false,"read":false,"update":false,"delete":false},"loans":{"create":false,"read":false,"update":false,"delete":false},"payslips":{"create":false,"read":false,"update":false,"delete":false},"fund_requests":{"create":false,"read":false,"update":false,"delete":false},"purchase_orders":{"create":false,"read":false,"update":false,"delete":false},"timesheet":{"create":false,"read":true,"update":false,"delete":false},"time_entries":{"create":false,"read":true,"update":false,"delete":false},"leave_approval":{"create":false,"read":true,"update":true,"delete":false},"overtime_approval":{"create":false,"read":true,"update":true,"delete":false},"failure_to_log":{"create":false,"read":true,"update":true,"delete":false},"audit":{"create":false,"read":false,"update":false,"delete":false},"bir_reports":{"create":false,"read":false,"update":false,"delete":false},"reports":{"create":false,"read":false,"update":false,"delete":false},"settings":{"create":false,"read":false,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":false,"read":true,"update":false,"delete":false},"vendors":{"create":false,"read":true,"update":false,"delete":false}},"viewer":{"dashboard":{"create":false,"read":false,"update":false,"delete":false},"employees":{"create":false,"read":false,"update":false,"delete":false},"loans":{"create":false,"read":false,"update":false,"delete":false},"payslips":{"create":false,"read":false,"update":false,"delete":false},"fund_requests":{"create":false,"read":false,"update":false,"delete":false},"purchase_orders":{"create":false,"read":false,"update":false,"delete":false},"timesheet":{"create":false,"read":true,"update":false,"delete":false},"time_entries":{"create":false,"read":true,"update":false,"delete":false},"leave_approval":{"create":false,"read":true,"update":false,"delete":false},"overtime_approval":{"create":false,"read":true,"update":false,"delete":false},"failure_to_log":{"create":false,"read":true,"update":false,"delete":false},"audit":{"create":false,"read":false,"update":false,"delete":false},"bir_reports":{"create":false,"read":false,"update":false,"delete":false},"reports":{"create":false,"read":false,"update":false,"delete":false},"settings":{"create":false,"read":false,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":false,"read":true,"update":false,"delete":false},"vendors":{"create":false,"read":true,"update":false,"delete":false}},"project_manager":{"dashboard":{"create":false,"read":true,"update":false,"delete":false},"employees":{"create":false,"read":true,"update":true,"delete":false},"loans":{"create":false,"read":false,"update":false,"delete":false},"payslips":{"create":false,"read":true,"update":false,"delete":false},"fund_requests":{"create":true,"read":true,"update":true,"delete":false},"purchase_orders":{"create":true,"read":true,"update":true,"delete":false},"timesheet":{"create":false,"read":true,"update":true,"delete":false},"time_entries":{"create":true,"read":true,"update":true,"delete":true},"leave_approval":{"create":false,"read":true,"update":true,"delete":false},"overtime_approval":{"create":false,"read":true,"update":true,"delete":false},"failure_to_log":{"create":false,"read":true,"update":true,"delete":false},"audit":{"create":false,"read":true,"update":false,"delete":false},"bir_reports":{"create":false,"read":false,"update":false,"delete":false},"reports":{"create":false,"read":true,"update":false,"delete":false},"settings":{"create":false,"read":false,"update":false,"delete":false},"user_management":{"create":false,"read":false,"update":false,"delete":false},"clients":{"create":false,"read":true,"update":false,"delete":false},"projects":{"create":false,"read":true,"update":false,"delete":false},"vendors":{"create":false,"read":true,"update":false,"delete":false}}}$defaults$
-- DEFAULTS:END
       ::jsonb as defaults) d
     where p.id = auth.uid() and p.is_active is true),
    false
  )
$fn$;

create or replace function public.staff_can(p_module text, p_action text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.has_module_permission(p_module, p_action)
$fn$;

revoke execute on function public.has_module_permission(text, text) from public, anon;
revoke execute on function public.staff_can(text, text) from public, anon;
grant execute on function public.has_module_permission(text, text) to authenticated, service_role;
grant execute on function public.staff_can(text, text) to authenticated, service_role;
