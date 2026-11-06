-- RLS step 3, area 2: fund requests, purchase orders, directory and project tables.
-- Replaces the step 1 "any signed-in user can do anything" policy with rules that
-- mirror lib/permissions.ts (role defaults + profiles.permissions overrides), checked
-- 2026-11-06 against every browser query and every user-session API route.
--
-- Keep public.staff_can() in step with DEFAULT_PERMISSIONS in lib/permissions.ts for
-- the five modules below. Named purchase-order creators (lib/purchase-order-access.ts)
-- already carry a matching purchase_orders override in profiles.permissions.
--
-- service_role (all /api routes, sheet sync, crons) bypasses RLS and is unaffected.

-- 1. Helpers -----------------------------------------------------------------

create or replace function public.staff_can(p_module text, p_action text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_role text;
  v_perms jsonb;
  v_override text;
  v_letter text := case p_action
    when 'create' then 'c' when 'read' then 'r' when 'update' then 'u' when 'delete' then 'd' end;
begin
  select role, permissions into v_role, v_perms
  from public.profiles
  where id = auth.uid() and coalesce(is_active, true);

  if v_role is null or v_letter is null then return false; end if;
  if v_role = 'admin' then return true; end if;

  v_override := v_perms -> p_module ->> p_action;
  if v_override is not null then return v_override::boolean; end if;

  return position(v_letter in coalesce((
    select d.actions from (values
      ('upper_management','fund_requests','crud'),('upper_management','purchase_orders','crud'),
      ('upper_management','clients','r'),('upper_management','projects','r'),('upper_management','vendors','r'),
      ('hr','fund_requests','cru'),('hr','purchase_orders','cru'),
      ('hr','clients','r'),('hr','projects','r'),('hr','vendors','r'),
      ('operations_manager','fund_requests','cr'),('operations_manager','purchase_orders','r'),
      ('operations_manager','clients','r'),('operations_manager','projects','crud'),('operations_manager','vendors','r'),
      ('purchasing_officer','fund_requests','cru'),('purchasing_officer','purchase_orders','cru'),
      ('purchasing_officer','clients','r'),('purchasing_officer','projects','r'),('purchasing_officer','vendors','crud'),
      ('project_manager','fund_requests','cru'),('project_manager','purchase_orders','cru'),
      ('project_manager','clients','r'),('project_manager','projects','r'),('project_manager','vendors','r'),
      ('approver','clients','r'),('approver','projects','r'),('approver','vendors','r'),
      ('viewer','clients','r'),('viewer','projects','r'),('viewer','vendors','r')
    ) as d(role, module, actions)
    where d.role = v_role and d.module = p_module
  ), '')) > 0;
end;
$$;

-- True when the employee row belongs to the signed-in staff login.
create or replace function public.is_my_employee(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.employees e
    where e.id = p_employee_id and e.user_id = auth.uid()
  );
$$;

revoke execute on function public.staff_can(text, text) from public, anon;
revoke execute on function public.is_my_employee(uuid) from public, anon;
grant execute on function public.staff_can(text, text) to authenticated, service_role;
grant execute on function public.is_my_employee(uuid) to authenticated, service_role;

-- 2. Drop the broad step 1 policy on every table in this area ----------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'fund_requests','fund_request_items','purchase_orders','purchase_order_items',
    'vendors','clients','companies','projects','project_assignments','project_progress',
    'project_time_entries','project_cost_ledger','overtime_groups',
    'project_cost_codes','project_costs','project_manpower_costs','project_vendors','cost_codes'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
  end loop;
end $$;

-- 3. New policies -------------------------------------------------------------

-- Fund requests: read with the module or as the requester; approve as an approver role.
-- Create, edit-by-requester and delete go through /api/fund-requests (service role).
create policy fund_requests_read on public.fund_requests for select to authenticated
  using (public.staff_can('fund_requests','read') or public.is_my_employee(requested_by));
create policy fund_requests_approve on public.fund_requests for update to authenticated
  using (public.get_my_role() = any (array['admin','upper_management','operations_manager','purchasing_officer']))
  with check (public.get_my_role() = any (array['admin','upper_management','operations_manager','purchasing_officer']));

-- Purchase orders and their lines follow the purchase_orders module (overrides included).
create policy purchase_orders_read on public.purchase_orders for select to authenticated
  using (public.staff_can('purchase_orders','read'));
create policy purchase_orders_create on public.purchase_orders for insert to authenticated
  with check (public.staff_can('purchase_orders','create'));
create policy purchase_orders_update on public.purchase_orders for update to authenticated
  using (public.staff_can('purchase_orders','update'))
  with check (public.staff_can('purchase_orders','update'));
create policy purchase_order_items_read on public.purchase_order_items for select to authenticated
  using (public.staff_can('purchase_orders','read'));
create policy purchase_order_items_create on public.purchase_order_items for insert to authenticated
  with check (public.staff_can('purchase_orders','create'));

-- Directory: every signed-in staff can read (names appear on requests and POs);
-- changes follow the clients / vendors modules.
create policy vendors_read on public.vendors for select to authenticated using (true);
create policy vendors_create on public.vendors for insert to authenticated
  with check (public.staff_can('vendors','create'));
create policy vendors_update on public.vendors for update to authenticated
  using (public.staff_can('vendors','update')) with check (public.staff_can('vendors','update'));
create policy vendors_delete on public.vendors for delete to authenticated
  using (public.staff_can('vendors','delete'));

create policy clients_read on public.clients for select to authenticated using (true);
create policy clients_create on public.clients for insert to authenticated
  with check (public.staff_can('clients','create'));
create policy clients_update on public.clients for update to authenticated
  using (public.staff_can('clients','update')) with check (public.staff_can('clients','update'));
create policy clients_delete on public.clients for delete to authenticated
  using (public.staff_can('clients','delete'));

create policy companies_read on public.companies for select to authenticated using (true);
create policy overtime_groups_read on public.overtime_groups for select to authenticated using (true);

-- Projects: everyone reads; edits follow the projects module. Create and delete go
-- through the API (service role).
create policy projects_read on public.projects for select to authenticated using (true);
create policy projects_update on public.projects for update to authenticated
  using (public.staff_can('projects','update')) with check (public.staff_can('projects','update'));

create policy project_assignments_read on public.project_assignments for select to authenticated using (true);
create policy project_assignments_create on public.project_assignments for insert to authenticated
  with check (public.staff_can('projects','update'));

create policy project_progress_read on public.project_progress for select to authenticated using (true);
create policy project_progress_create on public.project_progress for insert to authenticated
  with check (public.staff_can('projects','update'));

-- Project clock (no rows in production yet): anyone who can open projects.
create policy project_time_entries_read on public.project_time_entries for select to authenticated using (true);
create policy project_time_entries_create on public.project_time_entries for insert to authenticated
  with check (public.staff_can('projects','read'));
create policy project_time_entries_update on public.project_time_entries for update to authenticated
  using (public.staff_can('projects','read')) with check (public.staff_can('projects','read'));

create policy project_cost_ledger_read on public.project_cost_ledger for select to authenticated
  using (public.staff_can('projects','read'));

-- fund_request_items, project_cost_codes, project_costs, project_manpower_costs,
-- project_vendors and cost_codes keep RLS on with no policy: server only.

-- Rollback (per table <t>):
--   drop policy ... (each policy above) on public.<t>;
--   create policy <t>_authenticated_all on public.<t> for all to authenticated using (true) with check (true);
