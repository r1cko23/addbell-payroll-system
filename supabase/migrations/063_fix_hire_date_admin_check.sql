-- =====================================================
-- 063: Fix hire_date update guard to use users.role (admin)
--      Allow service_role and RPCs with auth.uid() admin users
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_non_admin_hire_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.hire_date IS DISTINCT FROM OLD.hire_date) THEN
      -- Resolve role from users table when available
      SELECT role INTO v_role FROM public.users WHERE id = (SELECT auth.uid());

      IF v_role IS DISTINCT FROM 'admin' AND (SELECT auth.role()) IS DISTINCT FROM 'service_role' THEN
        RAISE EXCEPTION 'Only admin can update hire_date';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_hire_date_change ON public.employees;
CREATE TRIGGER trg_prevent_non_admin_hire_date_change
BEFORE UPDATE ON public.employees
FOR EACH ROW
EXECUTE FUNCTION public.prevent_non_admin_hire_date_change();