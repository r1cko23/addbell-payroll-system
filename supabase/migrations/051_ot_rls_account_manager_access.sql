-- =====================================================
-- Fix OT RLS to allow account_manager to read/approve via service role
-- =====================================================

-- Drop previous policies
DROP POLICY IF EXISTS "Employees can view own OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Employees can insert own OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can manage OT requests" ON public.overtime_requests;

-- Employees: view/insert own (portal relies on client-side scoping)
CREATE POLICY "Employees can view own OT requests" ON public.overtime_requests
  FOR SELECT USING (employee_id = auth.uid() OR (select auth.role()) = 'service_role');

CREATE POLICY "Employees can insert own OT requests" ON public.overtime_requests
  FOR INSERT WITH CHECK (employee_id = auth.uid() OR (select auth.role()) = 'service_role');

-- Account managers/admin: view/manage all
CREATE POLICY "Account managers/admin can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );

CREATE POLICY "Account managers/admin can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );
