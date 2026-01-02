-- Migration: Create employee_loans table for loan management
-- Supports Company Loan, SSS Calamity Loan, Pagibig Calamity Loan with terms and effectivity dates

CREATE TABLE IF NOT EXISTS public.employee_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('company', 'sss_calamity', 'pagibig_calamity', 'sss', 'pagibig', 'emergency', 'other')),
  original_balance NUMERIC(10, 2) NOT NULL CHECK (original_balance > 0),
  current_balance NUMERIC(10, 2) NOT NULL CHECK (current_balance >= 0),
  monthly_payment NUMERIC(10, 2) NOT NULL CHECK (monthly_payment > 0),
  total_terms INTEGER NOT NULL CHECK (total_terms > 0),
  remaining_terms INTEGER NOT NULL CHECK (remaining_terms >= 0),
  effectivity_date DATE NOT NULL,
  cutoff_assignment TEXT NOT NULL CHECK (cutoff_assignment IN ('first', 'second', 'both')) DEFAULT 'first',
  -- Company loan: 6 months
  -- SSS Calamity Loan: 24 months
  -- SSS Loan: 24 months
  -- Pagibig Calamity Loan: 12, 24, or 36 months
  -- Pagibig Loan: 12, 24, or 36 months
  -- Emergency Loan: Flexible terms
  -- Other Loan: Flexible terms
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add comments
COMMENT ON TABLE public.employee_loans IS 'Employee loan records with terms, balances, and effectivity dates';
COMMENT ON COLUMN public.employee_loans.loan_type IS 'Type of loan: company (6 months), sss_calamity (24 months), sss (24 months), pagibig_calamity (12/24/36 months), pagibig (12/24/36 months), emergency (flexible terms), other (flexible terms)';
COMMENT ON COLUMN public.employee_loans.original_balance IS 'Original loan amount';
COMMENT ON COLUMN public.employee_loans.current_balance IS 'Current remaining balance';
COMMENT ON COLUMN public.employee_loans.monthly_payment IS 'Monthly payment amount';
COMMENT ON COLUMN public.employee_loans.total_terms IS 'Total number of payment terms';
COMMENT ON COLUMN public.employee_loans.remaining_terms IS 'Remaining number of payment terms';
COMMENT ON COLUMN public.employee_loans.effectivity_date IS 'Date when loan deductions start';
COMMENT ON COLUMN public.employee_loans.cutoff_assignment IS 'Which cutoff(s) to deduct: first (1-15), second (16-31), or both';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_employee_loans_employee_id ON public.employee_loans(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_loans_loan_type ON public.employee_loans(loan_type);
CREATE INDEX IF NOT EXISTS idx_employee_loans_is_active ON public.employee_loans(is_active);
CREATE INDEX IF NOT EXISTS idx_employee_loans_effectivity_date ON public.employee_loans(effectivity_date);

-- Enable RLS
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Only users with salary access can view loans (same as payslip access)
CREATE POLICY "Users with salary access can view loans"
ON public.employee_loans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.can_access_salary = true
    AND users.is_active = true
  )
);

-- Admin and HR can manage loans
CREATE POLICY "Admin/HR can manage loans"
ON public.employee_loans FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'hr')
  )
);

-- Create trigger to update updated_at
CREATE TRIGGER update_employee_loans_updated_at
BEFORE UPDATE ON public.employee_loans
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();





