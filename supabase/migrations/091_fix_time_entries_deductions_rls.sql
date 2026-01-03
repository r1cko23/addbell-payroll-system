-- =====================================================
-- 091: Fix Time Clock Entries and Employee Deductions RLS
-- =====================================================
-- Ensure admin/HR can access time_clock_entries and employee_deductions
-- Fix 400 errors on payslips page
-- =====================================================

-- =====================================================
-- TIME CLOCK ENTRIES RLS POLICIES
-- =====================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "HR/Admin can view all time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "Employees can view own time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "HR/Admin can manage time entries" ON public.time_clock_entries;

-- All authenticated users can view time entries
CREATE POLICY "Authenticated users can view time entries" ON public.time_clock_entries
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

-- Admin/HR can manage time entries
CREATE POLICY "Admin/HR can manage time entries" ON public.time_clock_entries
  FOR ALL USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- =====================================================
-- EMPLOYEE DEDUCTIONS RLS POLICIES
-- =====================================================
-- Drop existing policies
DROP POLICY IF EXISTS "All authenticated users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "HR and Admin can manage deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "Users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "HR/Admin can manage deductions" ON public.employee_deductions;

-- All authenticated users can view deductions
CREATE POLICY "All authenticated users can view deductions" ON public.employee_deductions
  FOR SELECT USING (
    (SELECT auth.role()) = 'authenticated'
  );

-- Admin/HR can manage deductions
CREATE POLICY "Admin/HR can manage deductions" ON public.employee_deductions
  FOR ALL USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );








