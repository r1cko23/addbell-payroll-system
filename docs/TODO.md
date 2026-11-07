# TODO

The project's running to-do list. Work it top to bottom, one item at a time. When an item is done, move it to **Done** with the commit. When new work turns up, add it where it belongs by priority. Last updated 2026-11-07.

Owner: **Claude** = code or SQL a session can do (production SQL still needs the user to run it in the Supabase SQL Editor, because `apply_migration` is blocked). **You** = needs a real login, a business decision, or HR.

## Now

2. **Check the live app** (You). Nobody has done these since the changes went live:
   - An employee signs in to the portal, including one still on the default ID password (should be asked to change it).
   - Upper Management / Admin see uploaded cheques in the Fund Request Approval inbox.
   - HR opens Payroll and creates a payroll run.
   - A corrected payslip (Aug 19 or Oct 28 run) looks right on screen and in print.
6. **Security advisor warnings** (Claude, plus one setting for You):
   - 17 functions without a fixed `search_path`.
   - 14 SECURITY DEFINER functions signed-out visitors can call; review which must stay.
   - Leaked-password protection is off in Supabase Auth (You: dashboard setting).

## Next

16. **Night differential on regular-day overtime** (You to confirm, then Claude). DOLE pays night hours that are also overtime at 10% of the overtime rate (×1.25); regular days still use the basic rate. Production has 48 such days on 38 payslips, about ₱360 underpaid in total. Confirm with HR, then fix in `calculateDailyPay` (and `lib/payslip-print-sync.ts`, which prices regular-day ND directly) with a backfill.
7. **Storage bucket access rules** (Claude). Not reviewed yet; start with `fund-request-documents`.

## Decisions for HR / payroll (You)

8. Reprint or re-export copies of the 7 corrected runs handed out before 2026-11-06: May 27, Aug 19, Sep 9, Sep 23, Oct 14, Oct 21, Oct 28.
9. Confirm the ₱1,620.44 withholding tax on payslip `cdd0f7eb…` (Oct 21–27). The tax formula doesn't produce it; probably typed in by hand.
10. Does a 10-hour regular day count as 1 day or 1.25? (Today: 1.25, since hourly = daily ÷ 8.) Changing it changes pay.
11. One employee has no portal password and can't sign in until HR sets one.
12. Move the payroll backup files off this Mac's app storage to where HR keeps payroll records: `~/Library/Application Support/Claude/side-session-notes/local_3beff32f-aeb8-4128-b338-5c2a9b076aea/`.

## Later

13. Cheque upload can partly succeed: if linking peer requests fails, only the first request gets the cheque (`docs/GOTCHAS.md` #2).
14. Leave and OT approval routes put long ID lists into one `.in()` (`docs/GOTCHAS.md` #1). Fine today; batch before data grows.
15. `docs/RLS_LOCKDOWN_PLAN.md` "Not covered" still says portal passwords are plain text; they're hashed now (16c7074).

## Done

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
