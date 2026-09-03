-- Addbell ABAC: pages + functions capabilities and per-user grants.
-- Role remains a starter-pack label; grants are the access source of truth.

CREATE TABLE IF NOT EXISTS public.addbell_capabilities (
  key text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('page', 'function')),
  label text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.addbell_user_grants (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  capability_key text NOT NULL REFERENCES public.addbell_capabilities(key) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  granted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, capability_key)
);

CREATE INDEX IF NOT EXISTS addbell_user_grants_key_idx
  ON public.addbell_user_grants (capability_key);

CREATE INDEX IF NOT EXISTS addbell_user_grants_user_idx
  ON public.addbell_user_grants (user_id);

COMMENT ON TABLE public.addbell_capabilities IS
  'ABAC catalog: page:* navigable screens, fn:* actions.';
COMMENT ON TABLE public.addbell_user_grants IS
  'ABAC grants per user. Source of truth for Access Control.';

ALTER TABLE public.addbell_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addbell_user_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS addbell_capabilities_select_authenticated ON public.addbell_capabilities;
CREATE POLICY addbell_capabilities_select_authenticated
  ON public.addbell_capabilities
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS addbell_user_grants_select_own ON public.addbell_user_grants;
CREATE POLICY addbell_user_grants_select_own
  ON public.addbell_user_grants
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins (profiles.role = admin) can read all grants for Settings UI.
DROP POLICY IF EXISTS addbell_user_grants_select_admin ON public.addbell_user_grants;
CREATE POLICY addbell_user_grants_select_admin
  ON public.addbell_user_grants
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND lower(trim(p.role)) = 'admin'
    )
  );

-- Writes go through service-role API (no direct client INSERT/UPDATE/DELETE policies).

GRANT SELECT ON public.addbell_capabilities TO authenticated;
GRANT SELECT ON public.addbell_user_grants TO authenticated;
GRANT ALL ON public.addbell_capabilities TO service_role;
GRANT ALL ON public.addbell_user_grants TO service_role;

