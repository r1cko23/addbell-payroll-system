-- Eid al-Adha 2026 (regular holiday throughout the Philippines)
-- Safe to re-run: uses ON CONFLICT if holidays table exists with unique holiday_date.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'holidays'
  ) THEN
    INSERT INTO public.holidays (holiday_date, name, is_regular)
    VALUES ('2026-05-27', 'Eid al-Adha (Feast of Sacrifice)', true)
    ON CONFLICT (holiday_date) DO UPDATE
      SET name = EXCLUDED.name,
          is_regular = EXCLUDED.is_regular;
  END IF;
END $$;
