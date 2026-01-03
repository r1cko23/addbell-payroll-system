-- Add bank account information to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS bank_account_number TEXT;

-- Add comment
COMMENT ON COLUMN public.employees.bank_account_number IS 'Employee bank account number for payroll transfers';
