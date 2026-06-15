-- Optional supporting documents for fund requests.

CREATE TABLE IF NOT EXISTS public.fund_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_request_id uuid NOT NULL REFERENCES public.fund_requests(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  file_type text,
  file_size integer,
  file_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fund_request_documents_request_id
  ON public.fund_request_documents(fund_request_id);
CREATE INDEX IF NOT EXISTS idx_fund_request_documents_employee_id
  ON public.fund_request_documents(employee_id);

ALTER TABLE public.fund_request_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fund_request_documents_select" ON public.fund_request_documents;
CREATE POLICY "fund_request_documents_select" ON public.fund_request_documents
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'hr', 'admin', 'upper_management',
          'project_manager', 'operations_manager',
          'purchasing_officer', 'approver', 'viewer'
        )
    )
  );
