-- =====================================================
-- 069: OT RLS - Account Manager Only
--  - Update RLS policies to only allow account managers (remove admin access)
--  - Keep service_role access for backend operations
-- =====================================================

-- Drop previous policies
DROP POLICY IF EXISTS "Account managers/admin can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can manage OT requests" ON public.overtime_requests;

-- Account managers only: view/manage all (service_role still has access for backend)
CREATE POLICY "Account managers can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'account_manager')
  );

CREATE POLICY "Account managers can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role = 'account_manager')
  );




