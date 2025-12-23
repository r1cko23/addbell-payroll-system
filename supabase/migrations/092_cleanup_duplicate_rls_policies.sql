-- =====================================================
-- 092: Cleanup Duplicate RLS Policies
-- =====================================================
-- Remove duplicate/conflicting policies that may cause 400 errors
-- Keep only the essential policies
-- =====================================================

-- =====================================================
-- CLEANUP TIME_CLOCK_ENTRIES POLICIES
-- =====================================================
-- Drop all existing policies
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "Admin/HR can manage time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "Account managers can view time clock entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "Account managers can manage time clock entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_all_admin_hr" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_all_admin_hr_am" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_all_public" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_delete_admin_hr" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_insert_admin_hr" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_insert_auth" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_manage_authenticated" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_select" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_update_admin_hr" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_update_auth" ON public.time_clock_entries;
DROP POLICY IF EXISTS "time_clock_entries_update_authenticated" ON public.time_clock_entries;

-- Create clean, single policies
CREATE POLICY "Authenticated users can view time entries" ON public.time_clock_entries
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

CREATE POLICY "Admin/HR can manage time entries" ON public.time_clock_entries
  FOR ALL USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- =====================================================
-- CLEANUP EMPLOYEE_DEDUCTIONS POLICIES
-- =====================================================
-- Drop all existing policies
DROP POLICY IF EXISTS "All authenticated users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "Admin/HR can manage deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "employee_deductions_all_admin_hr" ON public.employee_deductions;
DROP POLICY IF EXISTS "employee_deductions_delete_admin_hr" ON public.employee_deductions;
DROP POLICY IF EXISTS "employee_deductions_insert_admin_hr" ON public.employee_deductions;
DROP POLICY IF EXISTS "employee_deductions_select" ON public.employee_deductions;
DROP POLICY IF EXISTS "employee_deductions_update_admin_hr" ON public.employee_deductions;

-- Create clean, single policies
CREATE POLICY "All authenticated users can view deductions" ON public.employee_deductions
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

CREATE POLICY "Admin/HR can manage deductions" ON public.employee_deductions
  FOR ALL USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );






