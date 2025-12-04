-- =====================================================
-- ROLLBACK ALL MIGRATIONS
-- =====================================================
-- This script reverts all migrations in reverse order
-- WARNING: This will delete all data and schema changes!
-- Run this only if you want to completely reset the database
-- =====================================================

-- =====================================================
-- ROLLBACK MIGRATION 017: employee_location_assignments
-- =====================================================
DROP TABLE IF EXISTS public.employee_location_assignments CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 016: add_employee_details
-- =====================================================
ALTER TABLE public.employees
DROP COLUMN IF EXISTS address,
DROP COLUMN IF EXISTS birth_date,
DROP COLUMN IF EXISTS tin_number,
DROP COLUMN IF EXISTS sss_number,
DROP COLUMN IF EXISTS philhealth_number,
DROP COLUMN IF EXISTS pagibig_number,
DROP COLUMN IF EXISTS hmo_provider;

-- =====================================================
-- ROLLBACK MIGRATION 015: employee_location_lock
-- =====================================================
-- Drop the employee-specific location function
DROP FUNCTION IF EXISTS public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 014: employee_profile_function
-- =====================================================
DROP FUNCTION IF EXISTS public.get_employee_profile(UUID) CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 013: update_schema_and_locations
-- =====================================================
-- Restore rate columns and bank account
ALTER TABLE public.employees
ADD COLUMN IF NOT EXISTS rate_per_day DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS rate_per_hour DECIMAL(10, 2),
ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- Remove assigned_hotel column
ALTER TABLE public.employees
DROP COLUMN IF EXISTS assigned_hotel;

-- Clear and restore original location (from migration 010)
DELETE FROM public.office_locations;
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters)
VALUES (
  'Main Office',
  'Makati, Metro Manila, Philippines',
  14.5547,
  121.0244,
  1000
)
ON CONFLICT DO NOTHING;

-- =====================================================
-- ROLLBACK MIGRATION 012: ensure_portal_passwords
-- =====================================================
-- This migration only updated data, no schema changes to rollback

-- =====================================================
-- ROLLBACK MIGRATION 011: bimonthly_periods
-- =====================================================
-- Revert column renames back to weekly naming
ALTER TABLE public.weekly_attendance 
  RENAME COLUMN period_start TO week_start_date;

ALTER TABLE public.weekly_attendance 
  RENAME COLUMN period_end TO week_end_date;

ALTER TABLE public.weekly_attendance
  DROP COLUMN IF EXISTS period_type;

ALTER TABLE public.employee_deductions 
  RENAME COLUMN period_start TO week_start_date;

ALTER TABLE public.employee_deductions
  DROP COLUMN IF EXISTS period_end,
  DROP COLUMN IF EXISTS period_type;

ALTER TABLE public.payslips 
  RENAME COLUMN period_start TO week_start_date;

ALTER TABLE public.payslips 
  RENAME COLUMN period_end TO week_end_date;

ALTER TABLE public.payslips
  DROP COLUMN IF EXISTS period_type;

-- Restore indexes
DROP INDEX IF EXISTS idx_weekly_attendance_dates;
CREATE INDEX idx_weekly_attendance_dates ON public.weekly_attendance(week_start_date, week_end_date);

DROP INDEX IF EXISTS idx_payslips_dates;
CREATE INDEX idx_payslips_dates ON public.payslips(week_start_date, week_end_date);

-- Restore unique constraint
ALTER TABLE public.employee_deductions
  DROP CONSTRAINT IF EXISTS employee_deductions_employee_id_period_start_key;

ALTER TABLE public.employee_deductions
  ADD CONSTRAINT employee_deductions_employee_id_week_start_date_key 
  UNIQUE(employee_id, week_start_date);

