-- =====================================================
-- GET EMPLOYEE SIL CREDITS FUNCTION
-- =====================================================
-- Secure helper for employee portal to get SIL credits
-- This bypasses RLS and works for employee portal users

DROP FUNCTION IF EXISTS public.get_employee_sil_credits(UUID);

CREATE OR REPLACE FUNCTION public.get_employee_sil_credits(
  p_employee_uuid UUID
)
RETURNS TABLE (
  sil_credits NUMERIC
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(e.sil_credits, 0) AS sil_credits
  FROM public.employees e
  WHERE e.id = p_employee_uuid
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_employee_sil_credits(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.get_employee_sil_credits(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_employee_sil_credits(UUID) IS
  'Returns SIL credits for an employee. Runs with elevated privileges to bypass RLS for employee portal access.';