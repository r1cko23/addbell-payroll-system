-- Remove duplicate 23h auto clock-out rows (race when parallel API calls auto-close).
DELETE FROM public.time_entries te
WHERE te.id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY employee_id, punched_at
        ORDER BY created_at ASC
      ) AS rn
    FROM public.time_entries
    WHERE punch_type = 'out'
      AND device_info LIKE 'auto:23h-open-shift-close%'
  ) ranked
  WHERE rn > 1
);

-- One auto-close OUT per employee per punched_at timestamp.
CREATE UNIQUE INDEX IF NOT EXISTS idx_time_entries_unique_bundy_auto_out
  ON public.time_entries (employee_id, punched_at)
  WHERE punch_type = 'out'
    AND device_info LIKE 'auto:23h-open-shift-close%';
