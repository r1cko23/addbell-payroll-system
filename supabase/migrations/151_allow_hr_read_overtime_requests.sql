-- =====================================================
-- 151: Allow HR to read overtime_requests for payslip generation
-- =====================================================
-- Payslips page fetches approved OT to show on payslip. RLS previously
-- allowed only 'approver' and 'admin' to SELECT overtime_requests.
-- HR can view payslips but could not read OT, so payslip showed 0 OT
-- despite Time Attendance showing 9 hours. Add 'hr' to view policy.
-- =====================================================

DROP POLICY IF EXISTS "Admins and approvers can view OT requests" ON public.overtime_requests;

CREATE POLICY "Admins, approvers, and HR can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    (SELECT auth.role()) = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('approver', 'admin', 'hr')
    )
  );

COMMENT ON POLICY "Admins, approvers, and HR can view OT requests" ON public.overtime_requests IS
  'Allows admin, approver, and hr to read OT requests. HR needs read access for payslip generation.';