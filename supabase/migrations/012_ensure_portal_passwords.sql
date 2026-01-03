-- =====================================================
-- ENSURE PORTAL PASSWORDS ARE SET
-- =====================================================
-- This migration ensures all employees have portal passwords set
-- Default password is their employee_id

-- Update any employees without portal passwords
UPDATE public.employees
SET portal_password = employee_id
WHERE portal_password IS NULL OR portal_password = '';

-- Specifically ensure employee 2025-001 has password set
UPDATE public.employees
SET portal_password = employee_id
WHERE employee_id = '2025-001' AND (portal_password IS NULL OR portal_password = '');

-- Verify: Check if employee 2025-001 exists and has password
-- SELECT employee_id, full_name, portal_password, is_active 
-- FROM public.employees 
-- WHERE employee_id = '2025-001';