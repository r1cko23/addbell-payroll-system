-- =====================================================
-- Adjust OT RLS to allow employee portal (no auth.uid match)
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Employees can view own OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Employees can insert own OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can manage OT requests" ON public.overtime_requests;

-- Recreate permissive select/insert for employee portal (client-side scoped)
CREATE POLICY "Employees can view own OT requests" ON public.overtime_requests
  FOR SELECT USING (true);

CREATE POLICY "Employees can insert own OT requests" ON public.overtime_requests
  FOR INSERT WITH CHECK (true);

-- Account managers/admin can manage all
CREATE POLICY "Account managers/admin can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );

CREATE POLICY "Account managers/admin can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );
