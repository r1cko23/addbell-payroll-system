-- =====================================================
-- OVERTIME REQUESTS TABLE
-- =====================================================
-- Employees file OT requests that require HR approval
CREATE TABLE public.overtime_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- OT Details
  ot_date DATE NOT NULL,
  ot_hours DECIMAL(10, 2) NOT NULL,
  work_description TEXT NOT NULL,
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  
  -- Approval Details
  reviewed_by UUID REFERENCES public.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  
  -- Audit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_ot_requests_employee ON public.overtime_requests(employee_id);
CREATE INDEX idx_ot_requests_date ON public.overtime_requests(ot_date);
CREATE INDEX idx_ot_requests_status ON public.overtime_requests(status);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;

-- Employees can view their own OT requests
CREATE POLICY "Employees can view own OT requests" ON public.overtime_requests
  FOR SELECT USING (true);

-- Employees can create their own OT requests
CREATE POLICY "Employees can create OT requests" ON public.overtime_requests
  FOR INSERT WITH CHECK (true);

-- HR/Admin can view all OT requests
CREATE POLICY "HR/Admin can view all OT requests" ON public.overtime_requests
  FOR SELECT USING (true);

-- HR/Admin can approve/reject OT requests
CREATE POLICY "HR/Admin can manage OT requests" ON public.overtime_requests
  FOR UPDATE USING (true);

-- =====================================================
-- MODIFY TIME CLOCK ENTRIES
-- =====================================================
-- Remove approval requirement for regular clock entries
-- Regular entries auto-approve, only OT needs approval

-- Update the status check to allow 'auto_approved'
ALTER TABLE public.time_clock_entries 
  DROP CONSTRAINT IF EXISTS time_clock_entries_status_check;

ALTER TABLE public.time_clock_entries 
  ADD CONSTRAINT time_clock_entries_status_check 
  CHECK (status IN ('clocked_in', 'clocked_out', 'approved', 'rejected', 'auto_approved'));

-- Function to auto-approve regular hours
CREATE OR REPLACE FUNCTION auto_approve_regular_hours()
RETURNS TRIGGER AS $$
BEGIN
  -- When clocking out, auto-approve regular hours
  IF NEW.clock_out_time IS NOT NULL AND OLD.clock_out_time IS NULL THEN
    -- Auto-approve the entry
    NEW.status := 'auto_approved';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-approve
CREATE TRIGGER trigger_auto_approve_regular_hours
  BEFORE UPDATE ON public.time_clock_entries
  FOR EACH ROW
  EXECUTE FUNCTION auto_approve_regular_hours();

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View to get pending OT requests count
CREATE OR REPLACE VIEW pending_ot_count AS
SELECT 
  employee_id,
  COUNT(*) as pending_count
FROM public.overtime_requests
WHERE status = 'pending'
GROUP BY employee_id;

-- View to get approved OT for a date range
CREATE OR REPLACE VIEW approved_overtime AS
SELECT 
  employee_id,
  ot_date,
  SUM(ot_hours) as total_ot_hours
FROM public.overtime_requests
WHERE status = 'approved'
GROUP BY employee_id, ot_date;

