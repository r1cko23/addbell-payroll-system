-- RLS for core tables: employees, time_entries, leave_requests, overtime_requests
-- Roles: employee (own data), hr, admin, upper_management (broader access).
-- If employees are linked to auth via user_id, change (id = auth.uid()) to (user_id = auth.uid()).

-- 1) employees
ALTER TABLE IF EXISTS public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own" ON public.employees
  FOR SELECT
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

DROP POLICY IF EXISTS "employees_all_hr_admin" ON public.employees;
CREATE POLICY "employees_all_hr_admin" ON public.employees
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

-- 2) time_entries
ALTER TABLE IF EXISTS public.time_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "time_entries_select_own" ON public.time_entries;
CREATE POLICY "time_entries_select_own" ON public.time_entries
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

DROP POLICY IF EXISTS "time_entries_insert_own" ON public.time_entries;
CREATE POLICY "time_entries_insert_own" ON public.time_entries
  FOR INSERT
  WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "time_entries_update_delete_hr_admin" ON public.time_entries;
CREATE POLICY "time_entries_update_delete_hr_admin" ON public.time_entries
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

-- 3) leave_requests
ALTER TABLE IF EXISTS public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_select_own" ON public.leave_requests;
CREATE POLICY "leave_requests_select_own" ON public.leave_requests
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

DROP POLICY IF EXISTS "leave_requests_insert_own" ON public.leave_requests;
CREATE POLICY "leave_requests_insert_own" ON public.leave_requests
  FOR INSERT
  WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "leave_requests_update_delete_hr_admin" ON public.leave_requests;
CREATE POLICY "leave_requests_update_delete_hr_admin" ON public.leave_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

-- 4) overtime_requests (optional)
ALTER TABLE IF EXISTS public.overtime_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overtime_requests_select_own" ON public.overtime_requests;
CREATE POLICY "overtime_requests_select_own" ON public.overtime_requests
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );

DROP POLICY IF EXISTS "overtime_requests_insert_own" ON public.overtime_requests;
CREATE POLICY "overtime_requests_insert_own" ON public.overtime_requests
  FOR INSERT
  WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "overtime_requests_all_hr_admin" ON public.overtime_requests;
CREATE POLICY "overtime_requests_all_hr_admin" ON public.overtime_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('hr', 'admin', 'upper_management')
    )
  );