-- =====================================================
-- ROLLBACK MIGRATION 010: location_locking
-- =====================================================
-- Drop all location-related functions
DROP FUNCTION IF EXISTS public.is_location_allowed(DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;

-- Drop location table (CASCADE will drop dependent objects like employee_location_assignments)
DROP TABLE IF EXISTS public.office_locations CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 009: employee_auth_function
-- =====================================================
DROP FUNCTION IF EXISTS public.authenticate_employee(TEXT, TEXT) CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 008: add_employee_portal_password
-- =====================================================
DROP INDEX IF EXISTS idx_employees_portal_password;
ALTER TABLE public.employees
DROP COLUMN IF EXISTS portal_password;

-- =====================================================
-- ROLLBACK MIGRATION 007: fix_auto_approve_status
-- =====================================================
-- Migration 007 modified calculate_time_clock_hours function
-- The function will be dropped when rolling back migration 005
-- Just restore the status constraint to remove 'auto_approved'
ALTER TABLE public.time_clock_entries 
  DROP CONSTRAINT IF EXISTS time_clock_entries_status_check;

ALTER TABLE public.time_clock_entries 
  ADD CONSTRAINT time_clock_entries_status_check 
  CHECK (status IN ('clocked_in', 'clocked_out', 'approved', 'rejected'));

-- =====================================================
-- ROLLBACK MIGRATION 006: overtime_requests
-- =====================================================
-- Note: Migration 021 removes overtime, so this is already handled
-- Drop trigger and function created in migration 006
DROP TRIGGER IF EXISTS trigger_auto_approve_regular_hours ON public.time_clock_entries;
DROP FUNCTION IF EXISTS auto_approve_regular_hours() CASCADE;

-- Drop views
DROP VIEW IF EXISTS approved_overtime CASCADE;
DROP VIEW IF EXISTS pending_ot_count CASCADE;

-- Drop table
DROP TABLE IF EXISTS public.overtime_requests CASCADE;

-- Restore original status constraint (remove auto_approved)
ALTER TABLE public.time_clock_entries 
  DROP CONSTRAINT IF EXISTS time_clock_entries_status_check;

ALTER TABLE public.time_clock_entries 
  ADD CONSTRAINT time_clock_entries_status_check 
  CHECK (status IN ('clocked_in', 'clocked_out', 'approved', 'rejected'));

-- =====================================================
-- ROLLBACK MIGRATION 005: time_clock_system
-- =====================================================
-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_calculate_time_clock_hours ON public.time_clock_entries;

-- Drop all time clock functions
DROP FUNCTION IF EXISTS get_employee_clock_status(UUID) CASCADE;
DROP FUNCTION IF EXISTS calculate_time_clock_hours() CASCADE;

-- Drop tables (CASCADE will handle foreign key dependencies)
DROP TABLE IF EXISTS public.employee_schedules CASCADE;
DROP TABLE IF EXISTS public.time_clock_entries CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 004: weekly_deductions
-- =====================================================
-- Restore is_active column
ALTER TABLE public.employee_deductions 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Remove week_start_date
ALTER TABLE public.employee_deductions 
DROP COLUMN IF EXISTS week_start_date;

-- Restore indexes
DROP INDEX IF EXISTS idx_employee_deductions_week;
DROP INDEX IF EXISTS idx_employee_deductions_week_date;
CREATE INDEX IF NOT EXISTS idx_employee_deductions_employee_active 
ON public.employee_deductions(employee_id, is_active);

-- Restore original RLS policies
DROP POLICY IF EXISTS "Users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "HR/Admin can manage deductions" ON public.employee_deductions;

CREATE POLICY "All authenticated users can view deductions" ON public.employee_deductions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage deductions" ON public.employee_deductions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- ROLLBACK MIGRATION 003: add_name_fields
-- =====================================================
DROP INDEX IF EXISTS idx_employees_last_name;
ALTER TABLE public.employees 
DROP COLUMN IF EXISTS last_name,
DROP COLUMN IF EXISTS first_name,
DROP COLUMN IF EXISTS middle_initial;

-- =====================================================
-- ROLLBACK MIGRATION 002: add_bank_account
-- =====================================================
ALTER TABLE public.employees 
DROP COLUMN IF EXISTS bank_account_number;

-- =====================================================
-- ROLLBACK MIGRATION 001: initial_schema
-- =====================================================
-- Drop all triggers first
DROP TRIGGER IF EXISTS update_payslips_updated_at ON public.payslips;
DROP TRIGGER IF EXISTS update_employee_deductions_updated_at ON public.employee_deductions;
DROP TRIGGER IF EXISTS update_weekly_attendance_updated_at ON public.weekly_attendance;
DROP TRIGGER IF EXISTS update_employees_updated_at ON public.employees;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

-- Drop all functions (CASCADE will drop dependent objects)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop all policies
DROP POLICY IF EXISTS "Only Admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Only Admins can manage holidays" ON public.holidays;
DROP POLICY IF EXISTS "All authenticated users can view holidays" ON public.holidays;
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can update draft payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can create/update payslips" ON public.payslips;
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can manage deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "All authenticated users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "HR and Admin can manage attendance" ON public.weekly_attendance;
DROP POLICY IF EXISTS "All authenticated users can view attendance" ON public.weekly_attendance;
DROP POLICY IF EXISTS "HR and Admin can manage employees" ON public.employees;
DROP POLICY IF EXISTS "All authenticated users can view employees" ON public.employees;
DROP POLICY IF EXISTS "Admins can manage users" ON public.users;
DROP POLICY IF EXISTS "Users can view all active users" ON public.users;

-- Drop all tables
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.holidays CASCADE;
DROP TABLE IF EXISTS public.payslips CASCADE;
DROP TABLE IF EXISTS public.employee_deductions CASCADE;
DROP TABLE IF EXISTS public.weekly_attendance CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- Drop extension (CASCADE will drop dependent objects)
DROP EXTENSION IF EXISTS "uuid-ossp" CASCADE;

-- =====================================================
-- ROLLBACK MIGRATION 021: remove_overtime
-- =====================================================
-- Note: This migration removes overtime, so we don't need to rollback it
-- Overtime tables, views, and functions are already dropped above

-- =====================================================
-- FINAL CLEANUP: Drop any remaining functions
-- =====================================================
-- Drop any functions that might have been missed
-- This ensures a complete cleanup
DROP FUNCTION IF EXISTS public.is_location_allowed(DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.calculate_distance(DECIMAL, DECIMAL, DECIMAL, DECIMAL) CASCADE;
DROP FUNCTION IF EXISTS public.is_employee_location_allowed(UUID, DOUBLE PRECISION, DOUBLE PRECISION) CASCADE;
DROP FUNCTION IF EXISTS public.get_employee_profile(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.authenticate_employee(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS calculate_time_clock_hours() CASCADE;
DROP FUNCTION IF EXISTS get_employee_clock_status(UUID) CASCADE;
DROP FUNCTION IF EXISTS auto_approve_regular_hours() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- =====================================================
-- ROLLBACK COMPLETE
-- =====================================================
-- All migrations have been reverted
-- All functions, triggers, views, tables, and policies have been dropped
-- The database is now in its original state (empty)
-- =====================================================

