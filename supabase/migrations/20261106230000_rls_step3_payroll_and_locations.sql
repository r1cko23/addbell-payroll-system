-- RLS step 3, area 1: payroll runs, location and HR reference tables.
-- Replaces the step 1 "any signed-in user can do anything" policy on these tables
-- with rules that match how the app uses them (checked 2026-11-06 against every
-- browser query, embedded join and user-session API route).
--
--   payroll_runs                    admin, upper_management, hr (same as payslips)
--   office_locations, departments,
--   positions, holidays             any signed-in staff may read; only the server writes
--   attendance_records              read: admin, upper_management, hr, operations_manager
--   employee_first_login            read: admin, upper_management, hr (audit page)
--   employee_location_assignments,
--   employee_week_schedules         server only (no browser use)
--
-- service_role (API routes, crons) bypasses RLS and is unaffected.
--
-- Rollback for any table <t>:
--   drop policy if exists <t>_staff_read on public.<t>;
--   drop policy if exists <t>_payroll_staff on public.<t>;
--   create policy <t>_authenticated_all on public.<t> for all to authenticated using (true) with check (true);

do $$
declare
  t text;
begin
  -- Remove the broad step 1 policy from every table in this area.
  foreach t in array array[
    'payroll_runs','office_locations','departments','positions','holidays',
    'attendance_records','employee_first_login',
    'employee_location_assignments','employee_week_schedules'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_authenticated_all', t);
  end loop;

  -- Reference data: read for all signed-in staff.
  foreach t in array array['office_locations','departments','positions','holidays'] loop
    execute format('drop policy if exists %I on public.%I', t || '_staff_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_staff_read', t
    );
  end loop;
end $$;

drop policy if exists payroll_runs_payroll_staff on public.payroll_runs;
create policy payroll_runs_payroll_staff on public.payroll_runs
  for all to authenticated
  using (public.get_my_role() = any (array['admin','upper_management','hr']))
  with check (public.get_my_role() = any (array['admin','upper_management','hr']));

drop policy if exists attendance_records_staff_read on public.attendance_records;
create policy attendance_records_staff_read on public.attendance_records
  for select to authenticated
  using (public.get_my_role() = any (array['admin','upper_management','hr','operations_manager']));

drop policy if exists employee_first_login_staff_read on public.employee_first_login;
create policy employee_first_login_staff_read on public.employee_first_login
  for select to authenticated
  using (public.get_my_role() = any (array['admin','upper_management','hr']));

-- employee_location_assignments and employee_week_schedules keep RLS on with no
-- policy: only the service role (HR location API) can read or write them.
