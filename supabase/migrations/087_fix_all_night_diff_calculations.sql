-- =====================================================
-- MIGRATION: Fix All Night Differential Calculations
-- =====================================================
-- Recalculate night differential for ALL existing entries using proper timezone conversion

-- Temporarily disable trigger to prevent recalculation during update
ALTER TABLE time_clock_entries DISABLE TRIGGER trigger_calculate_time_clock_hours;

-- Recalculate night diff for all entries
UPDATE time_clock_entries
SET total_night_diff_hours = (
  WITH ph_times AS (
    SELECT
      clock_in_time AT TIME ZONE 'Asia/Manila' as ci_ph,
      clock_out_time AT TIME ZONE 'Asia/Manila' as co_ph,
      clock_in_time as ci_utc,
      clock_out_time as co_utc,
      total_hours as th
    FROM time_clock_entries t
    WHERE t.id = time_clock_entries.id
  )
  SELECT ROUND(GREATEST(0, LEAST(
    CASE
      -- Case 1: Same day, both after 5PM
      WHEN pt.ci_ph::TIME >= '17:00:00' AND pt.co_ph::TIME >= '17:00:00' AND pt.co_ph::DATE = pt.ci_ph::DATE THEN
        EXTRACT(EPOCH FROM (pt.co_utc - pt.ci_utc)) / 3600.0
      -- Case 2: Same day, clock in before 5PM, clock out after 5PM
      WHEN pt.ci_ph::TIME < '17:00:00' AND pt.co_ph::TIME >= '17:00:00' AND pt.co_ph::DATE = pt.ci_ph::DATE THEN
        EXTRACT(EPOCH FROM (pt.co_utc - (pt.ci_ph::DATE + TIME '17:00:00'))) / 3600.0
      -- Case 3: Clock in after 5PM, clock out after midnight but before 6AM next day
      WHEN pt.ci_ph::TIME >= '17:00:00' AND pt.co_ph::TIME < '06:00:00' AND pt.co_ph::DATE > pt.ci_ph::DATE THEN
        EXTRACT(EPOCH FROM ((pt.ci_ph::DATE + INTERVAL '1 day') - pt.ci_utc)) / 3600.0 +
        EXTRACT(EPOCH FROM (pt.co_utc - pt.co_ph::DATE)) / 3600.0
      -- Case 4: Clock in before 5PM, clock out after midnight but before 6AM next day
      WHEN pt.ci_ph::TIME < '17:00:00' AND pt.co_ph::TIME < '06:00:00' AND pt.co_ph::DATE > pt.ci_ph::DATE THEN
        EXTRACT(EPOCH FROM ((pt.ci_ph::DATE + INTERVAL '1 day') - (pt.ci_ph::DATE + TIME '17:00:00'))) / 3600.0 +
        EXTRACT(EPOCH FROM (pt.co_utc - pt.co_ph::DATE)) / 3600.0
      -- Case 5: Clock in after 5PM, clock out after 6AM next day
      WHEN pt.ci_ph::TIME >= '17:00:00' AND pt.co_ph::TIME >= '06:00:00' AND pt.co_ph::DATE > pt.ci_ph::DATE THEN
        EXTRACT(EPOCH FROM ((pt.ci_ph::DATE + INTERVAL '1 day') - pt.ci_utc)) / 3600.0 + 6.0
      -- Case 6: Clock in before 5PM, clock out after 6AM next day
      WHEN pt.ci_ph::TIME < '17:00:00' AND pt.co_ph::TIME >= '06:00:00' AND pt.co_ph::DATE > pt.ci_ph::DATE THEN
        EXTRACT(EPOCH FROM ((pt.ci_ph::DATE + INTERVAL '1 day') - (pt.ci_ph::DATE + TIME '17:00:00'))) / 3600.0 + 6.0
      ELSE 0
    END,
    pt.th
  )), 2)
  FROM ph_times pt
)
WHERE clock_out_time IS NOT NULL AND clock_in_time IS NOT NULL;

-- Re-enable trigger
ALTER TABLE time_clock_entries ENABLE TRIGGER trigger_calculate_time_clock_hours;





