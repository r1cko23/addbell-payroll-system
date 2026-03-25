-- Restore failure_to_log workflow table + approval RPCs
-- Aligns with current app usage in:
-- - app/employee-portal/failure-to-log/page.tsx
-- - app/failure-to-log-approval/page.tsx

CREATE TABLE IF NOT EXISTS public.failure_to_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  time_entry_id uuid NULL REFERENCES public.time_entries(id) ON DELETE SET NULL,
  missed_date date NULL,
  actual_clock_in_time timestamptz NULL,
  actual_clock_out_time timestamptz NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('in', 'out', 'both')),
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  rejection_reason text NULL,
  account_manager_id uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_by uuid NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_failure_to_log_employee_id
  ON public.failure_to_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_failure_to_log_status
  ON public.failure_to_log(status);
CREATE INDEX IF NOT EXISTS idx_failure_to_log_missed_date
  ON public.failure_to_log(missed_date);

ALTER TABLE public.failure_to_log ENABLE ROW LEVEL SECURITY;

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
      AND p.role IN ('admin', 'upper_management', 'hr', 'approver', 'project_manager', 'viewer')
  )
);

DROP POLICY IF EXISTS "failure_to_log_insert_own" ON public.failure_to_log;
CREATE POLICY "failure_to_log_insert_own"
ON public.failure_to_log
FOR INSERT
WITH CHECK (
  employee_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'upper_management', 'hr')
  )
);

DROP POLICY IF EXISTS "failure_to_log_cancel_own_pending" ON public.failure_to_log;
CREATE POLICY "failure_to_log_cancel_own_pending"
ON public.failure_to_log
FOR UPDATE
USING (
  employee_id = auth.uid() AND status = 'pending'
)
WITH CHECK (
  employee_id = auth.uid() AND status = 'cancelled'
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
      AND p.role IN ('admin', 'upper_management', 'hr', 'approver', 'project_manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('admin', 'upper_management', 'hr', 'approver', 'project_manager')
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
      AND p.role IN ('admin', 'upper_management', 'hr', 'approver', 'project_manager')
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
      AND p.role IN ('admin', 'upper_management', 'hr', 'approver', 'project_manager')
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

GRANT EXECUTE ON FUNCTION public.approve_failure_to_log(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_failure_to_log(uuid, text) TO authenticated;

