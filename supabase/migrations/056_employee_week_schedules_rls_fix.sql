-- =====================================================
-- Relax RLS for employee_week_schedules to allow employee portal inserts
-- Employees: select/insert freely (client passes employee_id)
-- Account managers/admin: can update/delete (edit weeks) and select
-- =====================================================

-- Drop old policies
DROP POLICY IF EXISTS "Employees can view own schedules" ON public.employee_week_schedules;
DROP POLICY IF EXISTS "Employees can manage own schedules" ON public.employee_week_schedules;
DROP POLICY IF EXISTS "Account managers/admin can view schedules" ON public.employee_week_schedules;
DROP POLICY IF EXISTS "Account managers/admin can manage schedules" ON public.employee_week_schedules;

-- Employees (anon/auth) - allow select/insert
CREATE POLICY "Employees can view schedules" ON public.employee_week_schedules
  FOR SELECT USING (true);

CREATE POLICY "Employees can insert schedules" ON public.employee_week_schedules
  FOR INSERT WITH CHECK (true);

-- Account managers/admin can update/delete
CREATE POLICY "Account managers/admin can update schedules" ON public.employee_week_schedules
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );

CREATE POLICY "Account managers/admin can delete schedules" ON public.employee_week_schedules
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );