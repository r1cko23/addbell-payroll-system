-- =====================================================
-- 137: Improve Employee Audit Log Descriptions
-- =====================================================
-- This migration improves audit log descriptions when employees are deactivated/activated
-- by creating a more descriptive audit log entry that includes employee name and ID
-- =====================================================

-- Function to create descriptive audit logs for employee status changes
CREATE OR REPLACE FUNCTION log_employee_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id TEXT;
  v_full_name TEXT;
  v_action_description TEXT;
BEGIN
  -- Get employee details for better audit description
  SELECT employee_id, full_name INTO v_employee_id, v_full_name
  FROM public.employees
  WHERE id = NEW.id;

  -- Only log if is_active status changed
  IF OLD.is_active IS DISTINCT FROM NEW.is_active THEN
    -- Determine action description
    IF NEW.is_active = false THEN
      v_action_description := format('Employee Deactivated: %s (%s)',
        COALESCE(v_full_name, 'Unknown'),
        COALESCE(v_employee_id, 'Unknown'));
    ELSE
      v_action_description := format('Employee Activated: %s (%s)',
        COALESCE(v_full_name, 'Unknown'),
        COALESCE(v_employee_id, 'Unknown'));
    END IF;

    -- Insert descriptive audit log
    INSERT INTO public.audit_logs (
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data,
      created_at
    ) VALUES (
      NEW.updated_by,
      'UPDATE',
      'employees',
      NEW.id,
      jsonb_build_object(
        'is_active', OLD.is_active,
        'employee_id', v_employee_id,
        'full_name', v_full_name,
        'action_description', v_action_description
      ),
      jsonb_build_object(
        'is_active', NEW.is_active,
        'employee_id', v_employee_id,
        'full_name', v_full_name,
        'action_description', v_action_description
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_log_employee_status_change ON public.employees;

-- Create trigger for employee status changes
CREATE TRIGGER trigger_log_employee_status_change
  AFTER UPDATE ON public.employees
  FOR EACH ROW
  WHEN (OLD.is_active IS DISTINCT FROM NEW.is_active)
  EXECUTE FUNCTION log_employee_status_change();

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON FUNCTION log_employee_status_change() IS 'Creates descriptive audit logs when employee is_active status changes, including employee name and ID in the description';