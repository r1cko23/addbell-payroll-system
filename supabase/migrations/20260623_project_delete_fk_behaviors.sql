-- Allow project deletion by removing all linked records.

DO $$
DECLARE
  r RECORD;
  delete_action text;
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
  LOOP
    IF r.table_name IN (
      'public.purchase_orders',
      'public.fund_requests',
      'public.project_assignments',
      'public.project_progress',
      'public.project_time_entries',
      'public.project_costs',
      'public.project_manpower_costs'
    ) THEN
      delete_action := 'CASCADE';
    ELSE
      delete_action := 'SET NULL';
      EXECUTE format(
        'ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL',
        r.table_ref,
        r.column_name
      );
    END IF;

    EXECUTE format(
      'ALTER TABLE %s DROP CONSTRAINT %I',
      r.table_ref,
      r.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.projects(id) ON DELETE %s',
      r.table_ref,
      r.constraint_name,
      r.column_name,
      delete_action
    );
  END LOOP;
END $$;
