-- =====================================================
-- 082: Update Payslips Schema
-- =====================================================
-- Ensure payslips table has period_start, period_end, and period_type columns
-- =====================================================

-- Rename columns if they still have old names
DO $$
BEGIN
  -- Check if week_start_date exists and rename to period_start
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payslips'
    AND column_name = 'week_start_date'
  ) THEN
    ALTER TABLE public.payslips RENAME COLUMN week_start_date TO period_start;
  END IF;

  -- Check if week_end_date exists and rename to period_end
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'payslips'
    AND column_name = 'week_end_date'
  ) THEN
    ALTER TABLE public.payslips RENAME COLUMN week_end_date TO period_end;
  END IF;
END $$;

-- Add period_type column if it doesn't exist
ALTER TABLE public.payslips
  ADD COLUMN IF NOT EXISTS period_type TEXT DEFAULT 'bimonthly' CHECK (period_type IN ('weekly', 'bimonthly'));

-- Update existing records to set period_type
UPDATE public.payslips
SET period_type = 'bimonthly'
WHERE period_type IS NULL;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payslips_employee_period ON public.payslips(employee_id, period_start);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON public.payslips(status);
CREATE INDEX IF NOT EXISTS idx_payslips_period_dates ON public.payslips(period_start, period_end);

-- Add RLS policies if not exists
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;

-- Admin and HR can view all payslips
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'payslips'
    AND policyname = 'Admin/HR can view all payslips'
  ) THEN
    CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'hr')
        )
      );
  END IF;
END $$;

-- Admin and HR can manage payslips
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'payslips'
    AND policyname = 'Admin/HR can manage payslips'
  ) THEN
    CREATE POLICY "Admin/HR can manage payslips" ON public.payslips
      FOR ALL USING (
        EXISTS (
          SELECT 1 FROM public.users u
          WHERE u.id = auth.uid()
          AND u.role IN ('admin', 'hr')
        )
      );
  END IF;
END $$;

-- Employees can view their own payslips
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'payslips'
    AND policyname = 'Employees can view own payslips'
  ) THEN
    CREATE POLICY "Employees can view own payslips" ON public.payslips
      FOR SELECT USING (
        employee_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.employees e
          WHERE e.id = payslips.employee_id
          AND e.id = auth.uid()
        )
      );
  END IF;
END $$;




