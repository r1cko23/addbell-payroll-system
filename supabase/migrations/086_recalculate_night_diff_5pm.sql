-- =====================================================
-- MIGRATION: Recalculate Night Differential (5PM onwards)
-- =====================================================
-- Recalculate all existing entries with proper timezone handling

-- Create a function to recalculate night diff for a single entry
CREATE OR REPLACE FUNCTION recalculate_night_diff(p_entry_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  v_clock_in TIMESTAMP WITH TIME ZONE;
  v_clock_out TIMESTAMP WITH TIME ZONE;
  v_clock_in_ph TIMESTAMP WITH TIME ZONE;
  v_clock_out_ph TIMESTAMP WITH TIME ZONE;
  v_clock_in_time TIME;
  v_clock_out_time TIME;
  v_clock_in_date DATE;
  v_clock_out_date DATE;
  v_total_hours NUMERIC;
  night_hours NUMERIC := 0;
BEGIN
  SELECT clock_in_time, clock_out_time, total_hours
  INTO v_clock_in, v_clock_out, v_total_hours
  FROM time_clock_entries
  WHERE id = p_entry_id;

  IF v_clock_in IS NULL OR v_clock_out IS NULL THEN
    RETURN 0;
  END IF;

  -- Convert to Philippines timezone
  v_clock_in_ph := v_clock_in AT TIME ZONE 'Asia/Manila';
  v_clock_out_ph := v_clock_out AT TIME ZONE 'Asia/Manila';
  v_clock_in_time := v_clock_in_ph::TIME;
  v_clock_out_time := v_clock_out_ph::TIME;
  v_clock_in_date := v_clock_in_ph::DATE;
  v_clock_out_date := v_clock_out_ph::DATE;

  -- Case 1: Same day, both after 5PM
  IF v_clock_in_time >= '17:00:00' AND v_clock_out_time >= '17:00:00' AND v_clock_in_date = v_clock_out_date THEN
    night_hours := EXTRACT(EPOCH FROM (v_clock_out - v_clock_in)) / 3600.0;

  -- Case 2: Same day, clock in before 5PM, clock out after 5PM
  ELSIF v_clock_in_time < '17:00:00' AND v_clock_out_time >= '17:00:00' AND v_clock_in_date = v_clock_out_date THEN
    night_hours := EXTRACT(EPOCH FROM (v_clock_out - (v_clock_in_date + TIME '17:00:00'))) / 3600.0;

  -- Case 3: Clock in after 5PM, clock out after midnight but before 6AM next day
  ELSIF v_clock_in_time >= '17:00:00' AND v_clock_out_time < '06:00:00' AND v_clock_out_date > v_clock_in_date THEN
    night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - v_clock_in)) / 3600.0;
    night_hours := night_hours + EXTRACT(EPOCH FROM (v_clock_out - v_clock_out_date)) / 3600.0;

  -- Case 4: Clock in before 5PM, clock out after midnight but before 6AM next day
  ELSIF v_clock_in_time < '17:00:00' AND v_clock_out_time < '06:00:00' AND v_clock_out_date > v_clock_in_date THEN
    night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - (v_clock_in_date + TIME '17:00:00'))) / 3600.0;
    night_hours := night_hours + EXTRACT(EPOCH FROM (v_clock_out - v_clock_out_date)) / 3600.0;

  -- Case 5: Clock in after 5PM, clock out after 6AM next day
  ELSIF v_clock_in_time >= '17:00:00' AND v_clock_out_time >= '06:00:00' AND v_clock_out_date > v_clock_in_date THEN
    night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - v_clock_in)) / 3600.0;
    night_hours := night_hours + 6.0;

  -- Case 6: Clock in before 5PM, clock out after 6AM next day
  ELSIF v_clock_in_time < '17:00:00' AND v_clock_out_time >= '06:00:00' AND v_clock_out_date > v_clock_in_date THEN
    night_hours := EXTRACT(EPOCH FROM ((v_clock_in_date + INTERVAL '1 day') - (v_clock_in_date + TIME '17:00:00'))) / 3600.0;
    night_hours := night_hours + 6.0;
  END IF;

  RETURN ROUND(GREATEST(0, LEAST(night_hours, v_total_hours)), 2);
END;
$$;

-- Recalculate all entries
UPDATE time_clock_entries
SET total_night_diff_hours = recalculate_night_diff(id)
WHERE clock_out_time IS NOT NULL AND clock_in_time IS NOT NULL;

-- Drop the helper function
DROP FUNCTION IF EXISTS recalculate_night_diff(UUID);


