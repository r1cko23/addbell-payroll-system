-- =====================================================
-- Compatibility layer after removing employee_leave_allocations table
-- =====================================================
-- Context:
-- The old employee_leave_allocations table was removed. Some existing
-- policies/functions may still reference the relation name, leading to
-- 42P01 errors (relation does not exist) when approving leave requests.
-- This migration replaces the dropped table with a view that mirrors the
-- needed fields from the employees table, so existing references resolve
-- without reintroducing duplicated state.

-- Clean up any lingering table/policies
DROP TABLE IF EXISTS public.employee_leave_allocations CASCADE;
DROP VIEW IF EXISTS public.employee_leave_allocations;

-- Compatibility view mapped to employees (SIL is the only tracked leave)
CREATE VIEW public.employee_leave_allocations AS
SELECT
  e.id                   AS employee_id,
  'SIL'::text            AS leave_type,
  COALESCE(e.sil_credits, 0)::numeric AS allocated_days,
  0::numeric             AS used_days,
  EXTRACT(YEAR FROM CURRENT_DATE)::int AS year,
  NULL::text             AS notes
FROM public.employees e;

-- Basic access so existing selects won't fail
GRANT SELECT ON public.employee_leave_allocations TO authenticated;
GRANT SELECT ON public.employee_leave_allocations TO anon;