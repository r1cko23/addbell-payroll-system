-- =====================================================
-- Restrict hire_date updates to Admin only
-- =====================================================

-- Guard function: block hire_date changes unless auth.role() = 'admin'
CREATE OR REPLACE FUNCTION public.prevent_non_admin_hire_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.hire_date IS DISTINCT FROM OLD.hire_date) THEN
      IF (SELECT auth.role()) IS DISTINCT FROM 'admin' THEN
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