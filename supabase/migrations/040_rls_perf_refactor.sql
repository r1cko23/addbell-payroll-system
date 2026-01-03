-- =====================================================
-- RLS performance refactor: wrap auth.* calls with SELECT
-- and align policies to avoid initplan re-evaluation overhead.
-- No change to logical access; only expression rewrites.
-- =====================================================
-- employees
ALTER POLICY "All authenticated users can view employees" ON public.employees
  USING ((select auth.role()) = 'authenticated');

-- weekly_attendance
ALTER POLICY "All authenticated users can view attendance" ON public.weekly_attendance
  USING ((select auth.role()) = 'authenticated');

-- employee_deductions
ALTER POLICY "All authenticated users can view deductions" ON public.employee_deductions
  USING ((select auth.role()) = 'authenticated');

-- payslips
ALTER POLICY "All authenticated users can view payslips" ON public.payslips
  USING ((select auth.role()) = 'authenticated');

-- holidays
ALTER POLICY "All authenticated users can view holidays" ON public.holidays
  USING ((select auth.role()) = 'authenticated');

-- employee_location_assignments
ALTER POLICY "All authenticated users can view location assignments" ON public.employee_location_assignments
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
    )
  );

ALTER POLICY "HR/Admin can manage location assignments" ON public.employee_location_assignments
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'hr')
    )
  );

-- office_locations
ALTER POLICY "HR/Admin can manage office locations" ON public.office_locations
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('admin', 'hr')
    )
  );

-- failure_to_log
ALTER POLICY "Account managers can view assigned failure to log requests" ON public.failure_to_log
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role = 'account_manager'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

ALTER POLICY "Account managers can manage assigned failure to log requests" ON public.failure_to_log
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role = 'account_manager'
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
      WHERE users.id = (select auth.uid())
      AND users.role = 'account_manager'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

ALTER POLICY "HR/Admin can view all failure to log requests" ON public.failure_to_log
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('hr', 'admin')
    )
  );

ALTER POLICY "HR/Admin can manage all failure to log requests" ON public.failure_to_log
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('hr', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('hr', 'admin')
    )
  );

-- leave_requests
ALTER POLICY "Account managers can view assigned leave requests" ON public.leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role = 'account_manager'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

ALTER POLICY "Account managers can manage assigned leave requests" ON public.leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role = 'account_manager'
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
      WHERE users.id = (select auth.uid())
      AND users.role = 'account_manager'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

ALTER POLICY "HR/Admin can view all leave requests" ON public.leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('hr', 'admin')
    )
  );

ALTER POLICY "HR/Admin can manage all leave requests" ON public.leave_requests
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('hr', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = (select auth.uid())
      AND users.role IN ('hr', 'admin')
    )
  );

-- payslips admin policies (wrap auth.uid checks)
ALTER POLICY "HR and Admin can create/update payslips" ON public.payslips
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  );

ALTER POLICY "HR and Admin can update draft payslips" ON public.payslips
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  );

ALTER POLICY "Only Admins can approve payslips" ON public.payslips
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );

-- holidays admin policy
ALTER POLICY "Only Admins can manage holidays" ON public.holidays
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );

-- audit_logs admin policy
ALTER POLICY "Only Admins can view audit logs" ON public.audit_logs
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role = 'admin'
    )
  );

-- weekly_attendance manage policy
ALTER POLICY "HR and Admin can manage attendance" ON public.weekly_attendance
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  );

-- employees manage policy
ALTER POLICY "HR and Admin can manage employees" ON public.employees
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = (select auth.uid()) AND role IN ('admin', 'hr')
    )
  );