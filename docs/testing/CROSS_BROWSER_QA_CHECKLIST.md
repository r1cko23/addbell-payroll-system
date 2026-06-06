# Cross-Browser & Responsive QA Checklist

Use this checklist before releases that touch admin/HR dashboard or employee portal UI.  
Target devices: **recent iOS Safari**, **Android Chrome**, **desktop Chrome/Safari/Edge**.

Breakpoints (Tailwind):

| Tier | Width | Chrome |
|------|-------|--------|
| Mobile | &lt; 768px (`md`) | Bottom nav (portal), hamburger (admin), card lists |
| Tablet | 768–1023px | Sidebar (portal), single-column forms |
| Laptop+ | ≥ 1024px (`lg`) | Fixed sidebar, multi-column grids, tables |

---

## How to test

### Local

```bash
npm run dev
# http://localhost:3000
```

### Device presets (Chrome DevTools → Toggle device toolbar)

| Device | Viewport | Priority |
|--------|----------|----------|
| iPhone 16 Pro Max | 440 × 956 | P0 — iOS Safari date/time bug area |
| iPhone SE | 375 × 667 | P0 — narrowest common iPhone |
| Pixel 7 | 412 × 915 | P0 — Android reference |
| Samsung Galaxy S20 Ultra | 412 × 915 | P1 |
| iPad Air | 820 × 1180 | P1 — tablet sidebar |
| Responsive (1280 × 800) | P1 — laptop |

### Browsers per tier

- **Mobile:** Safari (iOS), Chrome (Android)
- **Desktop:** Chrome, Safari (macOS), Edge

Record pass/fail and browser version in the test run notes at the bottom of this doc.

---

## P0 — Employee portal (authenticated)

Log in as a test employee. Check **layout**, **touch targets (≥44px)**, and **no horizontal page scroll**.

| Page | Route | What to verify |
|------|-------|----------------|
| Home | `/employee-portal` | Quick-link cards, bottom nav, header |
| Bundy | `/employee-portal/bundy` | Clock In/Out buttons, week nav, no overflow |
| OT Filing | `/employee-portal/overtime` | **Date/time inputs inside card** (iOS Safari), submit button full width |
| Leave | `/employee-portal/leave-request` | Native select, MultiDatePicker, form card bounds |
| Failure to Log | `/employee-portal/failure-to-log` | **All four date/time fields inside card** |
| Payslips | `/employee-portal/payslips` | List cards, preview dialog |
| My Timesheet | `/employee-portal/my-timesheet` | Period nav, table scroll only inside shell |
| Info | `/employee-portal/info` | Label/value rows wrap, no overflow |
| Fund request | `/employee-portal/fund-request` | List + new form if applicable |

### iOS Safari — auto-zoom on login / forms

- [ ] Employee login (`/login?mode=employee`) does **not** zoom in when tapping Employee ID or Password
- [ ] After login, employee portal loads at normal scale (no pinch-out needed)
- [ ] OT / Leave / Failure to Log inputs do not trigger zoom on focus

Cause: iOS Safari zooms when `font-size` &lt; 16px on focused inputs; zoom can persist after redirect.  
Mitigation: `16px` form controls on mobile (`globals.css` + `text-base md:text-sm` on shared inputs).

### iOS Safari — date/time inputs (highest risk)

On **OT Filing** and **Failure to Log**:

- [ ] OT Date / Time In Date fields do not extend past card right edge
- [ ] Start Time / Time In / Time Out fields stay inside card
- [ ] End Date / Time Out Date fields stay inside card
- [ ] Tapping each field opens native picker
- [ ] Reason textarea stays inside card
- [ ] No horizontal scroll on the page (only intentional innerscroll, e.g. Bundy table)

