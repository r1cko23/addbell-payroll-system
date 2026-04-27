-- Enforce uppercase formatting for employee text details.
-- 1) Backfill existing rows that are not uppercase.
-- 2) Enforce uppercase on every future INSERT/UPDATE.

UPDATE public.employees
SET
  company_id_no = upper(trim(company_id_no)),
  first_name = upper(trim(first_name)),
  middle_name = CASE
    WHEN middle_name IS NULL OR trim(middle_name) = '' THEN NULL
    ELSE upper(trim(middle_name))
  END,
  last_name = upper(trim(last_name)),
  suffix = CASE
    WHEN suffix IS NULL OR trim(suffix) = '' THEN NULL
    ELSE upper(trim(suffix))
  END,
  address = CASE
    WHEN address IS NULL OR trim(address) = '' THEN NULL
    ELSE upper(trim(address))
  END,
  contact_person = CASE
    WHEN contact_person IS NULL OR trim(contact_person) = '' THEN NULL
    ELSE upper(trim(contact_person))
  END,
  contact_person_relationship = CASE
    WHEN contact_person_relationship IS NULL OR trim(contact_person_relationship) = '' THEN NULL
    ELSE upper(trim(contact_person_relationship))
  END,
  bank_name = CASE
    WHEN bank_name IS NULL OR trim(bank_name) = '' THEN NULL
    ELSE upper(trim(bank_name))
  END,
  bank_account_name = CASE
    WHEN bank_account_name IS NULL OR trim(bank_account_name) = '' THEN NULL
    ELSE upper(trim(bank_account_name))
  END;

CREATE OR REPLACE FUNCTION public.normalize_employee_uppercase_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.company_id_no := upper(trim(NEW.company_id_no));
  NEW.first_name := upper(trim(NEW.first_name));
  NEW.middle_name := CASE
    WHEN NEW.middle_name IS NULL OR trim(NEW.middle_name) = '' THEN NULL
    ELSE upper(trim(NEW.middle_name))
  END;
  NEW.last_name := upper(trim(NEW.last_name));
  NEW.suffix := CASE
    WHEN NEW.suffix IS NULL OR trim(NEW.suffix) = '' THEN NULL
    ELSE upper(trim(NEW.suffix))
  END;
  NEW.address := CASE
    WHEN NEW.address IS NULL OR trim(NEW.address) = '' THEN NULL
    ELSE upper(trim(NEW.address))
  END;
  NEW.contact_person := CASE
    WHEN NEW.contact_person IS NULL OR trim(NEW.contact_person) = '' THEN NULL
    ELSE upper(trim(NEW.contact_person))
  END;
  NEW.contact_person_relationship := CASE
    WHEN NEW.contact_person_relationship IS NULL OR trim(NEW.contact_person_relationship) = '' THEN NULL
    ELSE upper(trim(NEW.contact_person_relationship))
  END;
  NEW.bank_name := CASE
    WHEN NEW.bank_name IS NULL OR trim(NEW.bank_name) = '' THEN NULL
    ELSE upper(trim(NEW.bank_name))
  END;
  NEW.bank_account_name := CASE
    WHEN NEW.bank_account_name IS NULL OR trim(NEW.bank_account_name) = '' THEN NULL
    ELSE upper(trim(NEW.bank_account_name))
  END;

  IF NEW.first_name IS NOT NULL AND NEW.last_name IS NOT NULL THEN
    NEW.full_name := concat_ws(' ', NEW.first_name, NEW.middle_name, NEW.last_name, NEW.suffix);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_employee_uppercase_fields ON public.employees;

CREATE TRIGGER trg_normalize_employee_uppercase_fields
BEFORE INSERT OR UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.normalize_employee_uppercase_fields();
