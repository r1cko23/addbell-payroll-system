-- Portal passwords, part B: store them as bcrypt hashes.
-- APPLY LAST, after part A is applied and the app deploy that verifies passwords
-- through portal_login_employee_id / portal_verify_password is live. Applied before
-- that deploy, the old login code (plain-text comparison) would reject everyone.
--
-- The trigger hashes any plain value written to employees.portal_password, whoever
-- writes it: HR password reset, new employees from the dashboard, Excel import
-- scripts, the change-password route. Values already hashed are left alone.
-- The update at the end hashes every existing plain-text password once.
--
-- No rollback restores plain text (by design). To undo the trigger only:
--   drop trigger if exists trg_zz_hash_portal_password on public.employees;

create or replace function public.hash_portal_password()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  if new.portal_password is not null
     and new.portal_password <> ''
     and new.portal_password !~ '^\$2[aby]\$' then
    new.portal_password := extensions.crypt(new.portal_password, extensions.gen_salt('bf', 10));
  end if;
  return new;
end;
$$;

revoke execute on function public.hash_portal_password() from public, anon, authenticated;

-- "zz" so it runs after the other BEFORE triggers on employees (they fire by name).
drop trigger if exists trg_zz_hash_portal_password on public.employees;
create trigger trg_zz_hash_portal_password
  before insert or update of portal_password on public.employees
  for each row execute function public.hash_portal_password();

-- One-time backfill: rewriting the value fires the trigger above.
update public.employees
set portal_password = portal_password
where portal_password is not null
  and portal_password <> ''
  and portal_password !~ '^\$2[aby]\$';
