  -- =====================================================
  -- TIME CLOCK ENTRIES TABLE
  -- =====================================================
  -- This table records every clock in/out action by employees
  CREATE TABLE public.time_clock_entries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    
    -- Clock In Details
    clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    clock_in_location TEXT, -- Optional: GPS coordinates or location name
    clock_in_ip TEXT, -- Optional: IP address for audit
    clock_in_device TEXT, -- Optional: Device info (mobile/desktop)
    clock_in_photo TEXT, -- Optional: Photo URL for verification
    
    -- Clock Out Details
    clock_out_time TIMESTAMP WITH TIME ZONE,
    clock_out_location TEXT,
    clock_out_ip TEXT,
    clock_out_device TEXT,
    clock_out_photo TEXT,
    
    -- Calculated Fields
    total_hours DECIMAL(10, 2), -- Auto-calculated when clocked out
    regular_hours DECIMAL(10, 2), -- Hours within regular shift
    overtime_hours DECIMAL(10, 2), -- Hours beyond regular shift
    night_diff_hours DECIMAL(10, 2), -- Hours worked 10PM-6AM
    
    -- Status
    status TEXT DEFAULT 'clocked_in' CHECK (status IN ('clocked_in', 'clocked_out', 'approved', 'rejected')),
    
    -- Notes & Adjustments
    employee_notes TEXT, -- Employee can add notes on clock in/out
    hr_notes TEXT, -- HR can add notes for review
    is_manual_entry BOOLEAN DEFAULT false, -- Mark if HR manually added this
    
    -- Break Time (Optional)
    break_start_time TIMESTAMP WITH TIME ZONE,
    break_end_time TIMESTAMP WITH TIME ZONE,
    total_break_minutes INTEGER DEFAULT 0,
    
    -- Audit
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    approved_by UUID REFERENCES public.users(id),
    approved_at TIMESTAMP WITH TIME ZONE
  );

  -- =====================================================
  -- EMPLOYEE SCHEDULES TABLE (Optional - for shift tracking)
  -- =====================================================
  CREATE TABLE public.employee_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    
    -- Schedule Details
    day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
    shift_start_time TIME NOT NULL, -- e.g., 08:00
    shift_end_time TIME NOT NULL, -- e.g., 17:00
    break_duration_minutes INTEGER DEFAULT 60, -- Default 1 hour lunch
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(employee_id, day_of_week)
  );

  -- =====================================================
  -- INDEXES FOR PERFORMANCE
  -- =====================================================
  CREATE INDEX idx_time_clock_employee ON public.time_clock_entries(employee_id);
  CREATE INDEX idx_time_clock_date ON public.time_clock_entries(clock_in_time);
  CREATE INDEX idx_time_clock_status ON public.time_clock_entries(status);
  CREATE INDEX idx_employee_schedules_employee ON public.employee_schedules(employee_id);

  -- =====================================================
  -- ROW LEVEL SECURITY (RLS) POLICIES
  -- =====================================================
  ALTER TABLE public.time_clock_entries ENABLE ROW LEVEL SECURITY;
  ALTER TABLE public.employee_schedules ENABLE ROW LEVEL SECURITY;

  -- Employees can view their own time clock entries
  CREATE POLICY "Employees can view own time entries" ON public.time_clock_entries
    FOR SELECT USING (true); -- Will be refined when employee login is added

  -- HR and Admin can view all time clock entries
  CREATE POLICY "HR/Admin can view all time entries" ON public.time_clock_entries
    FOR SELECT USING (true);

  -- HR and Admin can insert/update time clock entries
  CREATE POLICY "HR/Admin can manage time entries" ON public.time_clock_entries
    FOR ALL USING (true);

  -- Employee schedules - HR/Admin can manage
  CREATE POLICY "HR/Admin can manage schedules" ON public.employee_schedules
    FOR ALL USING (true);

  -- =====================================================
  -- FUNCTIONS FOR AUTO-CALCULATION
  -- =====================================================

  -- Function to calculate hours when clocking out
  CREATE OR REPLACE FUNCTION calculate_time_clock_hours()
  RETURNS TRIGGER AS $$
  DECLARE
    total_minutes INTEGER;
    work_minutes INTEGER;
    shift_start TIME;
    shift_end TIME;
    night_minutes INTEGER;
  BEGIN
    -- Only calculate if clock_out_time is set and clock_in_time exists
    IF NEW.clock_out_time IS NOT NULL AND NEW.clock_in_time IS NOT NULL THEN
      -- Calculate total minutes worked
      total_minutes := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 60;
      
      -- Subtract break time
      work_minutes := total_minutes - COALESCE(NEW.total_break_minutes, 0);
      
      -- Convert to hours
      NEW.total_hours := ROUND(work_minutes / 60.0, 2);
      
      -- Get employee's schedule for this day (if exists)
      SELECT 
        es.shift_start_time, 
        es.shift_end_time
      INTO shift_start, shift_end
      FROM public.employee_schedules es
      WHERE es.employee_id = NEW.employee_id
        AND es.day_of_week = EXTRACT(DOW FROM NEW.clock_in_time)
        AND es.is_active = true
      LIMIT 1;
      
      -- Calculate regular vs overtime hours
      IF shift_start IS NOT NULL AND shift_end IS NOT NULL THEN
        -- Calculate expected shift duration in hours
        DECLARE
          shift_duration DECIMAL(10,2);
          break_hours DECIMAL(10,2);
          expected_hours DECIMAL(10,2);
        BEGIN
          shift_duration := EXTRACT(EPOCH FROM (shift_end::TIME - shift_start::TIME)) / 3600;
          break_hours := COALESCE(NEW.total_break_minutes, 0) / 60.0;
          expected_hours := shift_duration - break_hours;
          
          -- If worked more than expected, it's overtime
          IF NEW.total_hours > expected_hours THEN
            NEW.regular_hours := expected_hours;
            NEW.overtime_hours := NEW.total_hours - expected_hours;
          ELSE
            NEW.regular_hours := NEW.total_hours;
            NEW.overtime_hours := 0;
          END IF;
        END;
      ELSE
        -- No schedule defined, assume first 8 hours are regular
        IF NEW.total_hours > 8 THEN
          NEW.regular_hours := 8;
          NEW.overtime_hours := NEW.total_hours - 8;
        ELSE
          NEW.regular_hours := NEW.total_hours;
          NEW.overtime_hours := 0;
        END IF;
      END IF;
      
      -- Calculate night differential hours (10PM - 6AM)
      -- This is a simplified calculation - you may need more complex logic
      SELECT 
        ROUND(
          (EXTRACT(EPOCH FROM (
            LEAST(NEW.clock_out_time, NEW.clock_in_time + INTERVAL '1 day' - INTERVAL '1 second') -
            GREATEST(NEW.clock_in_time, NEW.clock_in_time::DATE + TIME '22:00:00')
          )) / 3600.0
          ), 2
        )
      INTO NEW.night_diff_hours
      WHERE 
        NEW.clock_in_time::TIME >= TIME '22:00:00' OR 
        NEW.clock_out_time::TIME <= TIME '06:00:00';
      
      -- Default to 0 if no night hours
      NEW.night_diff_hours := COALESCE(NEW.night_diff_hours, 0);
      
      -- Update status
      NEW.status := 'clocked_out';
    END IF;
    
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  -- Trigger to auto-calculate hours
  CREATE TRIGGER trigger_calculate_time_clock_hours
    BEFORE INSERT OR UPDATE ON public.time_clock_entries
    FOR EACH ROW
    EXECUTE FUNCTION calculate_time_clock_hours();

  -- =====================================================
  -- HELPER FUNCTION: Get employee's current clock status
  -- =====================================================
  CREATE OR REPLACE FUNCTION get_employee_clock_status(emp_id UUID)
  RETURNS TABLE (
    is_clocked_in BOOLEAN,
    last_clock_in TIMESTAMP WITH TIME ZONE,
    entry_id UUID
  ) AS $$
  BEGIN
    RETURN QUERY
    SELECT 
      (status = 'clocked_in'),
      clock_in_time,
      id
    FROM public.time_clock_entries
    WHERE employee_id = emp_id
      AND status = 'clocked_in'
    ORDER BY clock_in_time DESC
    LIMIT 1;
  END;
  $$ LANGUAGE plpgsql;

  -- =====================================================
  -- SAMPLE DATA: Default Schedules (8AM-5PM with 1hr break)
  -- =====================================================
  -- You can populate this after adding employees
  -- Example:
  -- INSERT INTO public.employee_schedules (employee_id, day_of_week, shift_start_time, shift_end_time, break_duration_minutes)
  -- VALUES 
  --   ('employee_uuid', 1, '08:00', '17:00', 60), -- Monday
  --   ('employee_uuid', 2, '08:00', '17:00', 60); -- Tuesday
  -- ...and so on