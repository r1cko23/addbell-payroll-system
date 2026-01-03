-- =====================================================
-- Restrict schedule submission for client-based Account Supervisors
-- 1. Only Account Supervisors can submit their own schedules
-- 2. Rest days can only be scheduled on Monday, Tuesday, or Wednesday
-- =====================================================

DROP FUNCTION IF EXISTS public.replace_week_schedule(UUID, DATE, JSONB);

CREATE OR REPLACE FUNCTION public.replace_week_schedule(
  p_employee_id UUID,
  p_week_start DATE,
  p_entries JSONB
)
RETURNS SETOF public.employee_week_schedules
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
  v_user_id UUID;
  v_employee_user_id UUID;
  v_employee_type TEXT;
  v_employee_position TEXT;
  v_is_client_based_account_supervisor BOOLEAN;
  v_existing INT;
  v_entry JSONB;
  v_idx INT;
  v_date DATE;
  v_start TIME;
  v_end TIME;
  v_tasks TEXT;
  v_day_off BOOLEAN;
  v_day_of_week INT;
  v_rows public.employee_week_schedules[];
  v_week_start DATE := date_trunc('week', p_week_start)::date; -- Monday
BEGIN
  -- Get current user info
  SELECT role, id INTO v_role, v_user_id FROM public.users WHERE id = (SELECT auth.uid());
  
  -- Get employee info to check if they are client-based Account Supervisor
  SELECT 
    e.employee_type,
    e.position,
    u.id
  INTO 
    v_employee_type,
    v_employee_position,
    v_employee_user_id
  FROM public.employees e
  LEFT JOIN public.users u ON u.employee_id = e.id
  WHERE e.id = p_employee_id;
  
  -- Check if employee is client-based Account Supervisor
  v_is_client_based_account_supervisor := (
    (v_employee_type = 'client-based' OR v_employee_position ILIKE '%ACCOUNT SUPERVISOR%')
  );
  
  -- If employee is client-based Account Supervisor, only they can submit their schedule
  -- (Account Managers and Admins can still edit, but regular users cannot submit for them)
  IF v_is_client_based_account_supervisor THEN
    -- Allow if:
    -- 1. User is the employee themselves (v_user_id = v_employee_user_id)
    -- 2. User is Account Manager or Admin
    IF v_user_id IS NULL OR (v_user_id != v_employee_user_id AND v_role NOT IN ('account_manager', 'admin')) THEN
      RAISE EXCEPTION 'Only Account Supervisors can submit their own schedules. Account Managers and Admins can edit schedules.';
    END IF;
  END IF;

  -- Lock existing records for isolation (ACID compliance)
  SELECT COUNT(*) INTO v_existing
  FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
  FOR UPDATE;

  -- If already exists and caller not AM/Admin, lock after Monday (current_date > Monday)
  IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
    IF CURRENT_DATE > v_week_start THEN
      RAISE EXCEPTION 'Week already submitted; edits allowed only until end of Monday';
    END IF;
  END IF;

  -- If no entries provided
  IF p_entries IS NULL OR jsonb_array_length(p_entries) = 0 THEN
    IF v_existing > 0 AND (v_role IS NULL OR v_role NOT IN ('account_manager','admin')) THEN
      RETURN QUERY
        SELECT * FROM public.employee_week_schedules
        WHERE employee_id = p_employee_id
          AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
        ORDER BY schedule_date, start_time;
      RETURN;
    END IF;
    -- Delete is safe here as we have the lock
    DELETE FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days');
    RETURN QUERY
      SELECT * FROM public.employee_week_schedules
      WHERE employee_id = p_employee_id
        AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
      ORDER BY schedule_date, start_time;
    RETURN;
  END IF;

  -- Validate entries
  FOR v_entry, v_idx IN
    SELECT val, ord FROM jsonb_array_elements(p_entries) WITH ORDINALITY AS t(val, ord)
  LOOP
    v_date := (v_entry->>'schedule_date')::date;
    v_start := NULLIF(v_entry->>'start_time', '')::time;
    v_end := NULLIF(v_entry->>'end_time', '')::time;
    v_tasks := NULLIF(v_entry->>'tasks', '');
    v_day_off := COALESCE((v_entry->>'day_off')::boolean, false);
    
    -- schedule_date is required
    IF v_date IS NULL THEN
      RAISE EXCEPTION 'Invalid schedule entry: schedule_date is required';
    END IF;
    
    -- Validate date is within the week
    IF v_date < v_week_start OR v_date > v_week_start + INTERVAL '6 days' THEN
      RAISE EXCEPTION 'schedule_date must be within the selected week (Mon-Sun)';
    END IF;
    
    -- For client-based Account Supervisors: Restrict rest days to Monday, Tuesday, Wednesday only
    -- PostgreSQL EXTRACT(DOW FROM date): Sunday=0, Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5, Saturday=6
    IF v_is_client_based_account_supervisor AND v_day_off THEN
      v_day_of_week := EXTRACT(DOW FROM v_date);
      -- Only allow Monday (1), Tuesday (2), Wednesday (3)
      IF v_day_of_week NOT IN (1, 2, 3) THEN
        RAISE EXCEPTION 'Account Supervisors can only schedule rest days on Monday, Tuesday, or Wednesday. Selected day: %', 
          CASE v_day_of_week
            WHEN 0 THEN 'Sunday'
            WHEN 4 THEN 'Thursday'
            WHEN 5 THEN 'Friday'
            WHEN 6 THEN 'Saturday'
            ELSE 'Unknown'
          END;
      END IF;
    END IF;
    
    -- If day_off is true, times should be NULL
    IF v_day_off AND (v_start IS NOT NULL OR v_end IS NOT NULL) THEN
      RAISE EXCEPTION 'Day off entries cannot have start_time or end_time';
    END IF;
    
    -- If times are provided, both must be present and valid
    IF NOT v_day_off AND ((v_start IS NOT NULL AND v_end IS NULL) OR (v_start IS NULL AND v_end IS NOT NULL)) THEN
      RAISE EXCEPTION 'Both start_time and end_time must be provided together, or both must be NULL';
    END IF;
    
    -- If both times are present, validate they are in correct order
    -- Updated error message to be more user-friendly
    IF NOT v_day_off AND v_start IS NOT NULL AND v_end IS NOT NULL AND v_start >= v_end THEN
      RAISE EXCEPTION 'The end time must be later than the start time. Please check your schedule times.';
    END IF;
    
    -- Check for overlapping entries (only if times are present and not day off)
    IF NOT v_day_off AND v_start IS NOT NULL AND v_end IS NOT NULL THEN
      IF EXISTS (
        SELECT 1
        FROM jsonb_array_elements(p_entries) WITH ORDINALITY e2(val, ord)
        WHERE e2.ord <> v_idx
          AND (e2.val->>'schedule_date')::date = v_date
          AND COALESCE((e2.val->>'day_off')::boolean, false) = false
          AND NULLIF(e2.val->>'start_time', '')::time IS NOT NULL
          AND NULLIF(e2.val->>'end_time', '')::time IS NOT NULL
          AND tsrange(
                NULLIF(e2.val->>'start_time', '')::time,
                NULLIF(e2.val->>'end_time', '')::time,
                '[)'
              ) &&
              tsrange(
                v_start,
                v_end,
                '[)'
              )
      ) THEN
        RAISE EXCEPTION 'Overlapping entries for the same day';
      END IF;
    END IF;
  END LOOP;

  -- Use UPSERT instead of DELETE+INSERT for atomicity (ACID compliance)
  -- First, delete entries not in the new set
  DELETE FROM public.employee_week_schedules
  WHERE employee_id = p_employee_id
    AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
    AND schedule_date NOT IN (
      SELECT (entry->>'schedule_date')::date
      FROM jsonb_array_elements(p_entries) entry
    );

  -- Then UPSERT the entries (atomic operation)
  INSERT INTO public.employee_week_schedules (
    employee_id, week_start, schedule_date, start_time, end_time, tasks, day_off
  )
  SELECT
    p_employee_id,
    v_week_start,
    (entry->>'schedule_date')::date,
    CASE WHEN COALESCE((entry->>'day_off')::boolean, false) THEN NULL ELSE NULLIF(entry->>'start_time', '')::time END,
    CASE WHEN COALESCE((entry->>'day_off')::boolean, false) THEN NULL ELSE NULLIF(entry->>'end_time', '')::time END,
    NULLIF(entry->>'tasks', ''),
    COALESCE((entry->>'day_off')::boolean, false)
  FROM jsonb_array_elements(p_entries) entry
  ON CONFLICT (employee_id, schedule_date)
  DO UPDATE SET
    start_time = EXCLUDED.start_time,
    end_time = EXCLUDED.end_time,
    tasks = EXCLUDED.tasks,
    day_off = EXCLUDED.day_off,
    week_start = EXCLUDED.week_start,
    updated_at = NOW()
  RETURNING * INTO v_rows;

  RETURN QUERY
    SELECT * FROM public.employee_week_schedules
    WHERE employee_id = p_employee_id
      AND schedule_date BETWEEN v_week_start AND (v_week_start + INTERVAL '6 days')
    ORDER BY schedule_date, start_time;
END;
$$;

GRANT EXECUTE ON FUNCTION public.replace_week_schedule(UUID, DATE, JSONB) TO anon, authenticated;