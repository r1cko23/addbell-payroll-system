-- Phen Conte should be Purchasing Officer, not Operations Manager.

UPDATE public.profiles
SET
  role = 'purchasing_officer',
  updated_at = NOW()
WHERE LOWER(TRIM(full_name)) IN ('phen conte', 'phen e. conte')
   OR LOWER(email) LIKE '%phen.conte%';
