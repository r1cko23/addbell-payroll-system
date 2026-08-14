-- Purchasing officers are first-approvers for OT-group leave / OT / FTL queues
-- (same as operations_manager in the app). After Phen Conte was moved to
-- purchasing_officer, RLS still omitted that role so her group requests were
-- invisible on Leave Approvals / OT Approvals even when she is overtime_groups.approver_id.

-- ---------------------------------------------------------------------------
-- leave_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "leave_requests_select_own" ON public.leave_requests;
CREATE POLICY "leave_requests_select_own" ON public.leave_requests
  FOR SELECT
  USING (
    employee_id = auth.uid()
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

DROP POLICY IF EXISTS "leave_requests_update_delete_hr_admin" ON public.leave_requests;
CREATE POLICY "leave_requests_update_delete_hr_admin" ON public.leave_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'hr', 'admin', 'upper_management',
        'project_manager', 'operations_manager',
        'purchasing_officer',
        'approver'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'hr', 'admin', 'upper_management',
        'project_manager', 'operations_manager',
        'purchasing_officer',
        'approver'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- overtime_requests
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "overtime_requests_select_own" ON public.overtime_requests;
CREATE POLICY "overtime_requests_select_own" ON public.overtime_requests
  FOR SELECT
  USING (
    employee_id = auth.uid()
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

DROP POLICY IF EXISTS "overtime_requests_all_hr_admin" ON public.overtime_requests;
CREATE POLICY "overtime_requests_all_hr_admin" ON public.overtime_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'hr', 'admin', 'upper_management',
        'project_manager', 'operations_manager',
        'purchasing_officer',
        'approver'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'hr', 'admin', 'upper_management',
        'project_manager', 'operations_manager',
        'purchasing_officer',
        'approver'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- failure_to_log
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "failure_to_log_select_own_or_privileged" ON public.failure_to_log;
CREATE POLICY "failure_to_log_select_own_or_privileged" ON public.failure_to_log
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr',
        'approver', 'project_manager', 'operations_manager',
        'purchasing_officer',
        'viewer'
      )
    )
  );

DROP POLICY IF EXISTS "failure_to_log_manage_privileged" ON public.failure_to_log;
CREATE POLICY "failure_to_log_manage_privileged" ON public.failure_to_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr',
        'approver', 'project_manager', 'operations_manager',
        'purchasing_officer'
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr',
        'approver', 'project_manager', 'operations_manager',
        'purchasing_officer'
      )
    )
  );
