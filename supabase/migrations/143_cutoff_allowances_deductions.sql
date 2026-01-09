-- =====================================================
-- CUTOFF ALLOWANCES TABLE
-- =====================================================
-- Stores manual allowances per employee per cutoff period
-- Allows payroll processors to add custom allowances
CREATE TABLE IF NOT EXISTS public.cutoff_allowances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Manual allowances
  transpo_allowance DECIMAL(10, 2) DEFAULT 0,
  load_allowance DECIMAL(10, 2) DEFAULT 0,
  allowance DECIMAL(10, 2) DEFAULT 0, -- General allowance
  refund DECIMAL(10, 2) DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  
  -- One record per employee per cutoff period
  UNIQUE(employee_id, period_start)
);

-- =====================================================
-- UPDATE EMPLOYEE_DEDUCTIONS TABLE
-- =====================================================
-- Add other_deduction field for manual deductions per cutoff
ALTER TABLE public.employee_deductions
ADD COLUMN IF NOT EXISTS other_deduction DECIMAL(10, 2) DEFAULT 0;

-- Add SSS PRO (SSS Provident Fund) field
ALTER TABLE public.employee_deductions
ADD COLUMN IF NOT EXISTS sss_pro DECIMAL(10, 2) DEFAULT 0;

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_cutoff_allowances_employee ON public.cutoff_allowances(employee_id);
CREATE INDEX IF NOT EXISTS idx_cutoff_allowances_period ON public.cutoff_allowances(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_cutoff_allowances_employee_period ON public.cutoff_allowances(employee_id, period_start);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE public.cutoff_allowances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cutoff allowances"
ON public.cutoff_allowances FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "HR/Admin can manage cutoff allowances"
ON public.cutoff_allowances FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('hr', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('hr', 'admin')
  )
);

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.cutoff_allowances IS 'Manual allowances per employee per cutoff period';
COMMENT ON COLUMN public.cutoff_allowances.transpo_allowance IS 'Transportation allowance for the cutoff period';
COMMENT ON COLUMN public.cutoff_allowances.load_allowance IS 'Load allowance for the cutoff period';
COMMENT ON COLUMN public.cutoff_allowances.allowance IS 'General allowance for the cutoff period';
COMMENT ON COLUMN public.cutoff_allowances.refund IS 'Refund amount for the cutoff period';
COMMENT ON COLUMN public.employee_deductions.other_deduction IS 'Other manual deductions per cutoff period';
COMMENT ON COLUMN public.employee_deductions.sss_pro IS 'SSS Provident Fund contribution';
