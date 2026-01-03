-- =====================================================
-- Allow public/anon SELECT for employee_leave_allocations
-- =====================================================
-- Employee portal runs without Supabase Auth token. Mirror the pattern
-- we used for failure_to_log: permit read access so credits appear.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_leave_allocations'
      AND policyname = 'employee_leave_allocations_select_public'
  ) THEN
    DROP POLICY "employee_leave_allocations_select_public" ON public.employee_leave_allocations;
  END IF;
END$$;

CREATE POLICY "employee_leave_allocations_select_public"
ON public.employee_leave_allocations
FOR SELECT
USING (true);