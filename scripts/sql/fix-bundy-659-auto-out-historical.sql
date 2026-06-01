-- =============================================================================
-- Fix historical bogus 6:59 auto clock-outs (24h Bundy rollout)
-- =============================================================================
-- Problem: auto:business-day-close@06:59 Manila paired with early IN (~6:30–7:00)
--          produced ~0–1h sessions and 0 BH on timesheet.
--
-- Run in Supabase SQL editor. Preview first, then run the fix block.
-- =============================================================================

-- STEP 1 — Preview auto-outs to delete
SELECT
  e.employee_id AS emp_code,
  e.full_name,
  COUNT(*) AS auto_out_count,
  MIN(te.punched_at AT TIME ZONE 'Asia/Manila') AS first_auto,
  MAX(te.punched_at AT TIME ZONE 'Asia/Manila') AS last_auto
FROM time_entries te
JOIN employees e ON e.id = te.employee_id
WHERE te.device_info LIKE 'auto:business-day-close%'
GROUP BY e.id, e.employee_id, e.full_name
ORDER BY auto_out_count DESC;

-- STEP 2 — Preview broken sessions (IN with only auto OUT within 20h)
WITH auto_outs AS (
  SELECT id, employee_id, punched_at
  FROM time_entries
  WHERE device_info LIKE 'auto:business-day-close%'
)
SELECT
  e.employee_id,
  e.full_name,
  i.punched_at AT TIME ZONE 'Asia/Manila' AS clock_in,
  o.punched_at AT TIME ZONE 'Asia/Manila' AS bogus_out,
  ROUND(EXTRACT(EPOCH FROM (o.punched_at - i.punched_at)) / 3600.0, 2) AS hours
FROM time_entries i
JOIN employees e ON e.id = i.employee_id
JOIN auto_outs o ON o.employee_id = i.employee_id
  AND o.punched_at > i.punched_at
  AND o.punched_at < i.punched_at + interval '20 hours'
WHERE i.punch_type = 'in'
  AND i.id NOT IN (SELECT id FROM auto_outs)
  AND NOT EXISTS (
    SELECT 1 FROM time_entries o2
    WHERE o2.employee_id = i.employee_id
      AND o2.punch_type = 'out'
      AND o2.punched_at > i.punched_at
      AND o2.punched_at < i.punched_at + interval '20 hours'
      AND o2.id NOT IN (SELECT id FROM auto_outs)
  )
ORDER BY clock_in;

-- STEP 3 — APPLY FIX (already run 2026-06-01 in production; keep for re-run safety)
-- Inserts end-of-day OUT for broken pairs, deletes all auto-outs, then closes May orphan INs.
/*
WITH auto_outs AS (
  SELECT id, employee_id, punched_at
  FROM time_entries
  WHERE device_info LIKE 'auto:business-day-close%'
),
broken AS (
  SELECT
    i.employee_id,
    (i.punched_at AT TIME ZONE 'Asia/Manila')::date AS work_date,
    EXTRACT(dow FROM (i.punched_at AT TIME ZONE 'Asia/Manila')::date) AS dow
  FROM time_entries i
  JOIN auto_outs o ON o.employee_id = i.employee_id
    AND o.punched_at > i.punched_at
    AND o.punched_at < i.punched_at + interval '20 hours'
  WHERE i.punch_type = 'in'
    AND i.id NOT IN (SELECT id FROM auto_outs)
    AND NOT EXISTS (
      SELECT 1 FROM time_entries o2
      WHERE o2.employee_id = i.employee_id
        AND o2.punch_type = 'out'
        AND o2.punched_at > i.punched_at
        AND o2.punched_at < i.punched_at + interval '20 hours'
        AND o2.id NOT IN (SELECT id FROM auto_outs)
    )
),
inserted_outs AS (
  INSERT INTO time_entries (employee_id, punch_type, punched_at, lat, lng, source, office_location_id, device_info)
  SELECT
    b.employee_id,
    'out',
    ((b.work_date::timestamp + CASE WHEN b.dow = 5 THEN time '16:03:00' ELSE time '18:03:00' END) AT TIME ZONE 'Asia/Manila'),
    14.3421975,
    121.0428414,
    'admin_correction',
    '87d1c9a2-ffe4-4999-a7fb-b6cc24d9082c'::uuid,
    'admin:replace bogus 6:59 auto-out; corrected end-of-day OUT'
  FROM broken b
  RETURNING id
),
deleted AS (
  DELETE FROM time_entries
  WHERE id IN (SELECT id FROM auto_outs)
  RETURNING id
)
SELECT
  (SELECT COUNT(*) FROM inserted_outs) AS outs_inserted,
  (SELECT COUNT(*) FROM deleted) AS auto_outs_deleted;

-- Orphan INs in May (no OUT within 20h) after auto-out removal
INSERT INTO time_entries (employee_id, punch_type, punched_at, lat, lng, source, office_location_id, device_info)
SELECT
  i.employee_id,
  'out',
  (((i.punched_at AT TIME ZONE 'Asia/Manila')::date::timestamp
    + CASE WHEN EXTRACT(dow FROM (i.punched_at AT TIME ZONE 'Asia/Manila')::date) = 5
           THEN time '16:03:00' ELSE time '18:03:00' END) AT TIME ZONE 'Asia/Manila'),
  14.3421975,
  121.0428414,
  'admin_correction',
  '87d1c9a2-ffe4-4999-a7fb-b6cc24d9082c'::uuid,
  'admin:close orphan IN after 6:59 auto-out cleanup'
FROM time_entries i
WHERE i.punch_type = 'in'
  AND i.punched_at >= timestamptz '2026-05-01 00:00:00+08'
  AND i.punched_at < timestamptz '2026-06-01 00:00:00+08'
  AND NOT EXISTS (
    SELECT 1 FROM time_entries o
    WHERE o.employee_id = i.employee_id
      AND o.punch_type = 'out'
      AND o.punched_at > i.punched_at
      AND o.punched_at < i.punched_at + interval '20 hours'
  );
*/

-- STEP 4 — Verify (expect 0 auto-outs)
SELECT COUNT(*) AS remaining_auto_outs
FROM time_entries
WHERE device_info LIKE 'auto:business-day-close%';
