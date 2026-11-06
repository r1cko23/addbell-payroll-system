-- Step 2: remove the last anonymous reads added as a bridge in step 1.
--
-- APPLY ONLY AFTER the app deploy that moves portal reads to /api/employee-portal/*
-- (fund requests list, detail, edit load and subcontractor options; leave form holidays)
-- is live. Applied earlier, the portal's fund request screens would show nothing.
--
-- After this, anon can read no table in public directly; portal data flows only
-- through session-guarded API routes and the security-definer location checks.
-- Project time (project_assignments, project_time_entries, projects) has no rows in
-- production, so its portal screen keeps showing an empty list, as before.
--
-- Rollback: re-run the portal_read_tables loop from 20261106200000_enable_rls_on_open_tables.sql.

do $$
declare
  t text;
begin
  foreach t in array array[
    'fund_requests','holidays','projects','project_assignments','project_time_entries',
    'clients','companies','vendors','overtime_groups'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_portal_anon_read', t);
  end loop;
end $$;
