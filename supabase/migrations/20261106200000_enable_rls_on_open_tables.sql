-- Step 1 of 3: close anonymous access to the 27 public tables that had RLS off.
--
-- Before: RLS disabled, so the public anon key (shipped in every browser) could
-- read AND write these tables without signing in.
-- After:
--   * authenticated (signed-in staff): full access, same as today, so no staff screen changes.
--   * anon: no writes anywhere; SELECT only on the 9 tables the employee portal still
--     reads straight from the browser (step 2 moves those reads behind portal APIs).
--   * service_role (server routes, crons, sheet sync) bypasses RLS and is unaffected.
-- Security-definer RPCs used by the portal and kiosk (is_employee_location_allowed,
-- is_location_allowed, get_my_role) are unaffected.
--
-- Rollback (restores the old behaviour exactly):
--   alter table public.<t> disable row level security;  -- for each table below

do $$
declare
  t text;
  all_tables text[] := array[
    'attendance_records','clients','companies','cost_codes','departments',
    'employee_first_login','employee_location_assignments','employee_week_schedules',
    'fund_request_items','fund_requests','holidays','office_locations','overtime_groups',
    'payroll_runs','positions','project_assignments','project_cost_codes',
    'project_cost_ledger','project_costs','project_manpower_costs','project_progress',
    'project_time_entries','project_vendors','projects','purchase_order_items',
    'purchase_orders','vendors'
  ];
  -- Read from the portal's browser with the anon key today (see plan). Removed in step 2.
  portal_read_tables text[] := array[
    'fund_requests','holidays','projects','project_assignments','project_time_entries',
    'clients','companies','vendors','overtime_groups'
  ];
begin
  foreach t in array all_tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (true) with check (true)',
      t || '_authenticated_all', t
    );
  end loop;

  foreach t in array portal_read_tables loop
    execute format('drop policy if exists %I on public.%I', t || '_portal_anon_read', t);
    execute format(
      'create policy %I on public.%I for select to anon using (true)',
      t || '_portal_anon_read', t
    );
  end loop;
end $$;
