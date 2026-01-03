-- =====================================================
-- REMOVE OVERTIME FUNCTIONALITY
-- =====================================================
-- This migration removes all overtime-related features
-- since overtime is not part of the business process

-- =====================================================
-- DROP VIEWS
-- =====================================================
DROP VIEW IF EXISTS approved_overtime CASCADE;
DROP VIEW IF EXISTS pending_ot_count CASCADE;

-- =====================================================
-- DROP TRIGGERS
-- =====================================================
DROP TRIGGER IF EXISTS trigger_auto_approve_regular_hours ON public.time_clock_entries;

-- =====================================================
-- DROP FUNCTIONS
-- =====================================================
DROP FUNCTION IF EXISTS auto_approve_regular_hours() CASCADE;

-- =====================================================
-- DROP TABLE
-- =====================================================
DROP TABLE IF EXISTS public.overtime_requests CASCADE;

-- =====================================================
-- UPDATE TIME CLOCK ENTRIES
-- =====================================================
-- Remove overtime_hours column if it exists (keep it but set to 0 always)
-- Actually, we'll keep the column for schema compatibility but ensure it's always 0
-- Update any existing overtime hours to 0
UPDATE public.time_clock_entries
SET overtime_hours = 0
WHERE overtime_hours IS NOT NULL AND overtime_hours > 0;

-- =====================================================
-- UPDATE WEEKLY ATTENDANCE
-- =====================================================
-- Remove overtime hours from weekly attendance
-- Set to 0 if exists
UPDATE public.weekly_attendance
SET total_overtime_hours = 0
WHERE total_overtime_hours IS NOT NULL AND total_overtime_hours > 0;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON COLUMN public.time_clock_entries.overtime_hours IS 'Overtime hours (not used - always 0)';
COMMENT ON COLUMN public.weekly_attendance.total_overtime_hours IS 'Total overtime hours (not used - always 0)';
