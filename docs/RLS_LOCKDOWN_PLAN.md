# RLS lockdown plan

Status: step 1 applied to production 2026-11-06 and verified (anon reads 0 rows from the 18 closed tables; staff unchanged; the `rls_disabled_in_public` advisor is clear). Step 1b applied 2026-11-06 and verified (the 8 functions are executable by `service_role` only; the anon-callable definer list dropped from 22 to 14, all kept on purpose). Step 2 applied 2026-11-06 after the bd3b75f deploy (portal reads moved to `/api/employee-portal/fund-requests` and `/api/employee-portal/holidays`; no `anon` policies remain in `public`, and anon reads 0 rows from all 9 former portal tables). Step 3 area 1 (payroll and locations, `20261106230000_rls_step3_payroll_and_locations.sql`) applied 2026-11-06 and verified per role: HR sees 35 payroll runs, operations manager and purchasing officer see 0; all staff still read office locations and holidays; location assignments are server-only. Its role-only `payroll_runs` policy was then replaced by per-user rules on `has_module_permission('payslips', …)` (`20261107090000`, `20261107100000`), which also honour `profiles.permissions` overrides. Area 2 (money and jobs, `20261106240000_rls_step3_money_and_jobs.sql`) applied 2026-11-06 and verified for 7 real accounts (purchasing officer, both HR, ops managers with and without the PO override, both employee-role logins); it adds `staff_can(module, action)` (mirrors `DEFAULT_PERMISSIONS` plus `profiles.permissions` overrides; keep the two in step) and `is_my_employee(id)`.

## Step 1b: revoke public access to unused definer functions

`supabase/migrations/20261106210000_revoke_unused_definer_rpcs.sql`

The security advisor lists 22 `SECURITY DEFINER` functions that `anon` can call over `/rest/v1/rpc`. Eight of them are never called by the app and do not check the caller: `record_time_punch`, `create_overtime_request`, `authenticate_employee`, `get_employee_portal_info`, `get_employee_today_punches`, `post_purchase_order_costs`, `get_user_permissions`, `check_geofence`. The migration revokes `EXECUTE` from `public`, `anon` and `authenticated` and keeps it for `service_role`.

Kept on purpose: the RLS helper functions (`get_my_role`, `is_hr_or_admin`, `get_my_employee_id`, `is_supervisor_of`, `get_employee_supervisor_id`) because policies call them as the caller; `is_employee_location_allowed` and `is_location_allowed` (Bundy and kiosk); `record_employee_first_login` (portal first-login route); and the four that already check `auth.uid()` (`approve_failure_to_log`, `reject_failure_to_log`, `create_purchase_order_with_items`, `reassign_client_owner`).

## The problem

27 tables in `public` have row-level security off. Supabase grants `anon` full table privileges by default, so anyone with the anon key (it ships in every page's JavaScript) can read **and update or delete** these rows without signing in, for example `fund_requests` (645 rows), `payroll_runs`, `projects` (792), `employee_location_assignments`, `office_locations`, `purchase_orders`.

Tables that already have RLS on (`employees`, `payslips`, `time_entries`, `leave_requests`, `overtime_requests`, `failure_to_log`, `fund_request_documents`, `po_masterlist_jobs`, `profiles`) are not part of this problem.

## Who uses each table

Found by crawling every import from `app/employee-portal/**` and `app/login` (203 files) for browser-side `.from()` and `.rpc()` calls.

| Table | Staff browser (signed in) | Portal browser (anon) | Notes |
|---|---|---|---|
| fund_requests | read, write | read (My requests, new form, detail) | 645 rows, amounts and payees |
| holidays | read | read (leave form) | |
| projects | read, write | read (project time, fund request form) | |
| project_assignments | read | read (project time) | |
| project_time_entries | read | read (project time) | |
| clients, companies, vendors | read, write | read (fund request form dropdowns) | |
| overtime_groups | read | read (fund request routing) | |
| the other 18 | read, write or server only | none | includes payroll_runs, purchase_orders, office_locations, employee_location_assignments, attendance_records |

The portal writes to none of these from the browser. Its writes go through `/api/employee-portal/*` and `/api/fund-requests`, which use the service role and now require the signed portal session (Phase 0).

RPCs the portal or kiosk call with the anon key: `is_employee_location_allowed`, `is_location_allowed` and `get_my_role` are `SECURITY DEFINER`, so RLS does not affect them. `get_server_time` reads no table.

## Step 1: close anonymous writes and most reads (migration only)

`supabase/migrations/20261106200000_enable_rls_on_open_tables.sql`

- Enable RLS on all 27 tables.
- `authenticated`: `for all using (true) with check (true)`. This is the same access staff have today (the pattern `po_masterlist_jobs` already uses), so no staff screen changes.
- `anon`: `select` only, on the 9 portal-read tables. No anon writes anywhere. The other 18 tables become unreadable without sign-in.
- Service role (API routes, crons, Google Sheet sync) bypasses RLS and is unaffected.

Risk: low. The one thing that could break is an anon browser read this crawl missed. Rollback is `alter table … disable row level security` per table, which restores today's behaviour exactly.

Verify after applying:

1. `get_advisors` (security) no longer lists `rls_disabled_in_public` for these tables.
2. With the anon key, `select` on `payroll_runs` returns 0 rows, and `update` on `fund_requests` affects 0 rows.
3. Staff: open the dashboard, fund request inbox, PO masterlist, payroll hub and projects as admin and HR.
4. Portal: sign in, open leave form (holidays load), fund request new and My requests, project time.

## Step 2: move portal reads behind the portal session (code, then migration)

- Add session-guarded routes under `/api/employee-portal/`: `fund-requests` (own requests only), `holidays`, `project-time` (own assignments and entries), and `fund-request-options` (clients, companies, vendors, projects, routing groups for the form).
- Point the portal pages and the shared fund request components at those routes when there is no staff session.
- Then a migration drops the 9 `*_portal_anon_read` policies. After this, `anon` can read nothing in `public` except through security-definer RPCs.

## Step 3: tighten staff access by role (migration per area)

Replace `authenticated using (true)` with role rules that match `lib/permissions.ts`, one area at a time, each checked in the app before the next:

- Payroll: `payroll_runs` for hr, admin and upper_management only.
- Money: `fund_requests` for requester (via `employees.user_id`) and approver roles; `purchase_orders` and `vendors` following the purchasing grants.
- Locations: `office_locations`, `employee_location_assignments` writable by HR and admin only.

Use a `security definer` role helper (like the existing `get_my_role()`) instead of inline `exists (select … from profiles)`, so policies stay fast and consistent.

## Not covered

Storage bucket policies, the `anon` grants on tables that already have RLS (harmless while their policies require `auth.uid()`), and plain-text `employees.portal_password`, which should be hashed in a separate change.
