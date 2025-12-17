-- =====================================================
-- Simplify RLS for employee_week_schedules: allow select/insert/update/delete
-- Back-end function enforces lock window
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can view schedules" ON public.employee_week_schedules;
DROP POLICY IF EXISTS "Employees can insert schedules" ON public.employee_week_schedules;
DROP POLICY IF EXISTS "Account managers/admin can update schedules" ON public.employee_week_schedules;
DROP POLICY IF EXISTS "Account managers/admin can delete schedules" ON public.employee_week_schedules;

-- Allow all CRUD (function enforces time-based lock)
CREATE POLICY "Anyone can select schedules" ON public.employee_week_schedules
  FOR SELECT USING (true);

CREATE POLICY "Anyone can insert schedules" ON public.employee_week_schedules
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update schedules" ON public.employee_week_schedules
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete schedules" ON public.employee_week_schedules
  FOR DELETE USING (true);
