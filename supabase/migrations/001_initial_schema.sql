-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS & ROLES TABLE
-- =====================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'hr')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- EMPLOYEES TABLE
-- =====================================================
CREATE TABLE public.employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  rate_per_day DECIMAL(10, 2) NOT NULL,
  rate_per_hour DECIMAL(10, 2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id)
);

-- =====================================================
-- WEEKLY ATTENDANCE TABLE
-- =====================================================
CREATE TABLE public.weekly_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  attendance_data JSONB NOT NULL, -- Stores daily attendance details
  total_regular_hours DECIMAL(10, 2) DEFAULT 0,
  total_overtime_hours DECIMAL(10, 2) DEFAULT 0,
  total_night_diff_hours DECIMAL(10, 2) DEFAULT 0,
  gross_pay DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'finalized')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  UNIQUE(employee_id, week_start_date)
);

-- =====================================================
-- EMPLOYEE DEDUCTIONS TABLE
-- =====================================================
CREATE TABLE public.employee_deductions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  
  -- Recurring Weekly Deductions
  vale_amount DECIMAL(10, 2) DEFAULT 0,
  uniform_ppe_amount DECIMAL(10, 2) DEFAULT 0,
  sss_salary_loan DECIMAL(10, 2) DEFAULT 0,
  sss_calamity_loan DECIMAL(10, 2) DEFAULT 0,
  pagibig_salary_loan DECIMAL(10, 2) DEFAULT 0,
  pagibig_calamity_loan DECIMAL(10, 2) DEFAULT 0,
  
  -- Government Contributions (per cutoff)
  sss_contribution DECIMAL(10, 2) DEFAULT 0,
  philhealth_contribution DECIMAL(10, 2) DEFAULT 0,
  pagibig_contribution DECIMAL(10, 2) DEFAULT 0,
  
  -- Tax
  withholding_tax DECIMAL(10, 2) DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- PAYSLIPS TABLE
-- =====================================================
CREATE TABLE public.payslips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  payslip_number TEXT UNIQUE NOT NULL,
  week_number INTEGER NOT NULL,
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  
  -- Earnings Breakdown
  earnings_breakdown JSONB NOT NULL,
  gross_pay DECIMAL(10, 2) NOT NULL,
  
  -- Deductions
  deductions_breakdown JSONB NOT NULL,
  total_deductions DECIMAL(10, 2) DEFAULT 0,
  
  -- Government Contributions (checkbox controlled)
  apply_sss BOOLEAN DEFAULT false,
  apply_philhealth BOOLEAN DEFAULT false,
  apply_pagibig BOOLEAN DEFAULT false,
  sss_amount DECIMAL(10, 2) DEFAULT 0,
  philhealth_amount DECIMAL(10, 2) DEFAULT 0,
  pagibig_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Adjustments
  adjustment_amount DECIMAL(10, 2) DEFAULT 0,
  adjustment_reason TEXT,
  
  -- Allowance (4th week)
  allowance_amount DECIMAL(10, 2) DEFAULT 0,
  
  -- Net Pay
  net_pay DECIMAL(10, 2) NOT NULL,
  
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES public.users(id),
  approved_by UUID REFERENCES public.users(id),
  approved_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- PHILIPPINE HOLIDAYS TABLE
-- =====================================================
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  holiday_date DATE NOT NULL,
  holiday_name TEXT NOT NULL,
  holiday_type TEXT NOT NULL CHECK (holiday_type IN ('regular', 'non-working')),
  year INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- AUDIT LOG TABLE
-- =====================================================
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX idx_employees_employee_id ON public.employees(employee_id);
CREATE INDEX idx_employees_is_active ON public.employees(is_active);
CREATE INDEX idx_weekly_attendance_employee ON public.weekly_attendance(employee_id);
CREATE INDEX idx_weekly_attendance_dates ON public.weekly_attendance(week_start_date, week_end_date);
CREATE INDEX idx_payslips_employee ON public.payslips(employee_id);
CREATE INDEX idx_payslips_dates ON public.payslips(week_start_date, week_end_date);
CREATE INDEX idx_payslips_number ON public.payslips(payslip_number);
CREATE INDEX idx_holidays_date ON public.holidays(holiday_date);
CREATE INDEX idx_holidays_year ON public.holidays(year);
CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_table ON public.audit_logs(table_name);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payslips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all active users" ON public.users
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage users" ON public.users
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Employees policies
CREATE POLICY "All authenticated users can view employees" ON public.employees
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage employees" ON public.employees
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Weekly attendance policies
CREATE POLICY "All authenticated users can view attendance" ON public.weekly_attendance
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage attendance" ON public.weekly_attendance
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Employee deductions policies
CREATE POLICY "All authenticated users can view deductions" ON public.employee_deductions
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can manage deductions" ON public.employee_deductions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

-- Payslips policies
CREATE POLICY "All authenticated users can view payslips" ON public.payslips
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "HR and Admin can create/update payslips" ON public.payslips
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "HR and Admin can update draft payslips" ON public.payslips
  FOR UPDATE USING (
    status = 'draft' AND EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role IN ('admin', 'hr')
    )
  );

CREATE POLICY "Only Admins can approve payslips" ON public.payslips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Holidays policies
CREATE POLICY "All authenticated users can view holidays" ON public.holidays
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Only Admins can manage holidays" ON public.holidays
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Audit logs policies
CREATE POLICY "Only Admins can view audit logs" ON public.audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_weekly_attendance_updated_at BEFORE UPDATE ON public.weekly_attendance
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_deductions_updated_at BEFORE UPDATE ON public.employee_deductions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payslips_updated_at BEFORE UPDATE ON public.payslips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SEED DATA: Philippine Holidays 2025
-- =====================================================
INSERT INTO public.holidays (holiday_date, holiday_name, holiday_type, year) VALUES
  -- Regular Holidays
  ('2025-01-01', 'New Year''s Day', 'regular', 2025),
  ('2025-03-29', 'Maundy Thursday', 'regular', 2025),
  ('2025-03-30', 'Good Friday', 'regular', 2025),
  ('2025-04-09', 'Araw ng Kagitingan', 'regular', 2025),
  ('2025-05-01', 'Labor Day', 'regular', 2025),
  ('2025-06-12', 'Independence Day', 'regular', 2025),
  ('2025-08-25', 'National Heroes Day', 'regular', 2025),
  ('2025-11-30', 'Bonifacio Day', 'regular', 2025),
  ('2025-12-25', 'Christmas Day', 'regular', 2025),
  ('2025-12-30', 'Rizal Day', 'regular', 2025),
  
  -- Non-Working Holidays
  ('2025-02-09', 'Chinese New Year', 'non-working', 2025),
  ('2025-02-25', 'EDSA People Power Revolution', 'non-working', 2025),
  ('2025-03-31', 'Black Saturday', 'non-working', 2025),
  ('2025-08-21', 'Ninoy Aquino Day', 'non-working', 2025),
  ('2025-11-01', 'All Saints'' Day', 'non-working', 2025),
  ('2025-11-02', 'All Souls'' Day', 'non-working', 2025),
  ('2025-12-08', 'Feast of the Immaculate Conception', 'non-working', 2025),
  ('2025-12-24', 'Christmas Eve', 'non-working', 2025),
  ('2025-12-26', 'Day after Christmas', 'non-working', 2025),
  ('2025-12-31', 'New Year''s Eve', 'non-working', 2025);

