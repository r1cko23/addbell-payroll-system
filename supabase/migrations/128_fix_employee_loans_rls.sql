-- Migration: Fix RLS policies for employee_loans table
-- Ensure only Admin and HR can manage loans (insert, update, delete)
-- Users with salary access can view loans (same as payslip access)

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users with salary access can view loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Admin/HR can insert loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Admin/HR can update loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Admin/HR can delete loans" ON public.employee_loans;
DROP POLICY IF EXISTS "Admin/HR can manage loans" ON public.employee_loans;
DROP POLICY IF EXISTS "All authenticated users can view loans" ON public.employee_loans;

-- Ensure RLS is enabled
ALTER TABLE public.employee_loans ENABLE ROW LEVEL SECURITY;

-- Policy 1: SELECT - Users with salary access can view loans
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

-- Policy 2: INSERT - Admin and HR can insert loans
CREATE POLICY "Admin/HR can insert loans"
ON public.employee_loans FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND (users.role = 'admin' OR users.role = 'hr')
    AND users.is_active = true
  )
);

-- Policy 3: UPDATE - Admin and HR can update loans
CREATE POLICY "Admin/HR can update loans"
ON public.employee_loans FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND (users.role = 'admin' OR users.role = 'hr')
    AND users.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND (users.role = 'admin' OR users.role = 'hr')
    AND users.is_active = true
  )
);

-- Policy 4: DELETE - Admin and HR can delete loans
CREATE POLICY "Admin/HR can delete loans"
ON public.employee_loans FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
    AND (users.role = 'admin' OR users.role = 'hr')
    AND users.is_active = true
  )
);


