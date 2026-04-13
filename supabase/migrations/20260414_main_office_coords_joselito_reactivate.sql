-- Main office coordinates/address, Joselito Abella, reactivations, Addbell Main on all assigned staff.

UPDATE public.office_locations
SET
  latitude = 14.342151668281947,
  longitude = 121.0429720361694,
  address = 'B6 L26 Phase1A London St villa Olympia Brgy Maharlika San Pedro Laguna',
  updated_at = now()
WHERE name = 'Addbell Main Office';

-- New employee: Joselito Abella (company / biometric IDs follow current sequence)
INSERT INTO public.employees (
  company_id_no,
  employee_code,
  first_name,
  last_name,
  full_name,
  employee_id,
  employment_type,
  hire_date,
  employment_status,
  is_active,
  salary_basis,
  base_rate
)
SELECT
  '2025-017',
  '67',
  'JOSELITO',
  'ABELLA',
  'JOSELITO ABELLA',
  '2025-017',
  'regular',
  CURRENT_DATE,
  'active',
  true,
  'monthly',
  0
WHERE NOT EXISTS (
  SELECT 1 FROM public.employees e WHERE e.company_id_no = '2025-017'
);

-- Bundy: Main + Techlog for Joselito
INSERT INTO public.employee_location_assignments (employee_id, location_id)
SELECT e.id, ol.id
FROM public.employees e
CROSS JOIN public.office_locations ol
WHERE e.company_id_no = '2025-017'
  AND ol.name IN ('Addbell Main Office', 'Techlog Center Philippines')
ON CONFLICT (employee_id, location_id) DO NOTHING;

-- Reactivate field staff (portal + bundy)
UPDATE public.employees
SET
  is_active = true,
  employment_status = 'active',
  updated_at = now()
WHERE id IN (
  '6036f9f5-8b68-44fc-b5ef-509de621a6b1'::uuid, -- HENRY ENDRIGA SEBLOS
  'e1516b5b-9ffb-4bdf-9dfa-324f41950302'::uuid, -- EDWIN ANDRES DE CLARO
  '1c445dd1-dad6-46b3-9512-8f291956029c'::uuid, -- IAN MARIGOCIO CALINGASAN
  '7fa2efbf-e442-4511-9ba4-affbabe38fba'::uuid  -- JUSTINE JOSEPH BORJA ATIENZA
);

-- Anyone with a site assignment may also clock at Addbell Main Office
INSERT INTO public.employee_location_assignments (employee_id, location_id)
SELECT DISTINCT ela.employee_id, mo.id
FROM public.employee_location_assignments ela
CROSS JOIN public.office_locations mo
WHERE mo.name = 'Addbell Main Office'
ON CONFLICT (employee_id, location_id) DO NOTHING;
