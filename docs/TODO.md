# TODO

The project's running to-do list. Work it top to bottom, one item at a time. When an item is done, move it to **Done** with the commit. When new work turns up, add it where it belongs by priority. Last updated 2026-11-07.

Owner: **Claude** = code or SQL a session can do (production SQL still needs the user to run it in the Supabase SQL Editor, because `apply_migration` is blocked). **You** = needs a real login, a business decision, or HR.

## Now

Nothing waiting on Claude.

## Next

Nothing waiting on Claude.

## Decisions for HR / payroll (You)

11. One employee has no portal password and can't sign in until HR sets one.
12. Move the payroll backup files off this Mac's app storage to where HR keeps payroll records: `~/Library/Application Support/Claude/side-session-notes/local_3beff32f-aeb8-4128-b338-5c2a9b076aea/`.

## Later

6. **Leaked-password protection** (You, recheck). You switched it on 2026-11-08, but the security advisor still reported it off at 03:45 UTC. Rerun the advisor in a day; if it still says off, the setting may not have saved or may need the Pro plan.

## Done

- 2026-11-08 PO VAT: the form has VAT Inc (amount ÷ 1.12 = sub-total), VAT Ex (amount × 1.12 = total) and Non-VAT buttons; the print shows Sub-Total, VAT Amount and Total Amount, and saving stores all three (`lib/po-vat.ts`). PO print layout tightened per your notes the same day.
- 2026-11-08 New purchase order screen shows a live preview of the printed PO beside the form (below it on narrower screens); Print and PDF use the same copy. Checked in the dev app: the preview updates as you type.
- 2026-11-08 Items 9 and 10 closed by you: the ₱1,620.44 tax on payslip `cdd0f7eb…` was entered by hand and stays as is; a 10-hour regular day stays at 1.25 days (hourly = daily ÷ 8).
- 2026-11-08 No reprints needed (items 8 and 20 closed): per you, the corrected payslips were already paid and corrected outside the system; the backfills only bring the records in line.
- 2026-11-08 Night differential on regular-day overtime now uses the OT rate (8f1d302). Backfill applied to 33 payslips, +₱310.78 gross and net, checked against the backup (`docs/backfills/2026-11-regular-day-ot-night-diff.md`).
- 2026-11-08 Live app checked by you: portal sign-in (including a default-password account), cheques in the approval inbox, HR creating a payroll run, and a corrected payslip on screen and in print.
- 2026-11-08 `docs/RLS_LOCKDOWN_PLAN.md` brought up to date: passwords hashed, storage reviewed, and the list of functions callable signed out is down to the portal bundy check.
- 2026-11-08 Retired `/clock`, an unlinked staff page that punched any employee with a location check that always failed. Page deleted; only the service role can call `is_location_allowed`. Checked: a signed-out call is refused, the portal bundy check still works signed out, and it is now the only definer function callable signed out (0ea2571, 20261108120000).
- 2026-11-08 Long `.in()` lists: the approval routes load one week at a time (24 requests at most so far), so no change. The portal OT route loads an employee's whole history and now batches documents and punches with `selectInBatches` (`lib/supabase-in-batches.ts`), and shows an error instead of quietly dropping them. The cheque loader uses the same helper.
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
