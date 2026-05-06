-- One-time data cleanup: normalize legacy OT + ND hours to new crediting rules.
--
-- Rules:
-- - OT: minimum 1.0 hour, then 0.5-hour increments (floored)
-- - ND: minimum 0.5 hour, then 0.5-hour increments (floored)
--
-- This migration updates stored values so older records match current payroll logic.

-- 1) overtime_requests.total_hours (source of truth for OT)
DO $$
BEGIN
  IF to_regclass('public.overtime_requests') IS NOT NULL THEN
    UPDATE public.overtime_requests
    SET total_hours =
      CASE
        WHEN total_hours IS NULL THEN NULL
        WHEN total_hours < 1 THEN 0
        ELSE floor(total_hours * 2) / 2
      END,
      updated_at = now()
    WHERE total_hours IS NOT NULL;
  END IF;
END $$;

-- 2) attendance_records.overtime_hours + night_diff_hours (stored rollups; keep consistent)
DO $$
BEGIN
  IF to_regclass('public.attendance_records') IS NOT NULL THEN
    UPDATE public.attendance_records
    SET overtime_hours =
        CASE
          WHEN overtime_hours IS NULL THEN NULL
          WHEN overtime_hours < 1 THEN 0
          ELSE floor(overtime_hours * 2) / 2
        END,
        night_diff_hours =
        CASE
          WHEN night_diff_hours IS NULL THEN NULL
          WHEN night_diff_hours < 0.5 THEN 0
          ELSE floor(night_diff_hours * 2) / 2
        END,
        updated_at = now()
    WHERE overtime_hours IS NOT NULL
       OR night_diff_hours IS NOT NULL;
  END IF;
END $$;

-- 3) weekly_attendance totals (used for reporting/statutory previews)
DO $$
BEGIN
  -- Some environments don't have weekly_attendance; don't fail the whole migration.
  IF to_regclass('public.weekly_attendance') IS NOT NULL THEN
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
  END IF;
END $$;

-- 4) project_time_entries rollups (if used for payroll/costing displays)
DO $$
BEGIN
  IF to_regclass('public.project_time_entries') IS NOT NULL THEN
    UPDATE public.project_time_entries
    SET overtime_hours =
        CASE
          WHEN overtime_hours IS NULL THEN overtime_hours
          WHEN overtime_hours < 1 THEN 0
          ELSE floor(overtime_hours * 2) / 2
        END,
        night_diff_hours =
        CASE
          WHEN night_diff_hours IS NULL THEN night_diff_hours
          WHEN night_diff_hours < 0.5 THEN 0
          ELSE floor(night_diff_hours * 2) / 2
        END,
        updated_at = now();
  END IF;
END $$;

