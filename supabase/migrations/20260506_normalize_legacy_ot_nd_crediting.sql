-- One-time data cleanup: normalize legacy OT + ND hours to new crediting rules.
--
-- Rules:
-- - OT: minimum 1.0 hour, then 0.5-hour increments (floored)
-- - ND: minimum 0.5 hour, then 0.5-hour increments (floored)
--
-- This migration updates stored values so older records match current payroll logic.

-- 1) overtime_requests.total_hours (source of truth for OT)
UPDATE public.overtime_requests
SET total_hours =
  CASE
    WHEN total_hours IS NULL THEN NULL
    WHEN total_hours < 1 THEN 0
    ELSE floor(total_hours * 2) / 2
  END,
  updated_at = now()
WHERE total_hours IS NOT NULL;

-- 2) time_clock_entries.overtime_hours + total_night_diff_hours (stored summaries; keep consistent)
UPDATE public.time_clock_entries
SET overtime_hours =
    CASE
      WHEN overtime_hours IS NULL THEN NULL
      WHEN overtime_hours < 1 THEN 0
      ELSE floor(overtime_hours * 2) / 2
    END,
    total_night_diff_hours =
    CASE
      WHEN total_night_diff_hours IS NULL THEN NULL
      WHEN total_night_diff_hours < 0.5 THEN 0
      ELSE floor(total_night_diff_hours * 2) / 2
    END,
    updated_at = now()
WHERE overtime_hours IS NOT NULL
   OR total_night_diff_hours IS NOT NULL;

-- 3) weekly_attendance totals (used for reporting/statutory previews)
UPDATE public.weekly_attendance
SET total_overtime_hours =
    CASE
      WHEN total_overtime_hours IS NULL THEN total_overtime_hours
      WHEN total_overtime_hours < 1 THEN 0
      ELSE floor(total_overtime_hours * 2) / 2
    END,
    total_night_diff_hours =
    CASE
      WHEN total_night_diff_hours IS NULL THEN total_night_diff_hours
      WHEN total_night_diff_hours < 0.5 THEN 0
      ELSE floor(total_night_diff_hours * 2) / 2
    END,
    updated_at = now();

