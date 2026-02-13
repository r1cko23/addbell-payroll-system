-- =====================================================
-- FUND REQUESTS TABLE
-- =====================================================
-- This migration adds the fund request workflow system
-- Flow: Requester → Project Manager → Purchasing Officer → Upper Management

CREATE TABLE IF NOT EXISTS public.fund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID NOT NULL REFERENCES public.employees(id) ON DELETE RESTRICT,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  purpose TEXT NOT NULL,
  po_number TEXT,
  project_title TEXT,
  project_location TEXT,
  po_amount DECIMAL(15, 2),
  current_project_percentage DECIMAL(5, 2) CHECK (current_project_percentage >= 0 AND current_project_percentage <= 100),
  details JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {description: string, amount: number}
  total_requested_amount DECIMAL(15, 2) NOT NULL,
  date_needed DATE NOT NULL,
  urgent_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'project_manager_approved', 'purchasing_officer_approved', 'management_approved', 'rejected')),
  
  -- Approval tracking
  project_manager_approved_by UUID REFERENCES public.users(id),
  project_manager_approved_at TIMESTAMP WITH TIME ZONE,
  purchasing_officer_approved_by UUID REFERENCES public.users(id),
  purchasing_officer_approved_at TIMESTAMP WITH TIME ZONE,
  management_approved_by UUID REFERENCES public.users(id),
  management_approved_at TIMESTAMP WITH TIME ZONE,
  supplier_bank_details TEXT,
  
  -- Rejection tracking
  rejected_by UUID REFERENCES public.users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fund_requests_requested_by ON public.fund_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_fund_requests_status ON public.fund_requests(status);
CREATE INDEX IF NOT EXISTS idx_fund_requests_request_date ON public.fund_requests(request_date);
CREATE INDEX IF NOT EXISTS idx_fund_requests_date_needed ON public.fund_requests(date_needed);

-- RLS Policies
ALTER TABLE public.fund_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own fund requests
CREATE POLICY "Employees can view their own fund requests" ON public.fund_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employees 
      WHERE id = requested_by AND id IN (
        SELECT id FROM public.employees WHERE id = requested_by
      )
    )
  );

-- Employees can create fund requests
CREATE POLICY "Employees can create fund requests" ON public.fund_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees 
      WHERE id = requested_by AND id IN (
        SELECT id FROM public.employees WHERE id = requested_by
      )
    )
  );

-- All authenticated users can view fund requests (for approval workflow)
CREATE POLICY "All authenticated users can view fund requests" ON public.fund_requests
  FOR SELECT USING (auth.role() = 'authenticated');

-- Project Managers (operations_manager role) can approve pending requests
CREATE POLICY "Operations managers can approve pending fund requests" ON public.fund_requests
  FOR UPDATE USING (
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'operations_manager'
    )
  );

-- Purchasing Officers can approve project_manager_approved requests
CREATE POLICY "Purchasing officers can approve PM-approved fund requests" ON public.fund_requests
  FOR UPDATE USING (
    status = 'project_manager_approved' AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'purchasing_officer'
    )
  );

-- HR, Admin, and Upper Management can approve purchasing_officer_approved requests
CREATE POLICY "Management can approve PO-approved fund requests" ON public.fund_requests
  FOR UPDATE USING (
    status = 'purchasing_officer_approved' AND
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('hr', 'admin', 'upper_management')
    )
  );

-- Authorized roles can reject requests
CREATE POLICY "Authorized roles can reject fund requests" ON public.fund_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('operations_manager', 'purchasing_officer', 'hr', 'admin', 'upper_management')
    )
  );

-- Trigger for updated_at
CREATE TRIGGER update_fund_requests_updated_at BEFORE UPDATE ON public.fund_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
