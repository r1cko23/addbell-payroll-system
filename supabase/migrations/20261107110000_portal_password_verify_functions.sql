-- Portal passwords, part A: verify passwords inside the database.
-- APPLY FIRST, before deploying the app change that calls these functions.
-- Safe to apply at any time: nothing calls them until that deploy.
--
-- Both functions accept a stored password that is either bcrypt-hashed ($2a$/$2b$/$2y$)
-- or still plain text, so logins keep working before and after part B hashes them.
-- Only the service role (the app's login and change-password API routes) may call them.

create or replace function public.portal_password_matches(p_stored text, p_password text)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select case
    when p_stored is null or p_password is null then false
    when p_stored ~ '^\$2[aby]\$' then p_stored = extensions.crypt(p_password, p_stored)
    else p_stored = p_password
  end;
$$;

-- Same identifier order as the old login route: employee_id, company_id_no, employee_code.
create or replace function public.portal_login_employee_id(p_login_id text, p_password text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select e.id
  from public.employees e
  where e.is_active
    and public.portal_password_matches(e.portal_password, p_password)
    and (e.employee_id = p_login_id or e.company_id_no = p_login_id or e.employee_code = p_login_id)
  order by
    case
      when e.employee_id = p_login_id then 1
      when e.company_id_no = p_login_id then 2
      else 3
    end
  limit 1;
$$;

create or replace function public.portal_verify_password(p_employee_id uuid, p_password text)
returns boolean
language sql
stable
security definer
set search_path = public, extensions
as $$
  select coalesce(
    (select public.portal_password_matches(e.portal_password, p_password)
     from public.employees e where e.id = p_employee_id),
    false
  );
$$;

revoke execute on function public.portal_password_matches(text, text) from public, anon, authenticated;
revoke execute on function public.portal_login_employee_id(text, text) from public, anon, authenticated;
revoke execute on function public.portal_verify_password(uuid, text) from public, anon, authenticated;
grant execute on function public.portal_password_matches(text, text) to service_role;
grant execute on function public.portal_login_employee_id(text, text) to service_role;
grant execute on function public.portal_verify_password(uuid, text) to service_role;
