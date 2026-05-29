-- =============================================================================
-- TEMPORARY fix: May 20–26, 2026 cutoff (time_entries only)
-- =============================================================================
--
-- Background
--   Early clock-in (before 7:00 AM) was assigned to the previous business day.
--   Auto clock-out at 06:59 Manila then closed the session in ~30 minutes.
--   Time Attendance showed ABSENT / wrong UT on days like May 22.
--
-- How payroll works in this app (no weekly_attendance required)
--   time_entries  →  Time Attendance page (live sessions)
--                 →  Payslips preview (regenerated from same punches + OT + FTL)
--                 →  payslips table when you Save / batch payroll run
--
-- What this script does
--   1) Preview bogus auto clock-out punches
--   2) Preview short broken sessions (likely from the bug)
--   3) DELETE those auto-outs (run only after review)
--   4) Verify
--
-- What this script does NOT do
--   It does not force 48 / 40 / 45 regular hours. After cleanup, open Time
--   Attendance and Payslips — hours come from real punches (+ approved FTL/OT).
--   For missing days, use Failure to Log or manual correction, then regenerate payslips.
--
-- Deploy the app bundy fix so new early clock-ins are not auto-closed at 6:59 AM.
-- =============================================================================

-- =============================================================================
-- STEP 1 — Preview: auto clock-out punches to remove
-- =============================================================================
SELECT
  te.id AS punch_id,
  e.employee_id AS emp_code,
  e.full_name,
  te.punch_type,
  te.punched_at AT TIME ZONE 'Asia/Manila' AS punched_at_manila,
  te.device_info
FROM time_entries te
JOIN employees e ON e.id = te.employee_id
WHERE te.device_info LIKE 'auto:business-day-close%'
  AND te.punched_at >= timestamptz '2026-05-20 00:00:00+08'
  AND te.punched_at <  timestamptz '2026-05-27 00:00:00+08'
ORDER BY te.punched_at, e.full_name;

-- =============================================================================
-- STEP 2 — Preview: short same-morning sessions (in before 7 AM, out ~6:59)
--         These often become “no official log” for that calendar day → ABSENT.
-- =============================================================================
WITH punches AS (
  SELECT
    te.id,
    te.employee_id,
    te.punch_type,
    te.punched_at,
    te.device_info
  FROM time_entries te
  WHERE te.punched_at >= timestamptz '2026-05-19 00:00:00+08'
    AND te.punched_at <  timestamptz '2026-05-27 12:00:00+08'
),
paired AS (
  SELECT
    i.employee_id,
    i.id AS in_id,
    o.id AS out_id,
    i.punched_at AS clock_in,
    o.punched_at AS clock_out,
    o.device_info AS out_device,
    EXTRACT(EPOCH FROM (o.punched_at - i.punched_at)) / 3600.0 AS hours
  FROM punches i
  JOIN LATERAL (
    SELECT o2.*
    FROM punches o2
    WHERE o2.employee_id = i.employee_id
      AND o2.punch_type = 'out'
      AND o2.punched_at > i.punched_at
    ORDER BY o2.punched_at
    LIMIT 1
  ) o ON true
  WHERE i.punch_type = 'in'
)
SELECT
  e.employee_id AS emp_code,
  e.full_name,
  p.clock_in AT TIME ZONE 'Asia/Manila' AS time_in_manila,
  p.clock_out AT TIME ZONE 'Asia/Manila' AS time_out_manila,
  round(p.hours::numeric, 2) AS session_hours,
  p.out_device,
  p.in_id,
  p.out_id
FROM paired p
JOIN employees e ON e.id = p.employee_id
WHERE p.hours > 0
  AND p.hours < 1
  AND (p.clock_in AT TIME ZONE 'Asia/Manila')::date BETWEEN '2026-05-20' AND '2026-05-26'
ORDER BY p.clock_in, e.full_name;

-- =============================================================================
-- STEP 3 — Preview: employees with NO complete session on May 22 (example)
--         Adjust the date if checking another day.
-- =============================================================================
WITH day_range AS (
  SELECT d::date AS work_date
  FROM generate_series('2026-05-20'::date, '2026-05-26'::date, '1 day') AS d
),
sessions AS (
  SELECT
    te.employee_id,
    (te.punched_at AT TIME ZONE 'Asia/Manila')::date AS punch_date,
    te.punch_type,
    te.punched_at
  FROM time_entries te
  WHERE te.punched_at >= timestamptz '2026-05-20 00:00:00+08'
    AND te.punched_at <  timestamptz '2026-05-27 00:00:00+08'
),
complete_days AS (
  SELECT DISTINCT
    i.employee_id,
    (i.punched_at AT TIME ZONE 'Asia/Manila')::date AS work_date
  FROM time_entries i
  JOIN time_entries o
    ON o.employee_id = i.employee_id
   AND o.punch_type = 'out'
   AND o.punched_at > i.punched_at
  WHERE i.punch_type = 'in'
    AND i.punched_at >= timestamptz '2026-05-20 00:00:00+08'
    AND i.punched_at <  timestamptz '2026-05-27 00:00:00+08'
    AND (i.punched_at AT TIME ZONE 'Asia/Manila')::date =
        (o.punched_at AT TIME ZONE 'Asia/Manila')::date
)
SELECT
  e.employee_id AS emp_code,
  e.full_name,
  dr.work_date,
  CASE WHEN cd.work_date IS NULL THEN 'no complete log' ELSE 'has log' END AS status
FROM employees e
CROSS JOIN day_range dr
LEFT JOIN complete_days cd
  ON cd.employee_id = e.id AND cd.work_date = dr.work_date
WHERE e.is_active = true
  AND dr.work_date = '2026-05-22'
  AND cd.work_date IS NULL
ORDER BY e.full_name;

-- =============================================================================
-- STEP 4 — DELETE bogus auto clock-outs (run only after STEP 1 looks correct)
-- =============================================================================
BEGIN;

DELETE FROM time_entries te
WHERE te.device_info LIKE 'auto:business-day-close%'
  AND te.punched_at >= timestamptz '2026-05-20 00:00:00+08'
  AND te.punched_at <  timestamptz '2026-05-27 00:00:00+08';

COMMIT;

-- =============================================================================
-- STEP 5 — Verify: no auto-outs left in cutoff
-- =============================================================================
SELECT count(*) AS remaining_auto_outs
FROM time_entries te
WHERE te.device_info LIKE 'auto:business-day-close%'
  AND te.punched_at >= timestamptz '2026-05-20 00:00:00+08'
  AND te.punched_at <  timestamptz '2026-05-27 00:00:00+08';

-- =============================================================================
-- After running STEP 4
-- =============================================================================
-- 1. Refresh Time Attendance for May 20–26 — grid should match punches.
-- 2. Regenerate or re-save payslips for that week (preview uses same punches).
-- 3. Deploy the bundy early clock-in code fix so the bug does not repeat.
--
-- Admin hour targets (48 / Jhun Conte 40 / Cayabat 2025-011 45):
--   Not stored in time_entries. After cleanup, use approved FTL for missing days
--   or adjust individual payslips if policy requires fixed hours regardless of punches.
