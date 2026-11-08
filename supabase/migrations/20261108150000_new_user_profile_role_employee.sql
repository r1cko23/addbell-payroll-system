-- New auth users always get role 'employee' on their profile.
--
-- handle_new_user copied raw_user_meta_data->>'role' into public.profiles. Public sign-up is
-- on for this project and the anon key ships in the browser, so anyone could sign up with
-- {"role": "admin"} in their metadata, confirm their own email and sign in as admin.
-- Checked 2026-11-08: no profile with a staff role came from sign-up metadata (the one user
-- with a metadata role is an 'employee').
--
-- Staff roles are now set only by an admin: Settings -> Add user (/api/users/create upserts the
-- profile with the service role) or SQL.
--
-- Rollback: put back COALESCE(NEW.raw_user_meta_data->>'role', 'employee') for the role value.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    'employee'
  )
  on conflict (id) do nothing;
  return new;
end;
$fn$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.handle_new_user() to service_role;
