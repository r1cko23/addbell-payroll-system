-- =============================================================================
-- Bulk 7:00 AM Manila clock-IN (admin_correction) — standard payroll cohort
-- =============================================================================
--
-- Run STEP 1 (preview), then STEP 2 (insert) as separate queries in Supabase.
-- Change the date in both steps: timestamptz 'YYYY-MM-DD 07:00:00+08'
-- =============================================================================

-- STEP 1 — Preview
WITH cohort AS (
  SELECT e.id, e.employee_id, e.full_name
  FROM employees e
  WHERE e.id IN (
    '1089f0a0-ea93-4908-9670-c16eaf04bf85', -- Joseph Cabigas
    '20ea5cf9-79dd-4803-bb05-6b828e66d797', -- Kandace Abregana
    '633845dd-5f2c-442d-86f5-43aaae357eef', -- Joel Mallari
    '6bdf9636-ca19-416c-b64d-1227111db2ba', -- Josefina Echavia Conte
    '907df9a7-c99a-4c78-8472-308e5cffbed9', -- Engilben Nicolas
    '9b1feda7-1095-4159-9a85-fc90cc026d0c', -- Rechel Cayabat
    'ae4a655b-6dcd-4d33-8e40-79f48af61f27', -- Constantino Milo
    'c74186df-5ee5-424e-aba1-aab9a2815d0f', -- Melanie Sapinoso
    'c84e7a00-66ab-446f-99af-9d6b0207325c', -- Cristina Marte
    'e8b3aa76-725d-4625-a2e5-860277276cef', -- Carizza Leonardo
    'eb95ec6d-c8e7-4adb-8208-a4b1eb7f6abe', -- Eleazar Conte
    'f0db2c9c-05ca-43ac-a5f6-0191e3fdb1d7'  -- Daniel Tabada
  )
),
target AS (
  SELECT timestamptz '2026-05-29 07:00:00+08' AS punched_at
)
SELECT c.employee_id, c.full_name,
  EXISTS (
    SELECT 1 FROM time_entries te, target t
    WHERE te.employee_id = c.id
      AND te.punch_type = 'in'
      AND te.punched_at = t.punched_at
      AND te.source = 'admin_correction'
  ) AS already_has_admin_in
FROM cohort c
ORDER BY c.full_name;

-- =============================================================================
-- STEP 2 — Insert (copy this entire block; includes cohort + target CTEs)
-- =============================================================================
/*
WITH cohort AS (
  SELECT e.id, e.employee_id, e.full_name
  FROM employees e
  WHERE e.id IN (
    '1089f0a0-ea93-4908-9670-c16eaf04bf85',
    '20ea5cf9-79dd-4803-bb05-6b828e66d797',
    '633845dd-5f2c-442d-86f5-43aaae357eef',
    '6bdf9636-ca19-416c-b64d-1227111db2ba',
    '907df9a7-c99a-4c78-8472-308e5cffbed9',
    '9b1feda7-1095-4159-9a85-fc90cc026d0c',
    'ae4a655b-6dcd-4d33-8e40-79f48af61f27',
    'c74186df-5ee5-424e-aba1-aab9a2815d0f',
    'c84e7a00-66ab-446f-99af-9d6b0207325c',
    'e8b3aa76-725d-4625-a2e5-860277276cef',
    'eb95ec6d-c8e7-4adb-8208-a4b1eb7f6abe',
    'f0db2c9c-05ca-43ac-a5f6-0191e3fdb1d7'
  )
),
target AS (
  SELECT timestamptz '2026-05-29 07:00:00+08' AS punched_at
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
  c.id,
  'in',
  t.punched_at,
  14.3421975,
  121.0428414,
  'admin_correction',
  '87d1c9a2-ffe4-4999-a7fb-b6cc24d9082c'::uuid,
  'admin:7:00 AM — pre-open; staff instructed to time out only'
FROM cohort c
CROSS JOIN target t
WHERE NOT EXISTS (
  SELECT 1 FROM time_entries te
  WHERE te.employee_id = c.id
    AND te.punch_type = 'in'
    AND te.punched_at = t.punched_at
    AND te.source = 'admin_correction'
)
RETURNING employee_id;
*/
