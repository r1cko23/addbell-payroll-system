-- Purchasing officers need to read employees for fund-request self-link search.
-- Also fix own-row match: employees.user_id (not employees.id) maps to auth.uid().

DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own" ON public.employees
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'hr', 'admin', 'upper_management',
        'project_manager', 'operations_manager',
        'purchasing_officer',
        'approver', 'viewer'
      )
    )
  );

-- Link Phen Conte (dashboard) to Josefina Echavia Conte (employee record).
UPDATE public.employees e
SET
  user_id = p.id,
  updated_at = NOW()
FROM public.profiles p
WHERE (
    LOWER(TRIM(p.full_name)) IN ('phen conte', 'phen e. conte')
    OR LOWER(p.email) LIKE '%phen.conte%'
  )
  AND p.role = 'purchasing_officer'
  AND (
    LOWER(COALESCE(e.full_name, '')) LIKE '%josefina%conte%'
    OR LOWER(COALESCE(e.full_name, '')) LIKE '%conte%josefina%'
    OR e.id = '6bdf9636-ca19-416c-b64d-1227111db2ba'::uuid
  )
  AND (e.user_id IS NULL OR e.user_id = p.id);
