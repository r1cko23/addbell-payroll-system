ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS leave_subtype text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'leave_requests_leave_subtype_check'
  ) THEN
    ALTER TABLE public.leave_requests
    ADD CONSTRAINT leave_requests_leave_subtype_check
    CHECK (
      leave_subtype IS NULL OR
      leave_subtype IN (
        'regular_sil',
        'vacation_leave',
        'emergency_leave',
        'sick_leave',
        'others',
        'half_day_leave'
      )
    );
  END IF;
END $$;
