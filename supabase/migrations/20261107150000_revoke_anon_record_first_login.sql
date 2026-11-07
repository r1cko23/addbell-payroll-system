-- docs/TODO.md item 17, step 2. APPLY ONLY AFTER the deploy where
-- /api/employee/first-login checks the portal session and calls this function with
-- the service role. Applied earlier, first-login records stop being written.
--
-- Rollback: grant execute on function public.record_employee_first_login(...) to anon, authenticated;

revoke execute on function public.record_employee_first_login(p_employee_id uuid, p_ip_address text, p_user_agent text, p_device_info text, p_browser_name text, p_browser_version text, p_os_name text, p_os_version text, p_device_type text, p_mac_address text) from public, anon, authenticated;
grant execute on function public.record_employee_first_login(p_employee_id uuid, p_ip_address text, p_user_agent text, p_device_info text, p_browser_name text, p_browser_version text, p_os_name text, p_os_version text, p_device_type text, p_mac_address text) to service_role;
