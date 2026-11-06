-- Step 1b: stop anonymous and signed-in callers from running SECURITY DEFINER
-- functions that the app never calls and that do not check who is calling.
-- Each one runs with owner rights, so via /rest/v1/rpc/<name> anyone with the
-- anon key could, for example, record a punch or file overtime for any employee,
-- post purchase order costs, or read another user's permissions.
--
-- None of these names appear in app/, components/, lib/ or utils/ (checked 2026-11-06).
-- Internal callers (trigger_post_purchase_order_costs, create_purchase_order_with_items)
-- are SECURITY DEFINER themselves and run as the owner, so they keep working.
-- service_role keeps EXECUTE.
--
-- Rollback: grant execute on function public.<name>(<args>) to anon, authenticated;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'record_time_punch',
        'create_overtime_request',
        'authenticate_employee',
        'get_employee_portal_info',
        'get_employee_today_punches',
        'post_purchase_order_costs',
        'get_user_permissions',
        'check_geofence'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
