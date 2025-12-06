-- =====================================================
-- Add SIL to employee_leave_allocations and seed current year
-- =====================================================

-- Expand leave_type check to include SIL
ALTER TABLE public.employee_leave_allocations
  DROP CONSTRAINT IF EXISTS employee_leave_allocations_leave_type_check;
ALTER TABLE public.employee_leave_allocations
  ADD CONSTRAINT employee_leave_allocations_leave_type_check
  CHECK (leave_type = ANY (ARRAY['Maternity Leave','Paternity Leave','Off-setting','SIL']));

-- Seed SIL allocations for current year if missing; use employees.sil_credits
INSERT INTO public.employee_leave_allocations (employee_id, leave_type, allocated_days, used_days, notes)
SELECT e.id,
       'SIL',
       COALESCE(e.sil_credits, 0),
       0,
       'placeholder SIL allocation'
FROM public.employees e
WHERE NOT EXISTS (
  SELECT 1 FROM public.employee_leave_allocations a
  WHERE a.employee_id = e.id
    AND a.leave_type = 'SIL'
    AND a.year = EXTRACT(year FROM CURRENT_DATE)
);
