# Addbell Payroll & Workforce System

Internal platform for **Addbell Technical Services, Inc.** — Philippine payroll, time and attendance (bundy), approvals, and construction project operations.

This repository began as a fork of the **GP-HRIS** (Green Pasture) payroll stack. Addbell has since customized workflows, roles, bundy rules, Supabase schema, and UI while keeping useful patterns (bi-monthly payroll, RLS, approval flows, fund requests). Treat this codebase as **Addbell’s system**, not a drop-in GP-HRIS deployment.

---

## What this system does

### HR & payroll (primary)

- **Employee master data** — rates, government IDs, schedules, office locations  
- **Bundy (time clock)** — employee portal clock in/out with GPS/office rules; business day from **7:00 AM Manila**; open shifts auto-close after **23 hours**  
- **Time entries & attendance** — raw punches, timesheet review, attlog import  
- **Bi-monthly payroll** — payroll runs, payslips, deductions, allowances, loans  
- **Approvals** — leave, overtime, failure-to-log  

### Operations & finance (Addbell-specific)

- **Clients, projects, vendors** — construction project tracking  
- **Fund requests & purchase orders** — approval workflows tied to projects  
- **Project time** — optional project-linked clocking from the employee portal  

### Dashboards & access

- Role-based sidebar (**admin**, **upper_management**, **hr**, **operations_manager**, **approver**, etc.)  
- Per-module permissions via `profiles.permissions`  
- Executive and workforce dashboards  

---

## Fork lineage (what changed vs GP-HRIS)

| Area | Addbell | Notes on GP-HRIS carryover |
|------|---------|----------------------------|
| Branding & company | Addbell Technical Services | Layout/CSS patterns partially inherited |
| Bundy / business day | 7 AM day boundary, 23h auto-out, superseded-IN handling | Old 6:59 auto-close removed in code |
| Roles & approvals | Addbell approver matrix, OT groups, timelog approvers | See `docs/ROLE_ACCESS_QUICK_REFERENCE.md` |
| Database | Addbell Supabase project + migrations in `supabase/migrations/` | Do not assume GP-HRIS tables (e.g. `audit_logs`) exist in prod |
| Legacy GP-HRIS pages | `/audit`, `/bir-reports`, `/project-profitability` | Removed from sidebar (not operational on Addbell prod). **Payroll Register** (`/reports`) lives under **People** for finance export. |

Historical GP-HRIS docs remain under `docs/` for reference; prefer this README and Addbell-titled guides (`docs/setup/SETUP.md`, `docs/deployment/DEPLOYMENT_GUIDE.md`) for setup.

---

## Tech stack

- **Framework:** Next.js 14 (App Router), React 18, TypeScript  
- **Styling:** Tailwind CSS, Radix UI, Phosphor icons  
- **Backend:** Supabase (PostgreSQL, Auth, RLS)  
- **Deploy:** Vercel (typical)  
- **Tests:** Playwright (`tests/`)  

---

## Repository layout

```
app/                    # Routes (admin app + employee-portal/*)
components/             # UI, layouts, sidebar
lib/                    # Supabase clients, hooks, bundy/payroll logic
utils/                  # Payroll formulas, holidays, formatting
supabase/migrations/    # Schema changes (apply to Addbell project only)
scripts/                # Imports, one-off fixes, SQL maintenance
scripts/sql/            # Production data fixes (documented SQL)
docs/                   # Setup, deployment, RBAC, guides
types/                  # Database TypeScript types
```

---

## Getting started

### Prerequisites

- Node.js **18+**, npm **9+**  
- Supabase project for **Addbell** (not the legacy GP-HRIS project unless you are migrating)  

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin login: `/login`. Employee bundy: `/employee-login` → employee portal.

### Environment variables

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Full setup (migrations, first admin user, Vercel): **`docs/setup/SETUP.md`** and **`docs/setup/QUICKSTART.md`**.

### Database

Apply migrations from `supabase/migrations/` in order on the Addbell Supabase project (SQL Editor or Supabase CLI). Do not rely on a single monolithic `001_initial_schema.sql` unless your environment was bootstrapped that way — this repo evolved through numbered dated migrations.

Regenerate types after schema changes:

```bash
npm run supabase:types
```

---

## Useful scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development server |
| `npm run build` | Production build |
| `npm run test` | Playwright E2E tests |
| `npm run import:masterlist-2026` | Employee import from Excel |
| `npm run import:timelog-approvers` | Approver mapping import |
| `npm run test:clock` | Time clock smoke test script |

Operational SQL (bundy cleanup, cohort fixes) lives in **`scripts/sql/`** — run only after reviewing each script; many are one-time production fixes.

---

## Roles (summary)

Access is enforced in the app (`lib/hooks/usePermissions.ts`, `middleware.ts`) and in Supabase **RLS**.

- **admin / upper_management** — full modules  
- **hr** — employees, payroll, time, most approvals; no user delete  
- **operations_manager** — projects, fund requests, limited reporting  
- **approver** — assigned leave/OT/failure-to-log only  
- **Employees** — separate auth via employee portal (bundy, payslips, leave, OT, fund requests)  

Details: **`docs/ROLE_ACCESS_QUICK_REFERENCE.md`**, **`docs/RBAC_ACL_MATRIX.md`**.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/setup/SETUP.md](docs/setup/SETUP.md) | Full local + Supabase setup |
| [docs/setup/QUICKSTART.md](docs/setup/QUICKSTART.md) | Short setup path |
| [docs/deployment/DEPLOYMENT_GUIDE.md](docs/deployment/DEPLOYMENT_GUIDE.md) | Vercel deployment |
| [docs/guides/PAYROLL_BEST_PRACTICES.md](docs/guides/PAYROLL_BEST_PRACTICES.md) | PH payroll calculations |
| [docs/guides/RLS_SECURITY_GUIDE.md](docs/guides/RLS_SECURITY_GUIDE.md) | Row-level security |
| [docs/status/PROJECT_STATUS.md](docs/status/PROJECT_STATUS.md) | Feature inventory (may lag; verify in app) |

The file [docs/README.md](docs/README.md) still references **GP-HRIS** as the old doc index name.

---

## Production notes

- **Bundy fixes** (superseded IN, 23h auto-out, historical 6:59 cleanup) are documented in conversation and `scripts/sql/` — coordinate DB changes with deployed app code.  
- Before enabling sidebar items under **Admin**, confirm the backing table/RPC exists in Addbell Supabase.  
- Payslip **status** workflow (`draft` vs `paid`) affects BIR-style reports that filter on `paid` only.

---

## License

Private — **Addbell Technical Services, Inc.** Internal use only.
