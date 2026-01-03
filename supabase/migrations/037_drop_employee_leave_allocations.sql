-- =====================================================
-- Drop employee_leave_allocations and related policies
-- =====================================================
DROP POLICY IF EXISTS employee_leave_allocations_select_public ON public.employee_leave_allocations;
DROP POLICY IF EXISTS employee_leave_allocations_select ON public.employee_leave_allocations;
DROP POLICY IF EXISTS employee_leave_allocations_all_admin_hr ON public.employee_leave_allocations;
DROP TABLE IF EXISTS public.employee_leave_allocations CASCADE;