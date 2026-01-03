-- =====================================================
-- GRANT SELECT ON EMPLOYEE SCHEDULES FOR TRIGGERS
-- =====================================================
-- calculate_time_clock_hours() reads employee_schedules to compute hours.
-- Inserts into time_clock_entries were failing (403) because authenticated
-- users lacked SELECT on employee_schedules when the trigger ran.

GRANT SELECT ON TABLE public.employee_schedules TO authenticated;