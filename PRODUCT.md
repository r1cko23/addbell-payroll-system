# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two equal primary audiences. Neither is a secondary “also” surface.

1. **Office and operations staff** — Admin, Upper Management, HR, Operations Manager, Project Manager, Purchasing Officer, Account Manager, Approver, Viewer, and related roles. They open the staff dashboard (`/login`) to run the live job book, fund requests, purchase orders, time approvals, payroll, and employee records.
2. **Employees in the field and office** — they open the employee portal (`/employee-login`) to clock bundy, file leave / overtime / failure-to-log, request funds, view payslips, and (when assigned) log project time.

Access is role- and permission-gated. A neighboring role must not see salary, payroll, or PO columns it is not allowed to edit.

## Product Purpose

Addbell’s internal operations book: construction jobs, billing, funds, time, and payroll in one system so staff are not maintaining a parallel Google Sheet or Excel workbook as the live record.

Success is that the same job, punch, fund request, and payroll figure can be trusted in the app without reconciling a second spreadsheet after the fact. For the PO masterlist specifically, the Google Sheet remains the source of truth and the app stays in two-way sync with it.

## Positioning

This is Addbell Technical Services, Inc.’s own construction operations and payroll system — not a generic HRIS tenancy and not a drop-in Green Pasture / GP-HRIS deployment. The mechanism a neighboring product could not copy is the live PO masterlist identity (P.O. NUMBER, never generated `ML-*` codes) with two-way Google Sheets sync, plus Addbell’s role/ACL matrix across dashboard and employee portal.

## Operating Context

- Philippine construction contractor. Staff use the dashboard on desktop and phone; employees use the portal on phone as well as desktop.
- Jobs are tracked as a spreadsheet-shaped masterlist (P.O. date, number, amount, title, client, location, payment terms, project status, payment status, invoice numbers, remarks). Invoice cells may hold a progress-billing schedule (multiple invoice / percent / status lines).
- Fund requests and purchase orders attach to projects. The `projects` catalog remains because fund requests and timesheets still foreign-key to it; it is not retired in favor of the masterlist alone.
- Timekeeping is bundy: employee portal clock in/out with GPS/office rules; business day starts **7:00 AM Manila**; open shifts auto-close after **23 hours**. Payroll is bi-monthly. Approvals cover leave, overtime, and failure-to-log.
- Imports still arrive from Excel (employees, OT accounts, timelog approvers). Payslips and some exports are printed/PDF with the company mark.
- Two logins, two shells: staff dashboard vs employee portal. They share the company and data, not the same chrome or copy case.

## Capabilities and Constraints

- **Confirmed:** Role-based page access plus `profiles.permissions` module grants. PO masterlist columns have a separate role → editable-column ACL.
- **Confirmed:** Google Sheets remains source of truth for the PO masterlist; the app pulls and writes back. P.O. NUMBER is the job identity.
- **Confirmed:** Staff dashboard and employee portal are both first-class products.
- **Technical:** Next.js 14 (App Router) + React 18 + TypeScript, Tailwind / Radix, Supabase (PostgreSQL, Auth, RLS), deployed typically on Vercel. Local: `npm run dev` → `http://localhost:3000`.
- **Undecided:** Whether the current navy dashboard chrome is a brand commitment (not pinned at init). Whether any workbook besides the PO masterlist stays a source of truth. No product-wide accessibility standard was set.
- **Stale, do not treat as Addbell legal fact:** `docs/privacy/` still names Green Pasture People Management Inc. from the fork. Do not reprint that entity as Addbell.

## Brand Commitments

- Legal / product name: **Add-bell Technical Services, Inc.** (UI and metadata use the hyphenated “Add-bell”; repo and speech also say “Addbell”).
- Official marks live in `/public/` (`add-bell-logo-new.png`, `add-bell-logo-on-dark.png`, `add-bell-logo-sidebar.png`, wordmark and mark variants). Use these; do not invent a replacement logo.
- Voice: operational and internal. Dashboard titles/subtitles use title case; employee portal body copy stays sentence case.

## Evidence on Hand

- Running product and copy in this repository (login, dashboard, employee portal, payslips).
- Official logos under `public/` and notes in `assets/logos/README.md`.
- Internal docs: root `README.md`, `docs/ROLE_ACCESS_QUICK_REFERENCE.md`, `docs/setup/`.
- No marketing site, customer testimonials, press, or third-party case studies. Future work must not fabricate them.

## Product Principles

1. **One live book.** The app is where jobs, funds, time, and payroll are run; a parallel spreadsheet is not the operating model except where Google Sheets is explicitly the PO masterlist source of truth.
2. **Two equal doors.** Dashboard and employee portal are designed as peers. Improving one must not treat the other as leftover.
3. **Access is the product.** Roles, module permissions, and column ACL decide what is visible and editable; screens must not leak salary or job fields across roles.
4. **Keep Add-bell’s marks.** Company name and official logos stay; do not substitute generic HRIS branding or GP-HRIS leftovers.
5. **Identity stays the P.O.** Job records are keyed by real P.O. numbers from the sheet, not generated placeholders.
