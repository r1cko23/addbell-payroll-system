UPDATE public.vendors
SET
  tin = NULLIF(trim(tin), ''),
  phone = NULLIF(trim(phone), ''),
  email = NULLIF(lower(trim(email)), ''),
  contact_person = NULLIF(trim(contact_person), ''),
  updated_at = now();

UPDATE public.vendors
SET
  name = 'PARKLANE COMMERCIAL CORPORATION',
  updated_at = now()
WHERE upper(trim(name)) = 'PARKLANE COMMERCIAL CORPORATON';