Known issue: [WebKit #301648](https://bugs.webkit.org/show_bug.cgi?id=301648) — mitigated via `ios-temporal-input-shell` in `components/ui/input.tsx` and `app/globals.css`.

---

## P0 — Admin / HR dashboard (authenticated)

Log in as HR or admin.

| Page | Route | Mobile expectation | Desktop expectation |
|------|-------|-------------------|---------------------|
| HR Dashboard | `/dashboard` (HR) | KPI cards, approval cards | Tables / full layout |
| Admin Dashboard | `/dashboard` (admin) | Same | Same |
| Employees | `/employees` | **Card list** (`DbMobileBlock`) | Table |
| Time entries | `/time-entries` | Card list | Table |
| Timesheet | `/timesheet` | Card list | Table |
| Payroll | `/payroll` | Card list | Table |
| Leave approval | `/leave-approval` | Queue cards | Queue cards + filters |
| OT approval | `/overtime-approval` | Queue cards | Queue cards |
| FTL approval | `/failure-to-log-approval` | Queue cards | Queue cards |
| Clients | `/clients` | **Card list** | Table |
| Vendors | `/vendors` | **Card list** | Table |
| Loans | `/loans` | **Card list** | Table |

Header actions on mobile: full-width or 2-column grid (`dbHeaderActions` / `dbHeaderButton`).

---

## P1 — Admin pages (table scroll fallback)

These use **horizontal scroll inside the table shell** on mobile (acceptable fallback; card split not yet added everywhere):

| Page | Route | Note |
|------|-------|------|
| Projects list | `/projects` | `min-w-[860px]` table scroll |
| Project detail | `/projects/[id]` | Multiple tab tables |
| Purchase orders | `/purchase-order` | List table scroll |
| Settings | `/settings` | Wide permissions table |
| AttLog import | `/time-entries/attlog-import` | Preview tables |
| Employee detail | `/employees/[id]` | Sub-tab tables |
| Payslips editor | `/payslips` | Complex layout; spot-check mobile |
| Fund request approval | `/fund-request-approval` | Card queue; some raw selects |
| Project profitability | `/project-profitability` | Wide tables |

When testing: confirm **page itself does not scroll horizontally** — only the table container may.

---

## P2 — Auth & static

| Page | Route |
|------|-------|
| Login | `/login` |
| Employee login | `/employee-login` |
| Privacy | `/privacy` |

---

## Regression signals (fail if seen)

- Double vertical spacing (page feels “too tall” on iPhone) — usually `VStack gap` + `epPageWrapper` combined
- Inputs/selects wider than parent card on iOS
- Primary buttons smaller than ~44px height on mobile
- Bottom nav overlapping form submit buttons (portal)
- Subtext in **Title Case Every Word** — should be **sentence case** with a period
- Desktop table shown on mobile with no card alternative **and** whole page scrolls sideways

---

## Code conventions (for developers)

| Area | Page root | Form card | Lists |
|------|-----------|-----------|-------|
| Employee portal | `epPageWrapper` | `epFormCard` | `EpMobileBlock` / `EpDesktopBlock` when layouts differ |
| Admin dashboard | `dbPageWrapper` | `dbFormCard` | `DbMobileBlock` / `DbDesktopBlock` |

Date/time inputs: use shared `Input` — temporal types auto-wrap in `ios-temporal-input-shell`.

Rules: `.cursor/rules/employee-portal-mobile.mdc`, `.cursor/rules/admin-dashboard-mobile.mdc`.

---

## Automated smoke (before manual QA)

```bash
npm run build
```

Build must pass with no duplicate imports or JSX mismatches.

---

## Test run log

| Date | Tester | Environment | Browsers/devices | Result | Notes |
|------|--------|-------------|------------------|--------|-------|
| | | local / staging / prod | | | |

---

## Spot-check audit (code review — update when layout changes)

**Employee portal — mobile card/form patterns:** overtime, leave-request, failure-to-log, bundy, info, payslips, project-time, fund-request (portal mode).

**Admin — `DbMobileBlock` present:** employees, clients, vendors, loans, payroll, timesheet, time-entries, HR/Admin dashboards.

**Admin — table scroll only (no mobile cards yet):** projects, purchase-order, settings, attlog-import, employees/[id], project-profitability, audit (filters).

**iOS temporal input mitigation:** `components/ui/input.tsx`, `app/globals.css` (`.ios-temporal-input-shell`).
