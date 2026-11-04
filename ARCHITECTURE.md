# Architecture

A single Next.js 14 app (App Router) on Vercel, backed by one Supabase project (Postgres + Auth + Storage + RLS). There's no separate backend: server logic is in `app/api/**/route.ts`.

```
Browser (staff dashboard / employee portal)
   │  supabase-js (anon key + user JWT, RLS applies)  ──────────► Supabase PostgREST
   │  fetch /api/...                                                    ▲
   ▼                                                                    │ service role (bypasses RLS)
Next.js on Vercel (sin1)                                                │
   middleware.ts ── route guard + landing redirect                      │
   app/api/**/route.ts ── auth check → assert* helper → getAdminClient()┘
   Vercel crons ── fund-request expiry, PO masterlist sheet pull
   Upstash Redis ── JSON response cache (lib/cache.ts, epoch invalidation)
   Google Sheets API ── PO masterlist + billing invoice sheets
```

## Two front ends, one app

| Surface | Login | Routes | Users |
|---------|-------|--------|-------|
| Staff dashboard | `/login` | `/dashboard`, `/employees`, `/payroll`, `/fund-request-approval`, `/purchase-order`, `/projects`, … | admin, upper_management, hr, operations_manager, project_manager, purchasing_officer, approver, viewer |
| Employee portal | `/employee-login` | `/employee-portal/*` | every employee (bundy, leave, OT, FTL, fund requests, payslips) |

`middleware.ts` protects dashboard paths and sends each role to its landing page (`lib/default-landing-route.ts`).

## Directory map

| Path | What's there |
|------|--------------|
| `app/<feature>/page.tsx` | Dashboard pages, mostly client components |
| `app/employee-portal/` | Employee portal pages |
| `app/api/<feature>/` | Route handlers. Payment-sensitive writes go through here, not through the browser client |
| `components/<feature>/` | Feature UI (`fund-request/`, …); `components/ui/` holds shadcn/Radix primitives |
| `lib/` | ~140 flat domain modules named `<domain>-<thing>.ts` (e.g. `fund-request-cutoff.ts`). This is where the business rules live |
| `lib/supabase/{client,server}.ts` | Browser and server Supabase clients |
| `lib/hooks/` | `useUserRole`, `usePermissions`, data hooks |
| `utils/` | Pure payroll math (PH deductions, OT, holidays, bimonthly), PDF/print helpers |
| `modules/` | Barrel `index.ts` files only. The modular refactor in `docs/architecture/MODULAR_ARCHITECTURE.md` never happened |
| `types/` | `database.ts` / `supabase.ts` generated types, plus hand-written domain types (`fund-request.ts`) |
| `supabase/migrations/` | Dated SQL migrations (2026+) |
| `scripts/`, `scripts/sql/` | Excel imports and one-off production fixes. Read a script before running it |
| `tests/` | Playwright E2E specs |

## Data access patterns

1. **Browser reads through RLS.** Many pages query Supabase directly with the user's JWT (e.g. `FundRequestInbox` loads `fund_request_documents`). RLS policies decide visibility by `profiles.role`.
2. **API routes for writes and privileged reads.** Each route resolves the user from cookies (`createServerComponentClient`), checks the role (`getCurrentUserRole`), runs a domain assert (`assertApproverCanUploadPaymentCheck`, …), then uses `getAdminClient()`.
3. **Cache.** `lib/cache.ts` `cachedJson()` caches API JSON in Upstash Redis under a global epoch. `/api/cache/invalidate` bumps the epoch.

## Domains

### Fund requests and cheques
- Status flow: `pending` → `project_manager_approved` → `purchasing_officer_approved` (waiting on Upper Management) → `management_approved`. Return, reject and cutoff expiry are side paths (`lib/fund-request-approval.ts`, `lib/fund-request-cutoff*.ts`).
- Requests are grouped by **payee account name + cutoff week**. One payment cheque can cover the whole group (`lib/fund-request-payment-check.ts`). `separate_cheque` takes a request out of the combined cheque.
- **Documents** (supporting files, payment cheque scans) are stored in the `fund-request-documents` Storage bucket. Each file has a row in `fund_request_documents` (`document_type` = `supporting` | `payment_check`).
  - Upload: `POST /api/fund-requests/documents/upload-url` → the browser PUTs the file to a signed URL → `POST /api/fund-requests/documents/confirm` registers the row and copies it to linked peer requests that share the same `storage_path`.
  - Delete: `DELETE /api/fund-requests/documents/[id]` removes every row sharing that `storage_path`, then the file.
  - Older rows may still hold `file_base64`. Current uploads use Storage only.
- Only `admin` and `upper_management` can upload or delete cheques, and only while the status is `purchasing_officer_approved` or `management_approved`.
- Cron `/api/fund-requests/expire-past-cutoff` runs Thu 10:00 and daily 00:10 Manila.

### PO masterlist
- The Google Sheet is the source of truth. The app pulls nightly (cron `/api/po-masterlist/sheet-pull`, 01:00 Manila) and writes edits back (`lib/po-masterlist-sheet-*.ts`). The job identity is **P.O. NUMBER**.
- Which roles can edit which columns is set in `lib/po-masterlist-column-acl.ts`.

### Bundy (time clock) and attendance
- Punches come from the employee portal (`/api/employee-portal/clock-punch`, GPS/office rules) and the ZKTeco biometric webhook (`/api/biometric/punch`), plus attlog import (`lib/attlog-import.ts`).
- The business day starts at 7:00 AM Manila (`lib/bundy-business-day.ts`). Open shifts auto-close after 23h (`lib/bundy-auto-clock-out.ts`). The official day pair is the longest complete session (`lib/official-bundy-sessions.ts`).

### Payroll
- Bi-monthly cutoffs. Calculation is in `utils/payroll-calculator.ts`, `utils/ph-deductions.ts`, `utils/overtime.ts`, `utils/holidays.ts`, `lib/payroll/`.
- Payroll runs: `app/api/payroll-runs/{validate,generate-payslips,export-*,payslip-print}`.
- Rules docs: `docs/guides/PAYROLL_CALCULATION_RULES.md`, `docs/guides/SIL_*`, `docs/BUSINESS_RULES_ENUMERATION.md`.

### Approvals
- Leave, OT and failure-to-log each have an approval route and page. Routing comes from `lib/requestApprovalRouting.ts`, `lib/dedicated-employee-approver-routing.ts` and OT groups.

## Roles

`admin` (system owner), `upper_management`, `hr`, `operations_manager`, `project_manager`, `purchasing_officer`, `account_manager`, `approver`, `viewer`, plus employees (no staff role). `profiles.permissions` adds per-module grants on top (`lib/permissions.ts`). The matrices are in `docs/RBAC_ACL_MATRIX.md`.

## External services

| Service | Used for | Config |
|---------|----------|--------|
| Supabase | DB, Auth, Storage, RLS | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, service role key (server only) |
| Upstash Redis | API cache, session cache | `lib/redis.ts` |
| Google Sheets | PO masterlist, billing invoices | `lib/google-sheets-*.ts` |
| ZKTeco LX50 | Biometric punches | `docs/guides/ZKTECO_LX50_*.md`, `BIOMETRIC_WEBHOOK_SECRET_SETUP.md` |
