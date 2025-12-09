-- =====================================================
-- RPC: get_my_overtime_requests (returns OT plus docs)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_my_overtime_requests(p_employee_id UUID)
RETURNS TABLE (
  id UUID,
  employee_id UUID,
  account_manager_id UUID,
  ot_date DATE,
  start_time TIME,
  end_time TIME,
  total_hours NUMERIC,
  reason TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  overtime_documents JSONB
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    o.id,
    o.employee_id,
    o.account_manager_id,
    o.ot_date,
    o.start_time,
    o.end_time,
    o.total_hours,
    o.reason,
    o.status,
    o.created_at,
    o.updated_at,
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object(
          'id', d.id,
          'file_name', d.file_name,
          'file_size', d.file_size
        ))
        FROM public.overtime_documents d
        WHERE d.overtime_request_id = o.id
      ),
      '[]'::jsonb
    ) AS overtime_documents
  FROM public.overtime_requests o
  WHERE o.employee_id = p_employee_id
  ORDER BY o.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_overtime_requests(UUID) TO anon, authenticated;
