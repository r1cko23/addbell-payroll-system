-- Retire /clock (docs/TODO.md item 18). Checked 2026-11-08.
--
-- /clock was an unlinked staff page that let HR, admin and upper management punch any
-- employee in or out. Its location check, is_location_allowed, always failed
-- (office_locations.latitude/longitude are double precision and calculate_distance only
-- takes numeric) and the page ignored the error. The page is deleted; nothing else calls
-- the function (no app code, no other database function). Employees punch through the
-- portal bundy, which uses is_employee_location_allowed.
--
-- The function stays, with nobody but the service role allowed to run it.
--
-- Rollback: grant execute on function public.is_location_allowed(numeric, numeric) to anon, authenticated;

revoke execute on function public.is_location_allowed(p_latitude numeric, p_longitude numeric) from public, anon, authenticated;
grant execute on function public.is_location_allowed(p_latitude numeric, p_longitude numeric) to service_role;
