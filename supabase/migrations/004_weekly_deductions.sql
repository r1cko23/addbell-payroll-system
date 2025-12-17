-- Make deductions week-specific instead of just per-employee
-- Drop the old is_active approach
ALTER TABLE public.employee_deductions 
DROP COLUMN IF EXISTS is_active;

-- Add week_start_date to track deductions per week
ALTER TABLE public.employee_deductions 
ADD COLUMN IF NOT EXISTS week_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Create unique constraint: one deduction record per employee per week
DROP INDEX IF EXISTS idx_employee_deductions_employee_active;
CREATE UNIQUE INDEX IF NOT EXISTS idx_employee_deductions_week 
ON public.employee_deductions(employee_id, week_start_date);

-- Create index for querying by week
CREATE INDEX IF NOT EXISTS idx_employee_deductions_week_date 
ON public.employee_deductions(week_start_date);

-- Add comment
COMMENT ON COLUMN public.employee_deductions.week_start_date IS 'Week start date (Wednesday) for these deductions';

-- Update RLS policies to remove is_active references
DROP POLICY IF EXISTS "Users can view deductions" ON public.employee_deductions;
DROP POLICY IF EXISTS "HR/Admin can manage deductions" ON public.employee_deductions;

CREATE POLICY "Users can view deductions"
ON public.employee_deductions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "HR/Admin can manage deductions"
ON public.employee_deductions FOR ALL
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

