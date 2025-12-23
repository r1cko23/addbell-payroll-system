-- Migration: Add additional loan types (SSS, Pagibig, Emergency, Other)
-- Updates the employee_loans table to support all loan types shown in the UI

-- Drop existing constraint
ALTER TABLE public.employee_loans
DROP CONSTRAINT IF EXISTS employee_loans_loan_type_check;

-- Add new constraint with all loan types
ALTER TABLE public.employee_loans
ADD CONSTRAINT employee_loans_loan_type_check 
CHECK (loan_type IN ('company', 'sss_calamity', 'pagibig_calamity', 'sss', 'pagibig', 'emergency', 'other'));

-- Update comment
COMMENT ON COLUMN public.employee_loans.loan_type IS 'Type of loan: company (6 months), sss_calamity (24 months), sss (24 months), pagibig_calamity (12/24/36 months), pagibig (12/24/36 months), emergency (flexible terms), other (flexible terms)';


