-- Per-user salary and clock-access flags on profiles (HR can be restricted).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS can_access_salary boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_manage_clock_access boolean NOT NULL DEFAULT false;

-- Existing management and full HR keep broad access.
UPDATE public.profiles
SET
  can_access_salary = true,
  can_manage_clock_access = true
WHERE role IN ('admin', 'upper_management', 'hr');

-- Restricted HR editor: employees only, no salary or clock management.
UPDATE public.profiles
SET
  role = 'hr',
  full_name = 'Kandace Abregana',
  can_access_salary = false,
  can_manage_clock_access = false,
  permissions = '{
    "dashboard": {"create": false, "read": false, "update": false, "delete": false},
    "employees": {"create": false, "read": true, "update": true, "delete": false},
    "loans": {"create": false, "read": false, "update": false, "delete": false},
    "payslips": {"create": false, "read": false, "update": false, "delete": false},
    "fund_requests": {"create": false, "read": false, "update": false, "delete": false},
    "purchase_orders": {"create": false, "read": false, "update": false, "delete": false},
    "timesheet": {"create": false, "read": false, "update": false, "delete": false},
    "time_entries": {"create": false, "read": false, "update": false, "delete": false},
    "leave_approval": {"create": false, "read": false, "update": false, "delete": false},
    "overtime_approval": {"create": false, "read": false, "update": false, "delete": false},
    "failure_to_log": {"create": false, "read": false, "update": false, "delete": false},
    "audit": {"create": false, "read": false, "update": false, "delete": false},
    "bir_reports": {"create": false, "read": false, "update": false, "delete": false},
    "reports": {"create": false, "read": false, "update": false, "delete": false},
    "settings": {"create": false, "read": false, "update": false, "delete": false},
    "user_management": {"create": false, "read": false, "update": false, "delete": false},
    "clients": {"create": false, "read": false, "update": false, "delete": false},
    "projects": {"create": false, "read": false, "update": false, "delete": false},
    "vendors": {"create": false, "read": false, "update": false, "delete": false}
  }'::jsonb,
  updated_at = now()
WHERE id = '32999c00-8860-419b-b205-252d60bdad19'
  AND email = 'hraddbell@gmail.com';
