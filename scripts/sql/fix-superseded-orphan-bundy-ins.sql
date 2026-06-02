-- =============================================================================
-- Fix superseded orphan Time In punches (double clock-in before Time Out)
-- =============================================================================
-- Problem: Employee taps Time In twice before Time Out (e.g. early-bird ~6:30 then
-- another tap ~7:19). The first IN has no OUT before the second employee IN, so
-- pairing left a phantom "open" session. Early-bird + admin 7 AM pre-open alone is OK.
--
-- Affected pattern (preview in STEP 1): IN → later IN with no OUT between.
--
-- Fix: Insert a corrective OUT 1 minute before the next IN (superseded close).
-- Optional: remove duplicate auto:business-day-close rows (STEP 3).
--
-- Run STEP 1 preview first. Uncomment STEP 2 to apply. Re-run STEP 4 to verify.
--
-- Applied in production 2026-06-02: 9 corrective OUTs inserted; duplicate auto-outs
-- deduped. STEP 4 should return remaining_superseded_orphans = 0.
-- =============================================================================

-- STEP 1 — Preview superseded orphan INs
WITH ins AS (
  SELECT
    i.employee_id,
    i.id AS in_id,
    i.punched_at AS in_at,
    (
      SELECT i2.punched_at
      FROM time_entries i2
      WHERE i2.employee_id = i.employee_id
        AND i2.punch_type = 'in'
        AND i2.punched_at > i.punched_at
      ORDER BY i2.punched_at ASC
      LIMIT 1
    ) AS next_in_at
  FROM time_entries i
  WHERE i.punch_type = 'in'
    AND i.punched_at >= timestamptz '2026-05-15 00:00:00+08'
)
SELECT
  e.employee_id,
  e.full_name,
  ins.in_id,
  ins.in_at AT TIME ZONE 'Asia/Manila' AS orphan_in_manila,
  ins.next_in_at AT TIME ZONE 'Asia/Manila' AS next_in_manila,
  (ins.next_in_at - interval '1 minute') AT TIME ZONE 'Asia/Manila' AS proposed_out_manila
FROM ins
JOIN employees e ON e.id = ins.employee_id
WHERE ins.next_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM time_entries o
    WHERE o.employee_id = ins.employee_id
      AND o.punch_type = 'out'
      AND o.punched_at > ins.in_at
      AND o.punched_at < ins.next_in_at
  )
ORDER BY e.employee_id, ins.in_at;

-- STEP 2 — APPLY: close each superseded orphan IN (1 minute before next IN)
/*
WITH ins AS (
  SELECT
    i.employee_id,
    i.id AS in_id,
    i.punched_at AS in_at,
    (
      SELECT i2.punched_at
      FROM time_entries i2
      WHERE i2.employee_id = i.employee_id
        AND i2.punch_type = 'in'
        AND i2.punched_at > i.punched_at
      ORDER BY i2.punched_at ASC
      LIMIT 1
    ) AS next_in_at
  FROM time_entries i
  WHERE i.punch_type = 'in'
    AND i.punched_at >= timestamptz '2026-05-15 00:00:00+08'
),
to_close AS (
  SELECT employee_id, in_id, in_at, next_in_at - interval '1 minute' AS out_at
  FROM ins
  WHERE next_in_at IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM time_entries o
      WHERE o.employee_id = ins.employee_id
        AND o.punch_type = 'out'
        AND o.punched_at > ins.in_at
        AND o.punched_at < ins.next_in_at
    )
)
INSERT INTO time_entries (
  employee_id,
  punch_type,
  punched_at,
  lat,
  lng,
  source,
  office_location_id,
  device_info
)
SELECT
  tc.employee_id,
  'out',
  tc.out_at,
  14.3421975,
  121.0428414,
  'admin_correction',
  '87d1c9a2-ffe4-4999-a7fb-b6cc24d9082c'::uuid,
  'admin:close superseded orphan IN (early tap before official Time In)'
FROM to_close tc
RETURNING id, employee_id, punched_at;
*/

-- STEP 3 — OPTIONAL: dedupe identical auto clock-outs per employee/timestamp
-- (keeps one row per employee_id + punched_at for auto:business-day-close)
/*
WITH auto_dupes AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY employee_id, punched_at
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM time_entries
  WHERE device_info LIKE 'auto:business-day-close%'
)
DELETE FROM time_entries
WHERE id IN (SELECT id FROM auto_dupes WHERE rn > 1);
*/

-- STEP 4 — Verify: no superseded orphan INs remain
WITH ins AS (
  SELECT
    i.employee_id,
    i.id AS in_id,
    i.punched_at AS in_at,
    (
      SELECT i2.punched_at
      FROM time_entries i2
      WHERE i2.employee_id = i.employee_id
        AND i2.punch_type = 'in'
        AND i2.punched_at > i.punched_at
      ORDER BY i2.punched_at ASC
      LIMIT 1
    ) AS next_in_at
  FROM time_entries i
  WHERE i.punch_type = 'in'
    AND i.punched_at >= timestamptz '2026-05-15 00:00:00+08'
)
SELECT COUNT(*) AS remaining_superseded_orphans
FROM ins
WHERE next_in_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM time_entries o
    WHERE o.employee_id = ins.employee_id
      AND o.punch_type = 'out'
      AND o.punched_at > ins.in_at
      AND o.punched_at < ins.next_in_at
  );
