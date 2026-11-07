-- Security advisor clean-up (docs/TODO.md item 6). Checked 2026-11-07.
--
-- 1. Pin search_path on the 17 public functions that had none
--    (lint function_search_path_mutable). None of them uses an extension or another
--    schema unqualified; auth.uid() is schema-qualified and built-ins resolve from
--    pg_catalog.
--
-- 2. Take EXECUTE away from signed-out visitors (anon) on SECURITY DEFINER functions
--    they don't need (lint anon_security_definer_function_executable). Kept for anon,
--    on purpose, because the browser calls them without a staff login:
--      is_employee_location_allowed  employee portal bundy page
--      is_location_allowed           /clock kiosk (not behind a login)
--      record_employee_first_login   /api/employee/first-login calls it with the
--                                    cookie client, which is anon for portal users.
--                                    Revoke after that route uses service_role
--                                    behind the portal session (docs/TODO.md item 17).
--    Trigger functions lose signed-in access too; triggers don't need the
--    caller's EXECUTE.
--
-- Rollback: grant execute on function <fn> to anon (and authenticated where removed);
-- alter function <fn> reset search_path.

-- 1. search_path ---------------------------------------------------------------
alter function public.calculate_distance(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric) set search_path = public;
alter function public.calculate_time_clock_hours() set search_path = public;
alter function public.check_geofence(p_company_id uuid, p_lat numeric, p_lng numeric) set search_path = public;
alter function public.get_employee_clock_status(emp_id uuid) set search_path = public;
alter function public.get_employee_supervisor_id(emp_id uuid) set search_path = public;
alter function public.get_my_employee_id() set search_path = public;
alter function public.get_my_role() set search_path = public;
alter function public.get_server_time() set search_path = public;
alter function public.handle_new_user() set search_path = public;
alter function public.is_supervisor_of(emp_id uuid) set search_path = public;
alter function public.normalize_employee_uppercase_fields() set search_path = public;
alter function public.normalize_po_number_digit_core(raw text) set search_path = public;
alter function public.normalize_po_number_key(raw text) set search_path = public;
alter function public.round_ot_hours(p_raw_hours numeric) set search_path = public;
alter function public.sync_employee_id_from_code() set search_path = public;
alter function public.update_updated_at() set search_path = public;
alter function public.update_updated_at_column() set search_path = public;

-- 2a. RLS helpers and staff-only functions: signed-in staff keep access, anon loses it.
revoke execute on function public.get_my_role() from public, anon;
revoke execute on function public.is_hr_or_admin() from public, anon;
revoke execute on function public.get_my_employee_id() from public, anon;
revoke execute on function public.is_supervisor_of(emp_id uuid) from public, anon;
revoke execute on function public.get_employee_supervisor_id(emp_id uuid) from public, anon;
revoke execute on function public.approve_failure_to_log(p_request_id uuid) from public, anon;
revoke execute on function public.reject_failure_to_log(p_request_id uuid, p_reason text) from public, anon;
revoke execute on function public.reassign_client_owner(p_client_id uuid, p_new_owner_id uuid) from public, anon;
revoke execute on function public.create_purchase_order_with_items(p_project_id uuid, p_vendor_id uuid, p_po_number text, p_po_date_text text, p_requisitioner text, p_requested_by text, p_prepared_by text, p_reviewed_by text, p_approved_by text, p_approved_by_title text, p_project_title text, p_deliver_to text, p_vendor_snapshot jsonb, p_company_snapshot jsonb, p_payment_terms text[], p_items jsonb, p_print_timestamp timestamp with time zone, p_auto_post boolean) from public, anon;

grant execute on function public.get_my_role() to authenticated, service_role;
grant execute on function public.is_hr_or_admin() to authenticated, service_role;
grant execute on function public.get_my_employee_id() to authenticated, service_role;
grant execute on function public.is_supervisor_of(emp_id uuid) to authenticated, service_role;
grant execute on function public.get_employee_supervisor_id(emp_id uuid) to authenticated, service_role;
grant execute on function public.approve_failure_to_log(p_request_id uuid) to authenticated, service_role;
grant execute on function public.reject_failure_to_log(p_request_id uuid, p_reason text) to authenticated, service_role;
grant execute on function public.reassign_client_owner(p_client_id uuid, p_new_owner_id uuid) to authenticated, service_role;
grant execute on function public.create_purchase_order_with_items(p_project_id uuid, p_vendor_id uuid, p_po_number text, p_po_date_text text, p_requisitioner text, p_requested_by text, p_prepared_by text, p_reviewed_by text, p_approved_by text, p_approved_by_title text, p_project_title text, p_deliver_to text, p_vendor_snapshot jsonb, p_company_snapshot jsonb, p_payment_terms text[], p_items jsonb, p_print_timestamp timestamp with time zone, p_auto_post boolean) to authenticated, service_role;

-- 2b. Trigger functions: nobody calls them over the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.trigger_post_purchase_order_costs() from public, anon, authenticated;

grant execute on function public.handle_new_user() to service_role;
grant execute on function public.trigger_post_purchase_order_costs() to service_role;
