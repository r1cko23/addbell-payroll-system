-- =====================================================
-- MIGRATION: Convert Weekly to Bi-Monthly Periods
-- =====================================================
-- Changes:
-- 1. Rename week_start_date/week_end_date to period_start/period_end
-- 2. Update table names and references to reflect bi-monthly periods
-- 3. Add period_type field to distinguish bi-monthly periods

-- =====================================================
-- RENAME COLUMNS IN WEEKLY_ATTENDANCE TABLE
-- =====================================================
ALTER TABLE public.weekly_attendance 
  RENAME COLUMN week_start_date TO period_start;

ALTER TABLE public.weekly_attendance 
  RENAME COLUMN week_end_date TO period_end;

-- Add period_type field
ALTER TABLE public.weekly_attendance
  ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'bimonthly' CHECK (period_type IN ('weekly', 'bimonthly'));

-- Update existing records
UPDATE public.weekly_attendance 
SET period_type = 'bimonthly' 
WHERE period_type IS NULL;

-- =====================================================
-- RENAME COLUMNS IN EMPLOYEE_DEDUCTIONS TABLE
-- =====================================================
ALTER TABLE public.employee_deductions 
  RENAME COLUMN week_start_date TO period_start;

-- Add period_end and period_type fields
ALTER TABLE public.employee_deductions
  ADD COLUMN IF NOT EXISTS period_end DATE;

ALTER TABLE public.employee_deductions
  ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'bimonthly' CHECK (period_type IN ('weekly', 'bimonthly'));

-- Update existing records - set period_end based on period_start + 13 days (2 weeks)
UPDATE public.employee_deductions 
SET period_end = period_start + INTERVAL '13 days',
    period_type = 'bimonthly'
WHERE period_end IS NULL;

-- Update unique constraint
ALTER TABLE public.employee_deductions
  DROP CONSTRAINT IF EXISTS employee_deductions_employee_id_week_start_date_key;

ALTER TABLE public.employee_deductions
  ADD CONSTRAINT employee_deductions_employee_id_period_start_key 
  UNIQUE(employee_id, period_start);

-- =====================================================
-- RENAME COLUMNS IN PAYSLIPS TABLE
-- =====================================================
ALTER TABLE public.payslips 
  RENAME COLUMN week_start_date TO period_start;

ALTER TABLE public.payslips 
  RENAME COLUMN week_end_date TO period_end;

-- Add period_type field
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'bimonthly' CHECK (period_type IN ('weekly', 'bimonthly'));

-- Update existing records
UPDATE public.payslips 
SET period_type = 'bimonthly' 
WHERE period_type IS NULL;

-- =====================================================
-- UPDATE INDEXES
-- =====================================================
DROP INDEX IF EXISTS idx_weekly_attendance_dates;
CREATE INDEX idx_weekly_attendance_dates ON public.weekly_attendance(period_start, period_end);

DROP INDEX IF EXISTS idx_payslips_dates;
CREATE INDEX idx_payslips_dates ON public.payslips(period_start, period_end);

-- =====================================================
-- ADD COMMENTS
-- =====================================================
COMMENT ON COLUMN public.weekly_attendance.period_start IS 'Start date of bi-monthly period (typically Monday)';
COMMENT ON COLUMN public.weekly_attendance.period_end IS 'End date of bi-monthly period (typically Friday, 2 weeks later)';
COMMENT ON COLUMN public.weekly_attendance.period_type IS 'Type of period: weekly or bimonthly';

COMMENT ON COLUMN public.employee_deductions.period_start IS 'Start date of bi-monthly period';
COMMENT ON COLUMN public.employee_deductions.period_end IS 'End date of bi-monthly period';
COMMENT ON COLUMN public.employee_deductions.period_type IS 'Type of period: weekly or bimonthly';

COMMENT ON COLUMN public.payslips.period_start IS 'Start date of bi-monthly period';
COMMENT ON COLUMN public.payslips.period_end IS 'End date of bi-monthly period';
COMMENT ON COLUMN public.payslips.period_type IS 'Type of period: weekly or bimonthly';