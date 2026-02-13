-- =====================================================
-- CONSTRUCTION PROJECT MANAGEMENT SYSTEM
-- =====================================================
-- This migration adds project management capabilities for construction companies
-- Features: Clients, Projects, Progress Tracking, Cost Tracking (Material/Manpower/Machine),
--          Project-based Time Tracking, Project Assignments

-- =====================================================
-- CLIENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_code TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  is_active BOOLEAN DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- =====================================================
-- PROJECTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_code TEXT UNIQUE NOT NULL,
  project_name TEXT NOT NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  project_location TEXT,
  start_date DATE,
  target_end_date DATE,
  actual_end_date DATE,
  project_status TEXT DEFAULT 'planning' CHECK (project_status IN ('planning', 'active', 'on-hold', 'completed', 'cancelled')),
  progress_percentage DECIMAL(5, 2) DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  budget_amount DECIMAL(15, 2),
  contract_amount DECIMAL(15, 2),
  project_manager_id UUID REFERENCES public.users(id),
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- =====================================================
-- PROJECT PROGRESS TRACKING TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  progress_date DATE NOT NULL DEFAULT CURRENT_DATE,
  progress_percentage DECIMAL(5, 2) NOT NULL CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  notes TEXT,
  milestone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- =====================================================
-- PROJECT ASSIGNMENTS (Employees assigned to projects)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  role TEXT, -- e.g., 'Foreman', 'Worker', 'Engineer', 'Supervisor'
  start_date DATE NOT NULL,
  end_date DATE, -- NULL means still assigned
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(project_id, employee_id, start_date)
);

-- =====================================================
-- PROJECT TIME ENTRIES (Clock in/out per project)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_time_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  clock_in TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out TIMESTAMP WITH TIME ZONE,
  regular_hours DECIMAL(10, 2) DEFAULT 0,
  overtime_hours DECIMAL(10, 2) DEFAULT 0,
  night_diff_hours DECIMAL(10, 2) DEFAULT 0,
  total_hours DECIMAL(10, 2) DEFAULT 0,
  notes TEXT,
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- =====================================================
-- PROJECT COSTS TABLE (Material, Manpower, Machine)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('material', 'manpower', 'machine', 'other')),
  cost_category TEXT, -- e.g., 'Cement', 'Steel', 'Equipment Rental', 'Labor'
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2),
  unit TEXT, -- e.g., 'bags', 'kg', 'hours', 'days'
  unit_cost DECIMAL(10, 2),
  total_cost DECIMAL(15, 2) NOT NULL,
  cost_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vendor_supplier TEXT,
  invoice_number TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- =====================================================
-- PROJECT MANPOWER COSTS (Detailed breakdown from time entries)
-- =====================================================
CREATE TABLE IF NOT EXISTS public.project_manpower_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES public.project_time_entries(id) ON DELETE SET NULL,
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  regular_hours DECIMAL(10, 2) DEFAULT 0,
  overtime_hours DECIMAL(10, 2) DEFAULT 0,
  night_diff_hours DECIMAL(10, 2) DEFAULT 0,
  regular_cost DECIMAL(15, 2) DEFAULT 0,
  overtime_cost DECIMAL(15, 2) DEFAULT 0,
  night_diff_cost DECIMAL(15, 2) DEFAULT 0,
  total_cost DECIMAL(15, 2) NOT NULL,
  is_invoiced BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_clients_client_code ON public.clients(client_code);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON public.clients(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_client_id ON public.projects(client_id);
CREATE INDEX IF NOT EXISTS idx_projects_project_code ON public.projects(project_code);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(project_status);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON public.projects(is_active);
CREATE INDEX IF NOT EXISTS idx_project_progress_project_id ON public.project_progress(project_id);
CREATE INDEX IF NOT EXISTS idx_project_progress_date ON public.project_progress(progress_date);
CREATE INDEX IF NOT EXISTS idx_project_assignments_project_id ON public.project_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_employee_id ON public.project_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_assignments_is_active ON public.project_assignments(is_active);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_project_id ON public.project_time_entries(project_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_employee_id ON public.project_time_entries(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_time_entries_clock_in ON public.project_time_entries(clock_in);
CREATE INDEX IF NOT EXISTS idx_project_costs_project_id ON public.project_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_costs_cost_type ON public.project_costs(cost_type);
CREATE INDEX IF NOT EXISTS idx_project_costs_cost_date ON public.project_costs(cost_date);
CREATE INDEX IF NOT EXISTS idx_project_manpower_costs_project_id ON public.project_manpower_costs(project_id);
CREATE INDEX IF NOT EXISTS idx_project_manpower_costs_employee_id ON public.project_manpower_costs(employee_id);
CREATE INDEX IF NOT EXISTS idx_project_manpower_costs_period ON public.project_manpower_costs(period_start_date, period_end_date);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_manpower_costs ENABLE ROW LEVEL SECURITY;

-- Clients policies
CREATE POLICY "All authenticated users can view active clients" ON public.clients
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "HR and Admin can view all clients" ON public.clients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "HR and Admin can manage clients" ON public.clients
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Projects policies
CREATE POLICY "All authenticated users can view active projects" ON public.projects
  FOR SELECT USING (auth.role() = 'authenticated' AND is_active = true);

CREATE POLICY "HR and Admin can view all projects" ON public.projects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "HR and Admin can manage projects" ON public.projects
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Project progress policies
CREATE POLICY "All authenticated users can view project progress" ON public.project_progress
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage project progress" ON public.project_progress
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Project assignments policies
CREATE POLICY "All authenticated users can view project assignments" ON public.project_assignments
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Employees can view their own assignments" ON public.project_assignments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = employee_id AND id IN (
        SELECT employee_id FROM public.employees WHERE id = employee_id
      )
    )
  );