-- Seed catalog (pages + create/update/delete functions per module).
INSERT INTO public.addbell_capabilities (key, kind, label, description, sort_order) VALUES
  ('page:dashboard', 'page', 'Dashboard', 'Executive and workforce dashboards', 0),
  ('fn:dashboard.create', 'function', 'Dashboard · create', 'create on Dashboard', 1),
  ('fn:dashboard.update', 'function', 'Dashboard · update', 'update on Dashboard', 2),
  ('fn:dashboard.delete', 'function', 'Dashboard · delete', 'delete on Dashboard', 3),
  ('page:employees', 'page', 'Employees', 'Employee directory and management', 4),
  ('fn:employees.create', 'function', 'Employees · create', 'create on Employees', 5),
  ('fn:employees.update', 'function', 'Employees · update', 'update on Employees', 6),
  ('fn:employees.delete', 'function', 'Employees · delete', 'delete on Employees', 7),
  ('page:loans', 'page', 'Loans', 'Employee loan management', 8),
  ('fn:loans.create', 'function', 'Loans · create', 'create on Loans', 9),
  ('fn:loans.update', 'function', 'Loans · update', 'update on Loans', 10),
  ('fn:loans.delete', 'function', 'Loans · delete', 'delete on Loans', 11),
  ('page:payslips', 'page', 'Payslips', 'Payroll and payslip generation', 12),
  ('fn:payslips.create', 'function', 'Payslips · create', 'create on Payslips', 13),
  ('fn:payslips.update', 'function', 'Payslips · update', 'update on Payslips', 14),
  ('fn:payslips.delete', 'function', 'Payslips · delete', 'delete on Payslips', 15),
  ('page:fund_requests', 'page', 'Fund Requests', 'Fund request filing and tracking', 16),
  ('fn:fund_requests.create', 'function', 'Fund Requests · create', 'create on Fund Requests', 17),
  ('fn:fund_requests.update', 'function', 'Fund Requests · update', 'update on Fund Requests', 18),
  ('fn:fund_requests.delete', 'function', 'Fund Requests · delete', 'delete on Fund Requests', 19),
  ('page:purchase_orders', 'page', 'Internal POs', 'Internal PO viewing and processing', 20),
  ('fn:purchase_orders.create', 'function', 'Internal POs · create', 'create on Internal POs', 21),
  ('fn:purchase_orders.update', 'function', 'Internal POs · update', 'update on Internal POs', 22),
  ('fn:purchase_orders.delete', 'function', 'Internal POs · delete', 'delete on Internal POs', 23),
  ('page:timesheet', 'page', 'Time Attendance', 'Attendance records and timesheet', 24),
  ('fn:timesheet.create', 'function', 'Time Attendance · create', 'create on Time Attendance', 25),
  ('fn:timesheet.update', 'function', 'Time Attendance · update', 'update on Time Attendance', 26),
  ('fn:timesheet.delete', 'function', 'Time Attendance · delete', 'delete on Time Attendance', 27),
  ('page:time_entries', 'page', 'Time Entries', 'Clock in/out entries', 28),
  ('fn:time_entries.create', 'function', 'Time Entries · create', 'create on Time Entries', 29),
  ('fn:time_entries.update', 'function', 'Time Entries · update', 'update on Time Entries', 30),
  ('fn:time_entries.delete', 'function', 'Time Entries · delete', 'delete on Time Entries', 31),
  ('page:leave_approval', 'page', 'Leave Approvals', 'Leave request management', 32),
  ('fn:leave_approval.create', 'function', 'Leave Approvals · create', 'create on Leave Approvals', 33),
  ('fn:leave_approval.update', 'function', 'Leave Approvals · update', 'update on Leave Approvals', 34),
  ('fn:leave_approval.delete', 'function', 'Leave Approvals · delete', 'delete on Leave Approvals', 35),
  ('page:overtime_approval', 'page', 'OT Approvals', 'Overtime request management', 36),
  ('fn:overtime_approval.create', 'function', 'OT Approvals · create', 'create on OT Approvals', 37),
  ('fn:overtime_approval.update', 'function', 'OT Approvals · update', 'update on OT Approvals', 38),
  ('fn:overtime_approval.delete', 'function', 'OT Approvals · delete', 'delete on OT Approvals', 39),
  ('page:failure_to_log', 'page', 'Failure to Log', 'Missed clock-in/out requests', 40),
  ('fn:failure_to_log.create', 'function', 'Failure to Log · create', 'create on Failure to Log', 41),
  ('fn:failure_to_log.update', 'function', 'Failure to Log · update', 'update on Failure to Log', 42),
  ('fn:failure_to_log.delete', 'function', 'Failure to Log · delete', 'delete on Failure to Log', 43),
  ('page:audit', 'page', 'Audit Dashboard', 'System audit logs', 44),
  ('fn:audit.create', 'function', 'Audit Dashboard · create', 'create on Audit Dashboard', 45),
  ('fn:audit.update', 'function', 'Audit Dashboard · update', 'update on Audit Dashboard', 46),
  ('fn:audit.delete', 'function', 'Audit Dashboard · delete', 'delete on Audit Dashboard', 47),
  ('page:bir_reports', 'page', 'BIR Reports', 'Tax and compliance reports', 48),
  ('fn:bir_reports.create', 'function', 'BIR Reports · create', 'create on BIR Reports', 49),
  ('fn:bir_reports.update', 'function', 'BIR Reports · update', 'update on BIR Reports', 50),
  ('fn:bir_reports.delete', 'function', 'BIR Reports · delete', 'delete on BIR Reports', 51),
  ('page:reports', 'page', 'Payroll Register', 'Payroll reports and summaries', 52),
  ('fn:reports.create', 'function', 'Payroll Register · create', 'create on Payroll Register', 53),
  ('fn:reports.update', 'function', 'Payroll Register · update', 'update on Payroll Register', 54),
  ('fn:reports.delete', 'function', 'Payroll Register · delete', 'delete on Payroll Register', 55),
  ('page:settings', 'page', 'Settings', 'System settings', 56),
  ('fn:settings.create', 'function', 'Settings · create', 'create on Settings', 57),
  ('fn:settings.update', 'function', 'Settings · update', 'update on Settings', 58),
  ('fn:settings.delete', 'function', 'Settings · delete', 'delete on Settings', 59),
  ('page:user_management', 'page', 'User Management', 'Admin user accounts and permissions', 60),
  ('fn:user_management.create', 'function', 'User Management · create', 'create on User Management', 61),
  ('fn:user_management.update', 'function', 'User Management · update', 'update on User Management', 62),
  ('fn:user_management.delete', 'function', 'User Management · delete', 'delete on User Management', 63),
  ('page:clients', 'page', 'Clients', 'Client companies and contacts', 64),
  ('fn:clients.create', 'function', 'Clients · create', 'create on Clients', 65),
  ('fn:clients.update', 'function', 'Clients · update', 'update on Clients', 66),
  ('fn:clients.delete', 'function', 'Clients · delete', 'delete on Clients', 67),
  ('page:projects', 'page', 'Projects', 'Construction projects and tracking', 68),
  ('fn:projects.create', 'function', 'Projects · create', 'create on Projects', 69),
  ('fn:projects.update', 'function', 'Projects · update', 'update on Projects', 70),
  ('fn:projects.delete', 'function', 'Projects · delete', 'delete on Projects', 71),
  ('page:vendors', 'page', 'Vendors', 'Suppliers for internal POs', 72),
  ('fn:vendors.create', 'function', 'Vendors · create', 'create on Vendors', 73),
  ('fn:vendors.update', 'function', 'Vendors · update', 'update on Vendors', 74),
  ('fn:vendors.delete', 'function', 'Vendors · delete', 'delete on Vendors', 75)
ON CONFLICT (key) DO UPDATE SET
  kind = EXCLUDED.kind,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order;
