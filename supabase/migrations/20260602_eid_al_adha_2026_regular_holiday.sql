-- Correct Eid al-Adha 2026-05-27: regular holiday (RH), not special non-working (SH).
UPDATE public.holidays
SET is_regular = true
WHERE holiday_date = '2026-05-27';
