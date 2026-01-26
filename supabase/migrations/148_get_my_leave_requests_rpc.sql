-- =====================================================
-- get_my_leave_requests RPC for employee portal
-- =====================================================
-- Employee portal uses anon (no auth.uid()). leave_requests RLS
-- allows SELECT only for get_user_role() admin/hr, can_user_view_leave_request,
-- or auth.uid() = employee_id. auth.uid() is null for anon, and employee_id
-- is employees.id (UUID), so employees never pass. This RPC bypasses RLS
-- (SECURITY DEFINER) and returns only the requesting employee's rows.
-- Trust: client passes p_employee_uuid from employee_session (same as .eq() before).

CREATE OR REPLACE FUNCTION get_my_leave_requests(p_employee_uuid UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_agg(
    to_jsonb(lr) || jsonb_build_object(
      'leave_request_documents',
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object('id', d.id, 'file_name', d.file_name, 'file_type', d.file_type, 'file_size', d.file_size))
        FROM leave_request_documents d
        WHERE d.leave_request_id = lr.id
      ), '[]'::jsonb)
    )
    ORDER BY lr.created_at DESC NULLS LAST
  )
  INTO v_result
  FROM leave_requests lr
  WHERE lr.employee_id = p_employee_uuid;

  RETURN COALESCE(v_result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION get_my_leave_requests(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_my_leave_requests(UUID) TO authenticated;

COMMENT ON FUNCTION get_my_leave_requests IS
  'Returns leave requests for the given employee (by employees.id). Used by employee portal; bypasses RLS because anon has no auth.uid().';
