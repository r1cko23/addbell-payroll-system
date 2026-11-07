# CLAUDE.md

Read this first every session. Then read only what the task needs:

- [docs/TODO.md](docs/TODO.md): the running to-do list. Take the top item unless the user asks for something else, and update the file (move done items, add new ones) in the same commit as the work

- [ARCHITECTURE.md](ARCHITECTURE.md): how the system is built and where things live
- [docs/GOTCHAS.md](docs/GOTCHAS.md): traps that already cost us an incident. Check it before touching queries, uploads, bundy or payroll
- [PRODUCT.md](PRODUCT.md): who uses it, brand, copy case
- [ADDBELL_ROLES_AND_PERMISSIONS.md](ADDBELL_ROLES_AND_PERMISSIONS.md) and [docs/ROLE_ACCESS_QUICK_REFERENCE.md](docs/ROLE_ACCESS_QUICK_REFERENCE.md): who can see what

## What this is

Add-bell Technical Services, Inc.'s internal construction ops and Philippine payroll system. Next.js 14 App Router + Supabase. It was forked from GP-HRIS (Green Pasture). Many files under `docs/` still describe GP-HRIS, so trust the code over those docs.

## Commands

```bash
npm run dev            # http://localhost:3000  (staff: /login, employees: /employee-login)
npm run test:unit      # vitest: utils/__tests__ and lib/**/__tests__
npx tsc --noEmit       # typecheck (Vercel build fails on type errors)
npm run build          # full production build
npm test               # Playwright E2E (needs running app + seeded users)
```

Unit tests are the fast loop. Put new tests next to the existing ones in `utils/__tests__/` or `lib/__tests__/`.

## Production facts

- Supabase project ref: `krqpfcqskvgigqdcyhvd` (the `supabase` MCP points at it). Treat it as **production**. Use SELECTs freely, but confirm with the user before any write, DDL or `apply_migration`.
- Deployed on Vercel, region `sin1`. Crons are in `vercel.json` and run in UTC (Manila = UTC+8).
- Business timezone is `Asia/Manila`. The bundy business day starts at **7:00 AM Manila**.
- New schema changes go in `supabase/migrations/<timestamp>_<name>.sql`. The live DB also has migrations that were applied outside this folder, so check live tables with `list_tables` before assuming a column exists.

## Working rules for this repo

- **Never put a list of IDs that grows over time into a client-side `.in()` filter.** Batch it or filter on the server. See GOTCHAS #1 (it broke cheque display on 2026-11-04).
- Don't swallow a failed fetch by resetting state to empty. Users read "nothing showed up" as "my data is gone". Show an error.
- Role checks live in three places that must agree: `middleware.ts` (routes), `lib/hooks/useUserRole.ts` / `lib/permissions.ts` (UI), and Supabase RLS / `lib/*-api.ts` asserts (data). If you change one, check the other two.
- `admin` (system owner) and `upper_management` are different roles. Code that should cover both must check both. Use `normalizeUserRole` from `lib/user-roles.ts`.
- Server routes that need to bypass RLS use `getAdminClient()` (service role) and **must** call the matching `assert*` helper first (see `lib/fund-request-api.ts`).
- Copy case: staff dashboard headers use sentence case (per the latest commits); employee portal body copy is sentence case.
- Commit messages are one plain sentence ending with a period, e.g. `Fix leave over-credit and Bundy double-tap hours for payroll.`
- Loose root files (`*.xlsx`, `*.pdf`, `*.dat`) are real business data samples. Don't commit new ones and don't delete them.

## Where to look first

| Task | Start in |
|------|----------|
| Fund requests / cheques | `lib/fund-request-*.ts`, `components/fund-request/`, `app/api/fund-requests/` |
| PO masterlist + Google Sheet sync | `lib/po-masterlist-*.ts`, `app/api/po-masterlist/` |
| Bundy / time clock | `lib/bundy-*.ts`, `lib/official-bundy-sessions.ts`, `app/api/employee-portal/clock-punch/` |
| Payroll / payslips | `utils/payroll-calculator.ts`, `utils/ph-deductions.ts`, `lib/payroll/`, `app/api/payroll-runs/` |
| Leave / OT / FTL approvals | `app/api/{leave,overtime,failure-to-log}-approval/`, `lib/requestApprovalRouting.ts` |
| Roles / access | `lib/user-roles.ts`, `lib/permissions.ts`, `middleware.ts`, `lib/default-landing-route.ts` |
