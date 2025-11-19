-- Add bank account information to employees table
ALTER TABLE public.employees 
ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
ADD COLUMN IF NOT EXISTS bank_name TEXT,
ADD COLUMN IF NOT EXISTS account_holder_name TEXT;

-- Add comment
COMMENT ON COLUMN public.employees.bank_account_number IS 'Employee bank account number for payroll transfers';
COMMENT ON COLUMN public.employees.bank_name IS 'Name of the bank';
COMMENT ON COLUMN public.employees.account_holder_name IS 'Account holder name (may differ from employee name)';

