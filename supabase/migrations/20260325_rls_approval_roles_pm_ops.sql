-- Align RLS with approval UIs: project_manager, operations_manager, approver, viewer.
-- - SELECT widened on employees, time_entries, leave_requests, overtime_requests so lists/filters work.
-- - FOR ALL (mutate) on leave/overtime extended to PM/ops/approver for RPC fallback .update() paths.
-- - employees FOR ALL stays hr/admin/upper_management only (no broad employee mutations for approvers).
-- - failure_to_log: add operations_manager where it was missing; keep viewer as read-only on manage policy.

-- ---------------------------------------------------------------------------
-- employees (SELECT only — broader)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "employees_select_own" ON public.employees;
CREATE POLICY "employees_select_own" ON public.employees
  FOR SELECT
  USING (
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
      AND p.role IN (
        'hr', 'admin', 'upper_management',
        'project_manager', 'operations_manager',
        'approver', 'viewer'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- time_entries (SELECT only — approval / attendance visibility)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "time_entries_select_own" ON public.time_entries;
CREATE POLICY "time_entries_select_own" ON public.time_entries
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
        'approver', 'viewer'
      )
    )
  );

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
        'approver'
      )
    )
  );

-- ---------------------------------------------------------------------------
-- failure_to_log (operations_manager + SELECT for ops; RPCs for approve/reject)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "failure_to_log_select_own_or_privileged" ON public.failure_to_log;
CREATE POLICY "failure_to_log_select_own_or_privileged"
ON public.failure_to_log
FOR SELECT
USING (
  employee_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr', 'approver',
        'project_manager', 'operations_manager', 'viewer'
      )
  )
);

DROP POLICY IF EXISTS "failure_to_log_manage_privileged" ON public.failure_to_log;
CREATE POLICY "failure_to_log_manage_privileged"
ON public.failure_to_log
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr', 'approver',
        'project_manager', 'operations_manager'
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr', 'approver',
        'project_manager', 'operations_manager'
      )
  )
);

CREATE OR REPLACE FUNCTION public.approve_failure_to_log(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr', 'approver',
        'project_manager', 'operations_manager'
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to approve failure-to-log requests';
  END IF;

  UPDATE public.failure_to_log
  SET
    status = 'approved',
    approved_by = auth.uid(),
    account_manager_id = auth.uid(),
    approved_at = now(),
    updated_at = now(),
    rejection_reason = NULL
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in pending status';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_failure_to_log(p_request_id uuid, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN (
        'admin', 'upper_management', 'hr', 'approver',
        'project_manager', 'operations_manager'
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized to reject failure-to-log requests';
  END IF;

  UPDATE public.failure_to_log
  SET
    status = 'rejected',
    approved_by = auth.uid(),
    account_manager_id = auth.uid(),
    approved_at = now(),
    updated_at = now(),
    rejection_reason = COALESCE(NULLIF(trim(p_reason), ''), 'Request rejected')
  WHERE id = p_request_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or not in pending status';
  END IF;
END;
$$;
