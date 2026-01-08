-- =====================================================
-- ADD HALF-DAY DATES SUPPORT TO LEAVE REQUESTS
-- =====================================================
-- Add column to track which dates are half-day (0.5 credits instead of 1.0)
-- This allows employees to file half-day leave requests

ALTER TABLE public.leave_requests
ADD COLUMN IF NOT EXISTS half_day_dates JSONB DEFAULT '[]'::jsonb;

-- Update constraint to allow 0.5 days (half-day)
ALTER TABLE public.leave_requests
DROP CONSTRAINT IF EXISTS leave_requests_total_days_check;

ALTER TABLE public.leave_requests
ADD CONSTRAINT leave_requests_total_days_check 
CHECK (total_days > 0);

-- Add comment
COMMENT ON COLUMN public.leave_requests.half_day_dates IS 
'Array of date strings (YYYY-MM-DD) that are half-day leaves. These dates consume 0.5 SIL credits and count as 4 hours instead of 8 hours.';

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_leave_requests_half_day_dates 
ON public.leave_requests USING GIN (half_day_dates);
