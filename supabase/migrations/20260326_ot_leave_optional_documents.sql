-- Optional supporting documents for overtime and leave (no file required to submit requests).

-- ---------------------------------------------------------------------------
-- overtime_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.overtime_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  overtime_request_id uuid NOT NULL REFERENCES public.overtime_requests(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name text NOT NULL DEFAULT '',
  file_type text,
  file_size integer,
  file_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_overtime_documents_request_id
  ON public.overtime_documents(overtime_request_id);
CREATE INDEX IF NOT EXISTS idx_overtime_documents_employee_id
  ON public.overtime_documents(employee_id);

ALTER TABLE public.overtime_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "overtime_documents_select" ON public.overtime_documents;
CREATE POLICY "overtime_documents_select" ON public.overtime_documents
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'hr', 'admin', 'upper_management',
          'project_manager', 'operations_manager',
          'approver', 'viewer'
        )
    )
  );

-- ---------------------------------------------------------------------------
-- leave_request_documents (optional attachment rows per leave request)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_request_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leave_request_id uuid NOT NULL REFERENCES public.leave_requests(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type text,
  file_name text NOT NULL DEFAULT '',
  file_type text,
  file_size integer,
  file_base64 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leave_request_documents_request_id
  ON public.leave_request_documents(leave_request_id);
CREATE INDEX IF NOT EXISTS idx_leave_request_documents_employee_id
  ON public.leave_request_documents(employee_id);

ALTER TABLE public.leave_request_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_request_documents_select" ON public.leave_request_documents;
CREATE POLICY "leave_request_documents_select" ON public.leave_request_documents
  FOR SELECT
  USING (
    employee_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN (
          'hr', 'admin', 'upper_management',
          'project_manager', 'operations_manager',
          'approver', 'viewer'
        )
    )
  );
