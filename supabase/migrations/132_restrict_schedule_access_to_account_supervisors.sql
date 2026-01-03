-- =====================================================
-- Restrict schedule access to client-based Account Supervisors only
-- Only Account Supervisors can view/submit their schedules via employee portal
-- =====================================================

DROP FUNCTION IF EXISTS public.get_my_week_schedule(UUID, DATE);

CREATE OR REPLACE FUNCTION public.get_my_week_schedule(p_employee_id UUID, p_week_start DATE)
RETURNS TABLE (
  id UUID,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  tasks TEXT,
  day_off BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee_type TEXT;
  v_employee_position TEXT;
  v_is_client_based_account_supervisor BOOLEAN;
BEGIN
  -- Get employee type and position
  SELECT 
    e.employee_type,
    e.position
  INTO 
    v_employee_type,
    v_employee_position
  FROM public.employees e
  WHERE e.id = p_employee_id;
  
  -- Check if employee is client-based Account Supervisor
  v_is_client_based_account_supervisor := (
    (v_employee_type = 'client-based' OR v_employee_position ILIKE '%ACCOUNT SUPERVISOR%')
  );
  
  -- Only allow client-based Account Supervisors to access their schedules
  IF NOT v_is_client_based_account_supervisor THEN
    RAISE EXCEPTION 'Schedule access is restricted to Account Supervisors only';
  END IF;
  
  -- Return schedule data
  RETURN QUERY
  SELECT
    s.id,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.tasks,
    COALESCE(s.day_off, false) AS day_off
  FROM public.employee_week_schedules s
  WHERE s.employee_id = p_employee_id
    AND s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
  ORDER BY s.schedule_date, s.start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_week_schedule(UUID, DATE) TO anon, authenticated;
