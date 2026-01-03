-- 104: Add Philippine Holidays 2026
-- Adds all official holidays for 2026 to the database
-- Note: Dates are calculated based on standard patterns and should be verified
-- against the official proclamation once it is published

-- Delete any existing 2026 holidays first (in case of updates)
DELETE FROM public.holidays WHERE year = 2026;

-- Regular Holidays 2026
INSERT INTO public.holidays (holiday_date, holiday_name, holiday_type, year, is_active) VALUES
  ('2026-01-01', 'New Year''s Day', 'regular', 2026, true),
  ('2026-04-02', 'Maundy Thursday', 'regular', 2026, true),
  ('2026-04-03', 'Good Friday', 'regular', 2026, true),
  ('2026-04-09', 'Araw ng Kagitingan', 'regular', 2026, true),
  ('2026-05-01', 'Labor Day', 'regular', 2026, true),
  ('2026-06-12', 'Independence Day', 'regular', 2026, true),
  ('2026-08-31', 'National Heroes Day', 'regular', 2026, true),
  ('2026-11-30', 'Bonifacio Day', 'regular', 2026, true),
  ('2026-12-25', 'Christmas Day', 'regular', 2026, true),
  ('2026-12-30', 'Rizal Day', 'regular', 2026, true),
  
  -- Special Non-Working Holidays 2026
  ('2026-02-17', 'Chinese New Year', 'non-working', 2026, true),
  ('2026-02-25', 'EDSA People Power Revolution Anniversary', 'non-working', 2026, true),
  ('2026-04-04', 'Black Saturday', 'non-working', 2026, true),
  ('2026-08-21', 'Ninoy Aquino Day', 'non-working', 2026, true),
  ('2026-11-01', 'All Saints'' Day', 'non-working', 2026, true),
  ('2026-11-02', 'All Souls'' Day', 'non-working', 2026, true),
  ('2026-12-08', 'Feast of the Immaculate Conception', 'non-working', 2026, true),
  ('2026-12-24', 'Christmas Eve', 'non-working', 2026, true),
  ('2026-12-26', 'Additional Special Non-Working Day', 'non-working', 2026, true),
  ('2026-12-31', 'New Year''s Eve', 'non-working', 2026, true);

-- Add comment
COMMENT ON TABLE public.holidays IS 'Philippine holidays. 2026 dates are calculated and should be verified against official proclamation once published.';