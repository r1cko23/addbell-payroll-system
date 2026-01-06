-- =====================================================
-- MIGRATION: Performance Optimization Indexes
-- =====================================================
-- This migration adds optimized indexes for common query patterns
-- to improve database performance across the application.

-- =====================================================
-- 1. TIME CLOCK ENTRIES INDEXES
-- =====================================================
-- Most frequently queried table - needs composite indexes

-- Index for employee + date range queries (used in timesheet/payslips)
CREATE INDEX IF NOT EXISTS idx_time_clock_employee_clock_in
ON public.time_clock_entries (employee_id, clock_in_time DESC);

-- Index for status filtering (clocked_in, approved, etc.)
CREATE INDEX IF NOT EXISTS idx_time_clock_status
ON public.time_clock_entries (status)
WHERE status IN ('clocked_in', 'approved', 'auto_approved');

-- Index for date-based queries (dashboard, reports)
CREATE INDEX IF NOT EXISTS idx_time_clock_clock_in_date
ON public.time_clock_entries (DATE(clock_in_time AT TIME ZONE 'Asia/Manila'));

-- Composite index for common dashboard query pattern
CREATE INDEX IF NOT EXISTS idx_time_clock_status_clock_in
ON public.time_clock_entries (status, clock_in_time DESC)
WHERE clock_out_time IS NULL;

-- =====================================================
-- 2. EMPLOYEES TABLE INDEXES
-- =====================================================

-- Index for active employees (most common filter)
CREATE INDEX IF NOT EXISTS idx_employees_active
ON public.employees (is_active)
WHERE is_active = true;

-- Index for employee_id lookups
CREATE INDEX IF NOT EXISTS idx_employees_employee_id
ON public.employees (employee_id);

-- Composite index for employee list with name sorting
CREATE INDEX IF NOT EXISTS idx_employees_active_name
ON public.employees (is_active, full_name)
WHERE is_active = true;

-- Index for position-based queries (Account Supervisors, etc.)
CREATE INDEX IF NOT EXISTS idx_employees_position
ON public.employees (position)
WHERE position IS NOT NULL;

-- =====================================================
-- 3. LEAVE REQUESTS INDEXES
-- =====================================================

-- Index for pending approvals (dashboard)
CREATE INDEX IF NOT EXISTS idx_leave_requests_status
ON public.leave_requests (status)
WHERE status IN ('pending', 'approved_by_manager');

-- Index for employee + date range queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_dates
ON public.leave_requests (employee_id, start_date, end_date);

-- =====================================================
-- 4. OVERTIME REQUESTS INDEXES
-- =====================================================

-- Index for approved OT (payslip calculations)
CREATE INDEX IF NOT EXISTS idx_overtime_requests_approved
ON public.overtime_requests (employee_id, ot_date)
WHERE status = 'approved';

-- Index for pending OT approvals (dashboard)
CREATE INDEX IF NOT EXISTS idx_overtime_requests_pending
ON public.overtime_requests (status, created_at DESC)
WHERE status = 'pending';

-- =====================================================
-- 5. PAYSLIPS INDEXES
-- =====================================================

-- Index for employee payslip lookups
CREATE INDEX IF NOT EXISTS idx_payslips_employee_period
ON public.payslips (employee_id, period_start DESC);

-- Index for status-based queries
CREATE INDEX IF NOT EXISTS idx_payslips_status
ON public.payslips (status)
WHERE status IN ('draft', 'pending_approval', 'approved');

-- =====================================================
-- 6. WEEKLY ATTENDANCE INDEXES
-- =====================================================

-- Index for employee attendance lookups
CREATE INDEX IF NOT EXISTS idx_weekly_attendance_employee_period
ON public.weekly_attendance (employee_id, period_start DESC);

-- =====================================================
-- 7. EMPLOYEE WEEK SCHEDULES INDEXES
-- =====================================================

-- Index for schedule lookups by date
CREATE INDEX IF NOT EXISTS idx_employee_schedules_date
ON public.employee_week_schedules (employee_id, schedule_date);

-- Index for day off queries
CREATE INDEX IF NOT EXISTS idx_employee_schedules_day_off
ON public.employee_week_schedules (schedule_date, day_off)
WHERE day_off = true;

-- =====================================================
-- 8. HOLIDAYS INDEXES
-- =====================================================

-- Index for holiday lookups by date
CREATE INDEX IF NOT EXISTS idx_holidays_date
ON public.holidays (holiday_date);

-- =====================================================
-- 9. USERS TABLE INDEXES
-- =====================================================

-- Index for active user lookups
CREATE INDEX IF NOT EXISTS idx_users_active
ON public.users (is_active)
WHERE is_active = true;

-- Index for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role
ON public.users (role);

-- =====================================================
-- ANALYZE TABLES
-- =====================================================
-- Update statistics for query planner
ANALYZE public.time_clock_entries;
ANALYZE public.employees;
ANALYZE public.leave_requests;
ANALYZE public.overtime_requests;
ANALYZE public.payslips;
ANALYZE public.weekly_attendance;
ANALYZE public.employee_week_schedules;
ANALYZE public.holidays;
ANALYZE public.users;



