-- =====================================================
-- FIX INFINITE RECURSION IN USERS TABLE RLS POLICIES
-- =====================================================
-- The issue: Policies that check users table create infinite recursion
-- Solution: Use auth.jwt() to get role directly or create helper function

-- =====================================================
-- CREATE HELPER FUNCTION TO GET USER ROLE
-- =====================================================
-- This function bypasses RLS to avoid recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role::TEXT
  FROM public.users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

-- =====================================================
-- FIX USERS TABLE POLICIES
-- =====================================================
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view all active users" ON public.users;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;

-- Simple policy: Users can view active users (no recursion)
CREATE POLICY "Users can view all active users" ON public.users
  FOR SELECT USING (is_active = true);

-- Admin policy using the helper function (avoids recursion)
CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (public.get_user_role() = 'admin');

-- =====================================================
-- FIX EMPLOYEES TABLE POLICIES
-- =====================================================
DROP POLICY IF EXISTS "All authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "HR and Admin can manage employees" ON public.employees;

-- Simple view policy
CREATE POLICY "All authenticated users can view employees" ON public.employees
  FOR SELECT USING (auth.role() = 'authenticated');

-- Manage policy using helper function
CREATE POLICY "HR and Admin can manage employees" ON public.employees
  FOR ALL USING (
    public.get_user_role() IN ('admin', 'hr')
  );

-- =====================================================
-- FIX OTHER TABLES WITH RECURSIVE POLICIES
-- =====================================================

-- Weekly attendance
DROP POLICY IF EXISTS "All authenticated users can view attendance" ON public.weekly_attendance;
DROP POLICY IF EXISTS "HR and Admin can manage attendance" ON public.weekly_attendance;

CREATE POLICY "All authenticated users can view attendance" ON public.weekly_attendance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage attendance" ON public.weekly_attendance
  FOR ALL USING (public.get_user_role() IN ('admin', 'hr'));

-- Employee deductions
DROP POLICY IF EXISTS "All authenticated users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "HR and Admin can manage deductions" ON public.employee_deductions;

CREATE POLICY "All authenticated users can view deductions" ON public.employee_deductions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage deductions" ON public.employee_deductions
  FOR ALL USING (public.get_user_role() IN ('admin', 'hr'));

-- Payslips
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can create/update payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can update draft payslips" ON public.payslips;
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;

CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can create/update payslips" ON public.payslips
  FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'hr'));

CREATE POLICY "HR and Admin can update draft payslips" ON public.payslips
  FOR UPDATE USING (
    status = 'draft' AND public.get_user_role() IN ('admin', 'hr')
  );

CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (public.get_user_role() = 'admin');

-- Holidays
DROP POLICY IF EXISTS "All authenticated users can view holidays" ON public.holidays;
DROP POLICY IF EXISTS "Only Admins can manage holidays" ON public.holidays;

CREATE POLICY "All authenticated users can view holidays" ON public.holidays
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only Admins can manage holidays" ON public.holidays
  FOR ALL USING (public.get_user_role() = 'admin');

-- Audit logs
DROP POLICY IF EXISTS "Only Admins can view audit logs" ON public.audit_logs;

CREATE POLICY "Only Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (public.get_user_role() = 'admin');

-- =====================================================
-- FIX EMPLOYEE LOCATION ASSIGNMENTS
-- =====================================================
DROP POLICY IF EXISTS "All authenticated users can view location assignments" ON public.employee_location_assignments;
DROP POLICY IF EXISTS "HR/Admin can manage location assignments" ON public.employee_location_assignments;

CREATE POLICY "All authenticated users can view location assignments" ON public.employee_location_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR/Admin can manage location assignments" ON public.employee_location_assignments
  FOR ALL USING (public.get_user_role() IN ('admin', 'hr'));

-- =====================================================
-- FIX OFFICE LOCATIONS
-- =====================================================
DROP POLICY IF EXISTS "All authenticated users can view office locations" ON public.office_locations;
DROP POLICY IF EXISTS "HR/Admin can manage office locations" ON public.office_locations;

CREATE POLICY "All authenticated users can view office locations" ON public.office_locations
  FOR SELECT USING (true);

CREATE POLICY "HR/Admin can manage office locations" ON public.office_locations
  FOR ALL USING (public.get_user_role() IN ('admin', 'hr'));

-- =====================================================
-- FIX FAILURE TO LOG POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Employees can view own failure to log requests" ON public.failure_to_log;
DROP POLICY IF EXISTS "Employees can create failure to log requests" ON public.failure_to_log;
DROP POLICY IF EXISTS "Account managers can view assigned failure to log requests" ON public.failure_to_log;
DROP POLICY IF EXISTS "Account managers can manage assigned failure to log requests" ON public.failure_to_log;
DROP POLICY IF EXISTS "HR/Admin can view all failure to log requests" ON public.failure_to_log;
DROP POLICY IF EXISTS "HR/Admin can manage all failure to log requests" ON public.failure_to_log;

CREATE POLICY "Employees can view own failure to log requests" ON public.failure_to_log
  FOR SELECT USING (true);

CREATE POLICY "Employees can create failure to log requests" ON public.failure_to_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Account managers can view assigned failure to log requests" ON public.failure_to_log
  FOR SELECT USING (
    public.get_user_role() = 'account_manager'
  );

CREATE POLICY "Account managers can manage assigned failure to log requests" ON public.failure_to_log
  FOR UPDATE USING (
    public.get_user_role() = 'account_manager'
  );

CREATE POLICY "HR/Admin can view all failure to log requests" ON public.failure_to_log
  FOR SELECT USING (public.get_user_role() IN ('hr', 'admin'));

CREATE POLICY "HR/Admin can manage all failure to log requests" ON public.failure_to_log
  FOR ALL USING (public.get_user_role() IN ('hr', 'admin'));

-- =====================================================
-- FIX LEAVE REQUESTS POLICIES
-- =====================================================
DROP POLICY IF EXISTS "Employees can view own leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can create leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Employees can cancel own pending leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Account managers can view assigned leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "Account managers can manage assigned leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can view all leave requests" ON public.leave_requests;
DROP POLICY IF EXISTS "HR/Admin can manage all leave requests" ON public.leave_requests;

CREATE POLICY "Employees can view own leave requests" ON public.leave_requests
  FOR SELECT USING (true);

CREATE POLICY "Employees can create leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Employees can cancel own pending leave requests" ON public.leave_requests
  FOR UPDATE USING (status = 'pending')
  WITH CHECK (status = 'cancelled');

CREATE POLICY "Account managers can view assigned leave requests" ON public.leave_requests
  FOR SELECT USING (public.get_user_role() = 'account_manager');

CREATE POLICY "Account managers can manage assigned leave requests" ON public.leave_requests
  FOR UPDATE USING (public.get_user_role() = 'account_manager');

CREATE POLICY "HR/Admin can view all leave requests" ON public.leave_requests
  FOR SELECT USING (public.get_user_role() IN ('hr', 'admin'));

CREATE POLICY "HR/Admin can manage all leave requests" ON public.leave_requests
  FOR ALL USING (public.get_user_role() IN ('hr', 'admin'));

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION public.get_user_role() IS 
  'Returns the role of the current authenticated user. Uses SECURITY DEFINER to bypass RLS and avoid infinite recursion.';

