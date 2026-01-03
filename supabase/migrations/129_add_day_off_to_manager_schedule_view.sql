-- =====================================================
-- Update get_week_schedule_for_manager to include day_off
-- =====================================================
DROP FUNCTION IF EXISTS public.get_week_schedule_for_manager(DATE, UUID, UUID);

CREATE OR REPLACE FUNCTION public.get_week_schedule_for_manager(
  p_week_start DATE,
  p_location_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  employee_name TEXT,
  schedule_date DATE,
  start_time TIME,
  end_time TIME,
  tasks TEXT,
  day_off BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.employee_id,
    e.full_name AS employee_name,
    s.schedule_date,
    s.start_time,
    s.end_time,
    s.tasks,
    COALESCE(s.day_off, false) AS day_off
  FROM public.employee_week_schedules s
  JOIN public.employees e ON e.id = s.employee_id
  WHERE s.schedule_date BETWEEN p_week_start AND (p_week_start + INTERVAL '6 days')
    AND (p_employee_id IS NULL OR s.employee_id = p_employee_id)
  ORDER BY s.schedule_date, s.start_time, employee_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_week_schedule_for_manager(DATE, UUID, UUID) TO authenticated;