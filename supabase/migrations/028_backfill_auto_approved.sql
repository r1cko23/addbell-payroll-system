-- Backfill clocked out entries to auto_approved for completed clock-outs
UPDATE public.time_clock_entries
SET status = 'auto_approved'
WHERE status = 'clocked_out'
  AND clock_out_time IS NOT NULL;
