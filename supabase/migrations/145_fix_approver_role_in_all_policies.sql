-- =====================================================
-- 145: Fix Approver Role in All Policies
-- =====================================================
-- The RLS policies and functions check for 'account_manager' role
-- but the actual role in users table is 'approver'
-- This migration updates all policies to use 'approver' role
-- =====================================================

-- =====================================================
-- OVERTIME REQUESTS
-- =====================================================

-- Update RLS policies for overtime_requests (already done in migration 144, but ensure consistency)
DROP POLICY IF EXISTS "Account managers/admin can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Account managers/admin can manage OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Admins and approvers can view OT requests" ON public.overtime_requests;
DROP POLICY IF EXISTS "Admins and approvers can manage OT requests" ON public.overtime_requests;

CREATE POLICY "Admins and approvers can view OT requests" ON public.overtime_requests
  FOR SELECT USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('approver', 'admin'))
  );

CREATE POLICY "Admins and approvers can manage OT requests" ON public.overtime_requests
  FOR ALL USING (
    (select auth.role()) = 'service_role' OR
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('approver', 'admin'))
  );

-- =====================================================
-- LEAVE REQUESTS
-- =====================================================

-- Update RLS policies for leave_requests
DROP POLICY IF EXISTS "Account managers can view assigned leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Account managers can manage assigned leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Account managers can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Account managers can manage all leave requests" ON public.leave_requests;

-- Approvers can view assigned leave requests
CREATE POLICY "Approvers can view assigned leave requests" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'approver'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- Approvers can manage (approve/reject) assigned leave requests
CREATE POLICY "Approvers can manage assigned leave requests" ON public.leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'approver'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'approver'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- Admin can view all leave requests (already exists, but ensure it's correct)
-- Admin can manage all leave requests (already exists, but ensure it's correct)

-- =====================================================
-- FAILURE TO LOG
-- =====================================================

-- Update RLS policies for failure_to_log
DROP POLICY IF EXISTS "Account managers can view assigned failure to log requests" ON public.failure_to_log;
DROP POLICY IF EXISTS "Account managers can manage assigned failure to log requests" ON public.failure_to_log;

-- Approvers can view assigned failure to log requests
CREATE POLICY "Approvers can view assigned failure to log requests" ON public.failure_to_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'approver'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- Approvers can approve/reject assigned failure to log requests
CREATE POLICY "Approvers can manage assigned failure to log requests" ON public.failure_to_log
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'approver'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'approver'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- Admin can view all failure to log requests (already exists)
-- Admin can manage all failure to log requests (already exists)

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "Approvers can view assigned leave requests" ON public.leave_requests IS
  'Approvers can view leave requests for their assigned employees.';
COMMENT ON POLICY "Approvers can manage assigned leave requests" ON public.leave_requests IS
  'Approvers can approve/reject leave requests for their assigned employees.';
COMMENT ON POLICY "Approvers can view assigned failure to log requests" ON public.failure_to_log IS
  'Approvers can view failure to log requests for their assigned employees.';
COMMENT ON POLICY "Approvers can manage assigned failure to log requests" ON public.failure_to_log IS
  'Approvers can approve/reject failure to log requests for their assigned employees.';