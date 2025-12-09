-- =====================================================
-- Replace get_offset_balance_rpc to use employees.offset_hours (OT-funded)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_offset_balance_rpc(p_employee_uuid UUID)
RETURNS NUMERIC
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(offset_hours, 0)
  FROM public.employees
  WHERE id = p_employee_uuid;
$$;

GRANT EXECUTE ON FUNCTION public.get_offset_balance_rpc(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_offset_balance_rpc(UUID) TO anon;
