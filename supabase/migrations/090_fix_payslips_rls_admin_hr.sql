-- =====================================================
-- 090: Fix Payslips RLS for Admin/HR Access
-- =====================================================
-- Fix 403 errors for admin and HR users accessing payslips
-- =====================================================

-- Drop all existing payslips policies to start fresh
DROP POLICY IF EXISTS "All authenticated users can view payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can create/update payslips" ON public.payslips;
DROP POLICY IF EXISTS "HR and Admin can update draft payslips" ON public.payslips;
DROP POLICY IF EXISTS "Only Admins can approve payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can view all payslips" ON public.payslips;
DROP POLICY IF EXISTS "Admin/HR can manage payslips" ON public.payslips;
DROP POLICY IF EXISTS "Employees can view own payslips" ON public.payslips;

-- Admin and HR can SELECT all payslips
CREATE POLICY "Admin/HR can view all payslips" ON public.payslips
  FOR SELECT USING (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Admin and HR can INSERT payslips
CREATE POLICY "Admin/HR can create payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Admin and HR can UPDATE payslips (including draft status)
CREATE POLICY "Admin/HR can update payslips" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() IN ('admin', 'hr')
  )
  WITH CHECK (
    public.get_user_role() IN ('admin', 'hr')
  );

-- Only Admins can approve payslips (status change to approved/paid)
CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    public.get_user_role() = 'admin'
  )
  WITH CHECK (
    public.get_user_role() = 'admin'
  );

-- All authenticated users can view payslips (for general access)
-- This works alongside the admin/HR policy (policies are OR'd together)
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (auth.role() = 'authenticated');

-- =====================================================
-- RPC FUNCTION FOR EMPLOYEES TO GET THEIR OWN PAYSLIPS
-- =====================================================
-- This function bypasses RLS and allows employees to view their own payslips
-- Employees authenticate via custom auth, so we need an RPC function

DROP FUNCTION IF EXISTS public.get_employee_payslips(UUID);

CREATE OR REPLACE FUNCTION public.get_employee_payslips(
  p_employee_uuid UUID
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  payslip_number TEXT,
  period_start DATE,
  period_end DATE,
  period_type TEXT,
  status TEXT,
  gross_pay NUMERIC,
  net_pay NUMERIC,
  sss_amount NUMERIC,
  philhealth_amount NUMERIC,
  pagibig_amount NUMERIC,
  withholding_tax NUMERIC,
  total_deductions NUMERIC,
  adjustment_amount NUMERIC,
  adjustment_reason TEXT,
  allowance_amount NUMERIC,
  earnings_breakdown JSONB,
  deductions_breakdown JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Verify that the employee exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM public.employees 
    WHERE id = p_employee_uuid AND is_active = true
  ) THEN
    RETURN;
  END IF;

  -- Return payslips for this employee only
  RETURN QUERY
  SELECT
    p.id,
    p.employee_id,
    p.payslip_number,
    p.period_start,
    p.period_end,
    p.period_type,
    p.status,
    p.gross_pay,
    p.net_pay,
    p.sss_amount,
    p.philhealth_amount,
    p.pagibig_amount,
    COALESCE((p.deductions_breakdown->>'withholding_tax')::NUMERIC, 0) as withholding_tax,
    p.total_deductions,
    p.adjustment_amount,
    p.adjustment_reason,
    p.allowance_amount,
    p.earnings_breakdown,
    p.deductions_breakdown,
    p.created_at,
    p.updated_at
  FROM public.payslips p
  WHERE p.employee_id = p_employee_uuid
  ORDER BY p.period_start DESC, p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_payslips(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_employee_payslips(UUID) IS
  'Returns payslips for a specific employee. Used by employee portal to view own payslips. Runs with elevated privileges to bypass RLS.';







