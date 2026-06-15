-- Cascade-delete fund requests and purchase orders when a project is deleted.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      c.conname AS constraint_name,
      c.conrelid::regclass AS table_ref,
      c.conrelid::regclass::text AS table_name,
      a.attname AS column_name
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
      AND a.attnum = c.conkey[1]
    WHERE c.confrelid = 'public.projects'::regclass
      AND c.contype = 'f'
      AND array_length(c.conkey, 1) = 1
      AND c.conrelid::regclass::text IN ('public.purchase_orders', 'public.fund_requests')
  LOOP
    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      r.table_ref,
      r.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.projects(id) ON DELETE CASCADE',
      r.table_ref,
      r.constraint_name,
      r.column_name
    );
  END LOOP;
END $$;
