-- =====================================================
-- FAILURE TO LOG TABLE
-- =====================================================
-- Employees can file requests when they forget to clock in/out
CREATE TABLE IF NOT EXISTS public.failure_to_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  time_entry_id UUID NOT NULL REFERENCES public.time_clock_entries(id) ON DELETE CASCADE,
  missed_date DATE NOT NULL,
  actual_clock_out_time TIMESTAMP WITH TIME ZONE NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  account_manager_id UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_failure_to_log_employee ON public.failure_to_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_failure_to_log_time_entry ON public.failure_to_log(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_failure_to_log_status ON public.failure_to_log(status);
CREATE INDEX IF NOT EXISTS idx_failure_to_log_missed_date ON public.failure_to_log(missed_date);
CREATE INDEX IF NOT EXISTS idx_failure_to_log_account_manager ON public.failure_to_log(account_manager_id);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.failure_to_log ENABLE ROW LEVEL SECURITY;

-- Employees can view their own failure to log requests
-- Note: Employee portal uses localStorage, so RLS is permissive for employees
-- Application-level validation ensures employees only see their own data
CREATE POLICY "Employees can view own failure to log requests" ON public.failure_to_log
  FOR SELECT USING (true);

-- Employees can create their own failure to log requests
CREATE POLICY "Employees can create failure to log requests" ON public.failure_to_log
  FOR INSERT WITH CHECK (true);

-- Account managers can view requests for their employees
CREATE POLICY "Account managers can view assigned failure to log requests" ON public.failure_to_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'account_manager'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- Account managers can approve/reject requests for their employees
CREATE POLICY "Account managers can manage assigned failure to log requests" ON public.failure_to_log
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role = 'account_manager'
      AND (
        failure_to_log.account_manager_id = users.id
        OR failure_to_log.employee_id IN (
          SELECT id FROM public.employees
          WHERE account_manager_id = users.id
        )
      )
    )
  );

-- HR and Admin can view all failure to log requests
CREATE POLICY "HR/Admin can view all failure to log requests" ON public.failure_to_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('hr', 'admin')
    )
  );

-- HR and Admin can manage all failure to log requests
CREATE POLICY "HR/Admin can manage all failure to log requests" ON public.failure_to_log
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
CREATE TRIGGER update_failure_to_log_updated_at
  BEFORE UPDATE ON public.failure_to_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.failure_to_log IS 'Tracks employee requests for failure to clock in/out';
COMMENT ON COLUMN public.failure_to_log.missed_date IS 'The date when the employee forgot to clock in/out';
COMMENT ON COLUMN public.failure_to_log.actual_clock_out_time IS 'The actual time the employee clocked out (if they forgot to clock in) or should have clocked out';
COMMENT ON COLUMN public.failure_to_log.reason IS 'Employee-provided reason for failure to log';