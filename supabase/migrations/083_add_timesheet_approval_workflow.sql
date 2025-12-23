-- =====================================================
-- MIGRATION: Add Timesheet Finalization Workflow
-- =====================================================
-- Simplifies timesheet workflow: draft -> finalized
-- HR can review and finalize timesheets before payslip generation

-- Check if table exists first
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'weekly_attendance') THEN
    -- Update status check constraint to include finalized status
    ALTER TABLE public.weekly_attendance
      DROP CONSTRAINT IF EXISTS weekly_attendance_status_check;

    ALTER TABLE public.weekly_attendance
      ADD CONSTRAINT weekly_attendance_status_check 
      CHECK (status IN ('draft', 'finalized'));

    -- Add finalization tracking fields
    ALTER TABLE public.weekly_attendance
      ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS finalized_by UUID REFERENCES public.users(id);

    -- Add comments
    COMMENT ON COLUMN public.weekly_attendance.status IS 'Timesheet status: draft (editable, can be reviewed), finalized (locked for payroll)';
    COMMENT ON COLUMN public.weekly_attendance.finalized_at IS 'When timesheet was finalized';
    COMMENT ON COLUMN public.weekly_attendance.finalized_by IS 'User who finalized the timesheet';

    -- Create index for faster queries (handle both column name scenarios)
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_attendance' AND column_name = 'period_start') THEN
      CREATE INDEX IF NOT EXISTS idx_weekly_attendance_status 
        ON public.weekly_attendance(status, period_start);
    ELSIF EXISTS (SELECT FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'weekly_attendance' AND column_name = 'week_start_date') THEN
      CREATE INDEX IF NOT EXISTS idx_weekly_attendance_status 
        ON public.weekly_attendance(status, week_start_date);
    END IF;

    -- Update existing records to 'draft' if they are currently 'draft' or NULL
    UPDATE public.weekly_attendance
    SET status = 'draft'
    WHERE (status = 'draft' OR status IS NULL) AND status != 'finalized';

    -- Keep finalized records as finalized (no change needed)
  END IF;
END $$;






