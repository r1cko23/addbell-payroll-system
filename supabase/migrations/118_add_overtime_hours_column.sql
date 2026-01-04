-- =====================================================
-- 118: Add overtime_hours Column to time_clock_entries
-- =====================================================
-- Add overtime_hours column if it doesn't exist
-- =====================================================

-- Add overtime_hours column if it doesn't exist
ALTER TABLE public.time_clock_entries
  ADD COLUMN IF NOT EXISTS overtime_hours DECIMAL(10, 2) DEFAULT 0;

-- Add comment
COMMENT ON COLUMN public.time_clock_entries.overtime_hours IS
  'Hours worked beyond regular shift (e.g., after 5pm for fixed schedule employees). Calculated automatically by calculate_time_clock_hours() function.';


