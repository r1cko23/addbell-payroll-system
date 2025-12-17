-- =====================================================
-- Active parental leaves (maternity/paternity) helper RPC
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_active_parental_leaves()
RETURNS TABLE (
  leave_id UUID,
  employee_id UUID,
  employee_name TEXT,
  leave_type TEXT,
  start_date DATE,
  end_date DATE,
  total_days NUMERIC
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lr.id AS leave_id,
    lr.employee_id,
    e.full_name AS employee_name,
    lr.leave_type,
    lr.start_date,
    lr.end_date,
    lr.total_days
  FROM public.leave_requests lr
  JOIN public.employees e ON e.id = lr.employee_id
  WHERE lr.leave_type IN ('Maternity Leave', 'Paternity Leave')
    AND lr.status = 'approved_by_hr'
    AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_parental_leaves() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_parental_leaves() TO anon;
