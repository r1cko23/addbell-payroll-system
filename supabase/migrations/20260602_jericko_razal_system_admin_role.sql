-- Promote Jericko Razal to sole system `admin` role.
-- Upper management (Dado, Edna, Gigi) keeps operational access without user mgmt / manual punch.
UPDATE profiles
SET role = 'admin'
WHERE email = 'jericko.rzl@gmail.com'
  AND role IS DISTINCT FROM 'admin';
