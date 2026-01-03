-- =====================================================
-- Overtime documents (store supporting file base64 like SIL docs)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.overtime_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  overtime_request_id UUID NOT NULL REFERENCES public.overtime_requests(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  file_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.overtime_documents ENABLE ROW LEVEL SECURITY;

-- Employees can insert/view their own docs
CREATE POLICY "Employees can view own OT docs" ON public.overtime_documents
  FOR SELECT USING (employee_id = auth.uid());
CREATE POLICY "Employees can insert own OT docs" ON public.overtime_documents
  FOR INSERT WITH CHECK (employee_id = auth.uid());

-- Account managers/admin can view all
CREATE POLICY "Account managers/admin can view OT docs" ON public.overtime_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.uid() AND u.role IN ('account_manager','admin'))
  );

-- Keep manage scope limited to cascades via parent; no direct update/delete policy needed.