CREATE POLICY "HR and Admin can manage project assignments" ON public.project_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Project time entries policies
CREATE POLICY "Employees can view their own time entries" ON public.project_time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = employee_id AND id IN (
        SELECT id FROM public.employees WHERE id = employee_id
      )
    )
  );

CREATE POLICY "Employees can create their own time entries" ON public.project_time_entries
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = employee_id AND id IN (
        SELECT id FROM public.employees WHERE id = employee_id
      )
    )
  );

CREATE POLICY "Employees can update their own pending time entries" ON public.project_time_entries
  FOR UPDATE USING (
    is_approved = false AND
    EXISTS (
      SELECT 1 FROM public.employees
      WHERE id = employee_id AND id IN (
        SELECT id FROM public.employees WHERE id = employee_id
      )
    )
  );

CREATE POLICY "HR and Admin can view all time entries" ON public.project_time_entries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "HR and Admin can manage time entries" ON public.project_time_entries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Project costs policies
CREATE POLICY "All authenticated users can view project costs" ON public.project_costs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage project costs" ON public.project_costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Project manpower costs policies
CREATE POLICY "All authenticated users can view project manpower costs" ON public.project_manpower_costs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage project manpower costs" ON public.project_manpower_costs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update project progress percentage
CREATE OR REPLACE FUNCTION update_project_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the project's progress_percentage to the latest progress entry
  UPDATE public.projects
  SET progress_percentage = (
    SELECT progress_percentage
    FROM public.project_progress
    WHERE project_id = NEW.project_id
    ORDER BY progress_date DESC, created_at DESC
    LIMIT 1
  )
  WHERE id = NEW.project_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update project progress
CREATE TRIGGER update_project_progress_trigger
  AFTER INSERT OR UPDATE ON public.project_progress
  FOR EACH ROW
  EXECUTE FUNCTION update_project_progress();

-- Function to calculate total hours from clock in/out
CREATE OR REPLACE FUNCTION calculate_time_entry_hours()
RETURNS TRIGGER AS $$
DECLARE
  total_hours_calc DECIMAL(10, 2);
BEGIN
  IF NEW.clock_out IS NOT NULL AND NEW.clock_in IS NOT NULL THEN
    -- Calculate total hours
    total_hours_calc := EXTRACT(EPOCH FROM (NEW.clock_out - NEW.clock_in)) / 3600.0;
    NEW.total_hours := total_hours_calc;

    -- For now, set regular_hours = total_hours (can be refined later with schedule logic)
    IF NEW.regular_hours = 0 THEN
      NEW.regular_hours := total_hours_calc;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate hours
CREATE TRIGGER calculate_time_entry_hours_trigger
  BEFORE INSERT OR UPDATE ON public.project_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION calculate_time_entry_hours();

-- Function to calculate project total costs
CREATE OR REPLACE FUNCTION get_project_total_costs(project_uuid UUID)
RETURNS TABLE (
  material_cost DECIMAL(15, 2),
  manpower_cost DECIMAL(15, 2),
  machine_cost DECIMAL(15, 2),
  other_cost DECIMAL(15, 2),
  total_cost DECIMAL(15, 2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN cost_type = 'material' THEN total_cost ELSE 0 END), 0) as material_cost,
    COALESCE(SUM(CASE WHEN cost_type = 'manpower' THEN total_cost ELSE 0 END), 0) +
    COALESCE((SELECT SUM(total_cost) FROM public.project_manpower_costs WHERE project_id = project_uuid), 0) as manpower_cost,
    COALESCE(SUM(CASE WHEN cost_type = 'machine' THEN total_cost ELSE 0 END), 0) as machine_cost,
    COALESCE(SUM(CASE WHEN cost_type = 'other' THEN total_cost ELSE 0 END), 0) as other_cost,
    COALESCE(SUM(total_cost), 0) +
    COALESCE((SELECT SUM(total_cost) FROM public.project_manpower_costs WHERE project_id = project_uuid), 0) as total_cost
  FROM public.project_costs
  WHERE project_id = project_uuid;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_progress_updated_at BEFORE UPDATE ON public.project_progress
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_assignments_updated_at BEFORE UPDATE ON public.project_assignments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_time_entries_updated_at BEFORE UPDATE ON public.project_time_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_costs_updated_at BEFORE UPDATE ON public.project_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_manpower_costs_updated_at BEFORE UPDATE ON public.project_manpower_costs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();