-- =====================================================
-- FIX RLS POLICIES FOR EMPLOYEE LOCATION ASSIGNMENTS
-- =====================================================
-- Add RLS policies to allow nested queries to work properly

-- Enable RLS on employee_location_assignments if not already enabled
ALTER TABLE public.employee_location_assignments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "All authenticated users can view location assignments" ON public.employee_location_assignments;
DROP POLICY IF EXISTS "HR/Admin can manage location assignments" ON public.employee_location_assignments;

-- Allow all authenticated users to view location assignments
-- This is needed for nested queries in employees table
-- Using true allows the nested query to work properly
CREATE POLICY "All authenticated users can view location assignments" ON public.employee_location_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
    )
  );

-- HR and Admin can manage location assignments
CREATE POLICY "HR/Admin can manage location assignments" ON public.employee_location_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- ENSURE OFFICE LOCATIONS HAS PROPER RLS
-- =====================================================
-- Make sure office_locations table has proper RLS policies

-- Enable RLS if not already enabled
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "All authenticated users can view office locations" ON public.office_locations;
DROP POLICY IF EXISTS "HR/Admin can manage office locations" ON public.office_locations;

-- Allow all authenticated users to view office locations
-- This is needed for nested queries
-- Using true allows the nested query to work properly
CREATE POLICY "All authenticated users can view office locations" ON public.office_locations
  FOR SELECT USING (true);

-- HR and Admin can manage office locations
CREATE POLICY "HR/Admin can manage office locations" ON public.office_locations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON POLICY "All authenticated users can view location assignments" ON public.employee_location_assignments IS 
  'Allows authenticated users to view location assignments for nested queries in employees table';
COMMENT ON POLICY "All authenticated users can view office locations" ON public.office_locations IS 
  'Allows authenticated users to view office locations for nested queries';
