-- CARIZZA CONTE LEONARDO (2024-008) — May 21, 2026
-- Why no INC: she has Time In + Time Out on that day (6:52 AM – 10:12 PM), so not incomplete.
-- Why May 21 may show OT + UT 10 instead of 10 BH:
--   Time In at 6:52 AM is treated as previous business day; that long pair is often
--   dropped as a duplicate of May 20’s official session, so the May 21 *calendar*
--   row can have no official BH (only approved OT + undertime).
--
-- This adds a clean official pair: 7:00 AM – 6:00 PM Manila (10h Mon–Thu windows).
-- Review STEP 1 first. Run STEP 2 only if you agree.

-- STEP 1 — Current punches (May 20–22)
SELECT
  te.id,
  te.punch_type,
  te.punched_at AT TIME ZONE 'Asia/Manila' AS manila,
  te.device_info
FROM time_entries te
WHERE te.employee_id = 'e8b3aa76-725d-4625-a2e5-860277276cef'
  AND te.punched_at >= timestamptz '2026-05-20 00:00:00+08'
  AND te.punched_at <  timestamptz '2026-05-23 00:00:00+08'
ORDER BY te.punched_at;

-- STEP 2 — Insert 10-hour May 21 session (7:00 AM – 6:00 PM Manila)
-- BEGIN;
--
-- INSERT INTO time_entries (employee_id, punch_type, punched_at, device_info, source)
-- VALUES
--   (
--     'e8b3aa76-725d-4625-a2e5-860277276cef',
--     'in',
--     timestamptz '2026-05-21 07:00:00+08',
--     'manual:hr-correction@10h-May21-2026',
--     'web'
--   ),
--   (
--     'e8b3aa76-725d-4625-a2e5-860277276cef',
--     'out',
--     timestamptz '2026-05-21 18:00:00+08',
--     'manual:hr-correction@10h-May21-2026',
--     'web'
--   );
--
-- COMMIT;

-- STEP 3 — Verify (expect new in/out; refresh Time Attendance)
SELECT
  te.id,
  te.punch_type,
  te.punched_at AT TIME ZONE 'Asia/Manila' AS manila,
  te.device_info
FROM time_entries te
WHERE te.employee_id = 'e8b3aa76-725d-4625-a2e5-860277276cef'
  AND (te.punched_at AT TIME ZONE 'Asia/Manila')::date = '2026-05-21'
ORDER BY te.punched_at;
