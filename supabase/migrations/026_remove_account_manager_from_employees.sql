-- =====================================================
-- REMOVE ACCOUNT MANAGER FROM EMPLOYEES TABLE
-- =====================================================
-- Remove the account_manager_id column from employees table
-- since account managers can approve any employee's requests
-- and we don't need to track assignments per employee.

-- Drop the index first
DROP INDEX IF EXISTS idx_employees_account_manager;

-- Remove the foreign key constraint and column
ALTER TABLE public.employees
DROP COLUMN IF EXISTS account_manager_id;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.employees IS
  'Employee information. Account managers are not assigned per employee - any account manager can handle any employee.';
