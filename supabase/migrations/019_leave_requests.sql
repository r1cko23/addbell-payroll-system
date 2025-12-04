-- =====================================================
-- LEAVE REQUESTS TABLE
-- =====================================================
-- Employees can file leave requests (SIL or LWOP)
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL CHECK (leave_type IN ('SIL', 'LWOP')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days NUMERIC NOT NULL CHECK (total_days > 0),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved_by_manager', 'approved_by_hr', 'rejected', 'cancelled')),
  account_manager_id UUID REFERENCES public.users(id),
  account_manager_approved_at TIMESTAMP WITH TIME ZONE,
  account_manager_notes TEXT,
  hr_approved_by UUID REFERENCES public.users(id),
  hr_approved_at TIMESTAMP WITH TIME ZONE,
  hr_notes TEXT,
  rejected_by UUID REFERENCES public.users(id),
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type ON public.leave_requests(leave_type);
CREATE INDEX IF NOT EXISTS idx_leave_requests_account_manager ON public.leave_requests(account_manager_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own leave requests
-- Note: Employee portal uses localStorage, so RLS is permissive for employees
-- Application-level validation ensures employees only see their own data
CREATE POLICY "Employees can view own leave requests" ON public.leave_requests
  FOR SELECT USING (true);

-- Employees can create their own leave requests
CREATE POLICY "Employees can create leave requests" ON public.leave_requests
  FOR INSERT WITH CHECK (true);

-- Employees can cancel their own pending leave requests
CREATE POLICY "Employees can cancel own pending leave requests" ON public.leave_requests
  FOR UPDATE USING (status = 'pending')
  WITH CHECK (status = 'cancelled');

-- Account managers can view requests for their employees
CREATE POLICY "Account managers can view assigned leave requests" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'account_manager'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- Account managers can approve/reject requests for their employees (first level)
CREATE POLICY "Account managers can manage assigned leave requests" ON public.leave_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'account_manager'
      AND (
        leave_requests.account_manager_id = users.id
        OR leave_requests.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- HR and Admin can view all leave requests
CREATE POLICY "HR/Admin can view all leave requests" ON public.leave_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('hr', 'admin')
    )
  );

-- HR and Admin can manage all leave requests (second level approval)
CREATE POLICY "HR/Admin can manage all leave requests" ON public.leave_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('hr', 'admin')
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================
CREATE TRIGGER update_leave_requests_updated_at
  BEFORE UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Check and deduct SIL credits
-- =====================================================
CREATE OR REPLACE FUNCTION check_sil_credits(
  p_employee_id UUID,
  p_total_days NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_credits NUMERIC;
BEGIN
  -- Get available SIL credits
  SELECT COALESCE(sil_credits, 0) INTO v_available_credits
  FROM public.employees
  WHERE id = p_employee_id;

  -- Check if enough credits
  RETURN v_available_credits >= p_total_days;
END;
$$;

-- =====================================================
-- FUNCTION: Deduct SIL credits when approved
-- =====================================================
CREATE OR REPLACE FUNCTION deduct_sil_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only deduct when status changes to approved_by_hr and leave_type is SIL
  IF NEW.status = 'approved_by_hr' 
     AND OLD.status != 'approved_by_hr'
     AND NEW.leave_type = 'SIL' THEN
    
    -- Deduct SIL credits
    UPDATE public.employees
    SET sil_credits = GREATEST(0, COALESCE(sil_credits, 0) - NEW.total_days)
    WHERE id = NEW.employee_id;
  END IF;

  -- Restore credits if request is rejected or cancelled after being approved
  IF (NEW.status IN ('rejected', 'cancelled') 
      AND OLD.status = 'approved_by_hr'
      AND NEW.leave_type = 'SIL') THEN
    
    -- Restore SIL credits
    UPDATE public.employees
    SET sil_credits = COALESCE(sil_credits, 0) + OLD.total_days
    WHERE id = NEW.employee_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-deduct SIL credits
CREATE TRIGGER trigger_deduct_sil_credits
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW
  EXECUTE FUNCTION deduct_sil_credits();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.leave_requests IS 'Tracks employee leave requests (SIL or LWOP)';
COMMENT ON COLUMN public.leave_requests.leave_type IS 'Type of leave: SIL (Service Incentive Leave) or LWOP (Leave Without Pay)';
COMMENT ON COLUMN public.leave_requests.status IS 'Approval workflow: pending -> approved_by_manager -> approved_by_hr -> approved, or rejected/cancelled';
COMMENT ON FUNCTION check_sil_credits IS 'Checks if employee has enough SIL credits for the requested days';

