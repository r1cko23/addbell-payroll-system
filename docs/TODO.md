# TODO

The project's running to-do list. Work it top to bottom, one item at a time. When an item is done, move it to **Done** with the commit. When new work turns up, add it where it belongs by priority. Last updated 2026-11-07.

Owner: **Claude** = code or SQL a session can do (production SQL still needs the user to run it in the Supabase SQL Editor, because `apply_migration` is blocked). **You** = needs a real login, a business decision, or HR.

## Now

2. **Check the live app** (You). Nobody has done these since the changes went live:
   - An employee signs in to the portal, including one still on the default ID password (should be asked to change it).
   - Upper Management / Admin see uploaded cheques in the Fund Request Approval inbox.
   - HR opens Payroll and creates a payroll run.
   - A corrected payslip (Aug 19 or Oct 28 run) looks right on screen and in print.
6. **Turn on leaked-password protection** (You). Supabase dashboard → Authentication → Policies/Passwords. It's the last advisor warning that isn't on purpose.

## Next

16. **Night differential on regular-day overtime** (You to confirm, then Claude). DOLE pays night hours that are also overtime at 10% of the overtime rate (×1.25); regular days still use the basic rate. Production has 48 such days on 38 payslips, about ₱360 underpaid in total. Confirm with HR, then fix in `calculateDailyPay` (and `lib/payslip-print-sync.ts`, which prices regular-day ND directly) with a backfill.

## Decisions for HR / payroll (You)

8. Reprint or re-export copies of the 7 corrected runs handed out before 2026-11-06: May 27, Aug 19, Sep 9, Sep 23, Oct 14, Oct 21, Oct 28.
9. Confirm the ₱1,620.44 withholding tax on payslip `cdd0f7eb…` (Oct 21–27). The tax formula doesn't produce it; probably typed in by hand.
10. Does a 10-hour regular day count as 1 day or 1.25? (Today: 1.25, since hourly = daily ÷ 8.) Changing it changes pay.
11. One employee has no portal password and can't sign in until HR sets one.
12. Move the payroll backup files off this Mac's app storage to where HR keeps payroll records: `~/Library/Application Support/Claude/side-session-notes/local_3beff32f-aeb8-4128-b338-5c2a9b076aea/`.

## Later

14. Leave and OT approval routes put long ID lists into one `.in()` (`docs/GOTCHAS.md` #1). Fine today; batch before data grows.
18. **`/clock` kiosk location check is broken** (Claude, low priority). `is_location_allowed` fails because `office_locations.latitude/longitude` are double precision and `calculate_distance` only takes numeric. No calls in the last day apart from tests, so the kiosk looks unused; either fix the cast or retire `/clock`. The portal bundy check (`is_employee_location_allowed`) works.
15. `docs/RLS_LOCKDOWN_PLAN.md` "Not covered" still says portal passwords are plain text; they're hashed now (16c7074).

## Done

- 2026-11-08 Cheque upload is all or nothing: linked requests are checked before saving, and a failed copy to the peers removes the source cheque and tells the uploader to retry (`lib/__tests__/payment-check-confirm-route.test.ts`, `docs/GOTCHAS.md` #2). Not backfilled: production has 35 payee groups with the cheque on only some requests, but separate cheques and later approvals explain most of them, and old link failures were never logged.
- 2026-11-08 Profile picture upload works again: Settings and the portal Info page upload through `/api/profile-picture` (staff login or signed portal session, service role) into the new `profile-pictures` bucket; portal header and Info page show the picture. Checked in the live app by you: upload and remove on both pages (727bbdf, 20261108100000).
- 2026-11-08 Storage bucket rules: `fund-request-documents` (the only bucket) now accepts only pdf/doc/docx/jpeg/png/webp, and its read policy skips deactivated staff. Checked: admin, upper management and purchasing officer read all 386 linked files, employee-role login reads 0 (20261108090000).
- 2026-11-07 First-login route takes the employee from the signed portal session and calls `record_employee_first_login` with the service role; signed-out and signed-in API access to the function removed. Checked: anon call returns 401, service role can still run it, signed-out-callable definer functions down to the two location checks (62bfe1a, 20261107150000).
- 2026-11-07 Security advisor clean-up: `search_path` pinned on 17 functions (warning count 17 → 0); signed-out access removed from 11 SECURITY DEFINER functions (anon-callable 14 → 3, the three kept on purpose). Checked: anon blocked from `get_my_role` / `approve_failure_to_log`, bundy location check and server time still work signed out, staff role helper and RLS reads still work (20261107140000).
- 2026-11-07 Night differential on worked holidays and rest days now uses that day's rate, and the OT rate for night hours that are also overtime (`utils/payroll-calculator.ts`, `utils/__tests__/premium-day-night-diff.test.ts`). No stored payslip had such a day (both breakdown formats checked), so no backfill was needed; it applies to payslips generated from now on.
- 2026-11-07 Item 4 closed with no change: the role-only `fund_requests_approve` rule is correct. Approval in the app is by role (`getActionableFundRequestStatuses`: operations manager, purchasing officer, admin, upper management), not by `fund_requests.update`. Switching would block operations managers (no update permission) and let HR edit. Keep the rule's role list in step with `getActionableFundRequestStatuses` if approval roles change.
- 2026-11-07 Locked down `po_masterlist_jobs`: read with projects permission, no browser writes. Checked in production: employee-role login 0 rows / 0 edits, purchasing officer and admin read all 880. No public table has an allow-everything policy left (20261107130000).
- 2026-11-07 Merged the permission helpers: `staff_can` now wraps `has_module_permission`, which matches the app's rules exactly (active profiles only, admin full on directory modules). Applied and checked per account in production (20261107120000).
- 2026-11-07 Archived the finished payroll and holiday-pay sessions.
- 2026-11-07 Forced password change for default portal passwords (4234bb9).
- 2026-11-06 Portal passwords hashed with bcrypt (16c7074).
- 2026-11-06 Overtime-only rest day / holiday pricing fixed and 8 payslips corrected (98a4c30, 879d1b8).
- 2026-11-06 RLS steps 1–3 for payroll, locations, money and jobs (ab620a0, 99d0054, eb51d11).
- 2026-11-06 Payroll Excel day count fixed; 21 special-day payslips corrected (249e482, 862be58).
- 2026-11-04 Cheques missing from the approval inbox fixed (0222c1a).
