-- =====================================================
-- Hard removal of employee_leave_allocations references
-- =====================================================
-- The employee_leave_allocations table/view is deprecated. Clean up any
-- remaining artifacts (tables, views, policies) so the system relies only
-- on employees.* for leave credits.

-- Drop the compatibility view (or table, if recreated elsewhere)
DROP VIEW IF EXISTS public.employee_leave_allocations;
DROP TABLE IF EXISTS public.employee_leave_allocations CASCADE;

-- Drop any lingering policies that may have been recreated
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'employee_leave_allocations'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS employee_leave_allocations_select_public ON public.employee_leave_allocations';
    EXECUTE 'DROP POLICY IF EXISTS employee_leave_allocations_select ON public.employee_leave_allocations';
    EXECUTE 'DROP POLICY IF EXISTS employee_leave_allocations_all_admin_hr ON public.employee_leave_allocations';
  END IF;
END$$;

-- No replacement object is created here. Application logic should read/write
-- leave credits directly on public.employees (e.g., sil_credits).
