-- =====================================================
-- MIGRATION: Fix RLS for Time Attendance Report
-- =====================================================
-- Ensure admin/HR can view time_clock_entries, schedules, leave requests, and OT requests

-- Ensure time_clock_entries allows SELECT for authenticated users
DROP POLICY IF EXISTS "Employees can view own time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "HR/Admin can view all time entries" ON public.time_clock_entries;
DROP POLICY IF EXISTS "Authenticated users can view time entries" ON public.time_clock_entries;

CREATE POLICY "Authenticated users can view time entries" ON public.time_clock_entries
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- Ensure employee_week_schedules allows SELECT (should already exist from migration 058)
-- But let's make sure it's there
DROP POLICY IF EXISTS "Anyone can select schedules" ON public.employee_week_schedules;
CREATE POLICY "Anyone can select schedules" ON public.employee_week_schedules
  FOR SELECT USING (true);

-- Ensure employee_schedules allows SELECT for authenticated users
DROP POLICY IF EXISTS "HR/Admin can manage schedules" ON public.employee_schedules;
DROP POLICY IF EXISTS "Authenticated users can view schedules" ON public.employee_schedules;
CREATE POLICY "Authenticated users can view schedules" ON public.employee_schedules
  FOR SELECT USING ((select auth.role()) = 'authenticated');

-- Ensure leave_requests allows SELECT for authenticated users (for LWOP, LEAVE, CTO, OB status)
-- Check existing policies first
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'leave_requests' 
    AND policyname = 'Authenticated users can view leave requests'
  ) THEN
    CREATE POLICY "Authenticated users can view leave requests" ON public.leave_requests
      FOR SELECT USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;

-- Ensure overtime_requests allows SELECT for authenticated users (for OT status)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'overtime_requests' 
    AND policyname = 'Authenticated users can view OT requests'
  ) THEN
    CREATE POLICY "Authenticated users can view OT requests" ON public.overtime_requests
      FOR SELECT USING ((select auth.role()) = 'authenticated');
  END IF;
END $$;