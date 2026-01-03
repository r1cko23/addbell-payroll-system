-- =====================================================
-- 069: Automatic SIL reset at start of each year
--  - Creates a function to reset all employees' SIL credits
--  - Sets up pg_cron job to run automatically on January 1st each year
-- =====================================================

-- Function to reset all employees' SIL credits for the new year
CREATE OR REPLACE FUNCTION public.reset_all_sil_credits_yearly()
RETURNS TABLE (
  employees_reset INT,
  employees_already_reset INT,
  errors INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_year INT := EXTRACT(YEAR FROM CURRENT_DATE)::int;
  v_reset_count INT := 0;
  v_already_reset_count INT := 0;
  v_error_count INT := 0;
  v_emp RECORD;
BEGIN
  -- Loop through all employees and reset their SIL credits
  FOR v_emp IN 
    SELECT id, sil_balance_year
    FROM public.employees
    WHERE sil_balance_year IS DISTINCT FROM v_current_year
  LOOP
    BEGIN
      -- Call the refresh function which handles the reset
      PERFORM public.refresh_employee_leave_balances(v_emp.id);
      
      -- Check if reset happened
      SELECT sil_balance_year INTO v_emp.sil_balance_year
      FROM public.employees
      WHERE id = v_emp.id;
      
      IF v_emp.sil_balance_year = v_current_year THEN
        v_reset_count := v_reset_count + 1;
      ELSE
        v_already_reset_count := v_already_reset_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      -- Log error but continue processing
      RAISE WARNING 'Error resetting SIL for employee %: %', v_emp.id, SQLERRM;
    END;
  END LOOP;
  
  -- Also process employees who are already in current year to ensure accrual is correct
  FOR v_emp IN 
    SELECT id
    FROM public.employees
    WHERE sil_balance_year = v_current_year
  LOOP
    BEGIN
      PERFORM public.refresh_employee_leave_balances(v_emp.id);
      v_already_reset_count := v_already_reset_count + 1;
    EXCEPTION WHEN OTHERS THEN
      v_error_count := v_error_count + 1;
      RAISE WARNING 'Error refreshing SIL for employee %: %', v_emp.id, SQLERRM;
    END;
  END LOOP;
  
  RETURN QUERY SELECT v_reset_count, v_already_reset_count, v_error_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reset_all_sil_credits_yearly() TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_all_sil_credits_yearly() TO anon;

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create pg_cron job to run on January 1st at 00:01 AM each year
-- Schedule: '1 0 1 1 *' means: At 00:01 on day-of-month 1 in January
DO $$
BEGIN
  -- Remove existing job if it exists
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sil-yearly-reset') THEN
    PERFORM cron.unschedule('sil-yearly-reset');
  END IF;
  
  -- Schedule new job
  PERFORM cron.schedule(
    'sil-yearly-reset',
    '1 0 1 1 *',
    'SELECT public.reset_all_sil_credits_yearly()'
  );
  
  RAISE NOTICE 'Scheduled pg_cron job: sil-yearly-reset to run on January 1st at 00:01 AM each year';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not schedule pg_cron job. Error: %. Please schedule manually or run reset_all_sil_credits_yearly() on January 1st.', SQLERRM;
END $$;