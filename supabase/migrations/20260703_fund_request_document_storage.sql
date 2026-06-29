-- Store fund request document bytes in Supabase Storage; keep metadata in Postgres.

ALTER TABLE public.fund_request_documents
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.fund_request_documents
  ALTER COLUMN file_base64 DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fund_request_documents_content_check'
  ) THEN
    ALTER TABLE public.fund_request_documents
      ADD CONSTRAINT fund_request_documents_content_check
      CHECK (
        (storage_path IS NOT NULL AND btrim(storage_path) <> '')
        OR (file_base64 IS NOT NULL AND btrim(file_base64) <> '')
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_fund_request_documents_storage_path
  ON public.fund_request_documents(storage_path)
  WHERE storage_path IS NOT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('fund-request-documents', 'fund-request-documents', false, 5242880)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit;

DROP POLICY IF EXISTS "fund_request_documents_storage_read" ON storage.objects;
CREATE POLICY "fund_request_documents_storage_read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'fund-request-documents'
    AND EXISTS (
      SELECT 1
      FROM public.fund_request_documents d
      WHERE d.storage_path = name
        AND (
          EXISTS (
            SELECT 1
            FROM public.employees e
            WHERE e.id = d.employee_id
              AND e.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1
            FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN (
                'hr', 'admin', 'upper_management',
                'project_manager', 'operations_manager',
                'purchasing_officer', 'approver', 'viewer'
              )
          )
        )
    )
  );
