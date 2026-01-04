-- =====================================================
-- 124: Add total_night_diff_hours Column to time_clock_entries
-- =====================================================
-- The trigger function calculate_time_clock_hours() tries to set NEW.total_night_diff_hours
-- but the column doesn't exist in the table schema. This migration adds it.
--
-- Error: "record "new" has no field "night_diff_hours""
-- This suggests the trigger is trying to access a column that doesn't exist.
-- Migration 120 sets total_night_diff_hours, but the column was never added.
-- =====================================================

-- Ensure night_diff_hours exists (from migration 005)
-- This column should already exist, but we'll ensure it does
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'time_clock_entries'
    AND column_name = 'night_diff_hours'
  ) THEN
    ALTER TABLE public.time_clock_entries
      ADD COLUMN night_diff_hours DECIMAL(10, 2) DEFAULT 0;
  END IF;
END $$;

-- Add total_night_diff_hours column if it doesn't exist (needed by migration 120+)
ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS total_night_diff_hours DECIMAL(10, 2) DEFAULT 0;

-- Migrate existing night_diff_hours data to total_night_diff_hours if needed
-- (in case there's existing data in night_diff_hours that needs to be preserved)
UPDATE public.time_clock_entries
SET total_night_diff_hours = COALESCE(night_diff_hours, 0)
WHERE total_night_diff_hours = 0 AND night_diff_hours IS NOT NULL;

-- Add comments
COMMENT ON COLUMN public.time_clock_entries.night_diff_hours IS
  'Night differential hours (legacy column from migration 005). Deprecated in favor of total_night_diff_hours.';

COMMENT ON COLUMN public.time_clock_entries.total_night_diff_hours IS
  'Night differential hours calculated from clock times (5PM-6AM). This column is used by the calculate_time_clock_hours() trigger function (migration 120+).';


