# Addbell vs Frappe HR — 5-Phase Payroll Audit

**Date:** June 2026  
**Scope:** `addbell-payroll-system` (Addbell Technical Services)  
**Method:** Same 5-phase model used for GP-HRIS (`docs/guides/PAYROLL_BEST_PRACTICES.md`, `lib/ph-payroll/` on GP-HRIS fork) mapped to [Frappe HR](https://docs.frappe.io/hr/introduction) DocTypes and workflows.

---

## Executive summary

Addbell is a **GP-HRIS fork** customized for Philippine construction payroll (weekly Wed–Tue cutoffs, bundy punches, OT groups, fund requests). It is **strong on clock capture, approvals, payroll runs, and employee self-service**, but **weak on the Frappe “single engine + hard gates” pattern** that GP-HRIS started building in `lib/ph-payroll/`.

| Phase | Frappe HR pattern | Addbell status | Priority |
|-------|-------------------|----------------|----------|
| 1 Automation | Employee Checkin → Auto Attendance | ⚠️ Partial | P2 — wire `/timesheet` to `lib/ph-payroll`; optional nightly job |
| 2 Approval workflow | Submit → approve → lock attendance | ✅ Mostly | P3 — submit/dispute steps (optional) |
| 3 Bulk operations | Payroll Entry → Salary Slips | ✅ Strong | P3 — Salary Structure parity (optional) |
| 4 Validation & alerts | Pre-payroll checks | ✅ Mostly | P2 — Playwright smoke + email alerts |
| 5 Self-service | ESS portal | ✅ Strong | P3 — timesheet submit/dispute |

**Biggest remaining risk:** `/timesheet` status badges and LT/UT are still computed locally (display-only). Payroll numbers (BH/OT/ND/Days Work) use `lib/ph-payroll` on timesheet and payslip.

---

## Reference: Frappe HR module map

| Frappe HR / ERPNext | Addbell equivalent | Notes |
|---------------------|-------------------|--------|
| Employee | `employees` + `profiles` | Rates on employee row, not Salary Structure |
| Employee Checkin | `time_entries` (punch IN/OUT) | Portal bundy, biometric, admin manual punch |
| Shift Type / Assignment | `employee_week_schedules` (partial) | Not driving auto-attendance rules |
| Attendance | `weekly_attendance` + live regen | Cache + on-the-fly generation |
| Leave Application | `leave_requests` | Manager → HR stages |
| Overtime / Timesheet | `overtime_requests` + OT clock | Approved OT merged into attendance |
| Payroll Entry | `payroll_runs` | Draft → processing → finalized |
| Salary Structure | `employees.base_rate`, `salary_basis` | `utils/payroll-calculator.ts` multipliers |
| Salary Slip | `payslips` | Individual UI + bulk via payroll run |
| Additional Salary / Deductions | `deductions`, loans, payslip breakdown | Statutory in `utils/ph-deductions.ts` |

**GP-HRIS fork addition (ported Jun 2026):** `lib/ph-payroll/` — `buildCutoffAttendance`, `attendance-cutoff`, `payroll-entry-validation`, `timesheet-review`. Wired on `payslips/page.tsx`, `generate-payslips/route.ts`, `timesheet-review`, and employee **My Timesheet**. `/timesheet` HR view still uses inline logic.

---

## Phase 1 — Automation (clock → attendance)

**Frappe pattern:** Employee Checkin logs → **Auto Attendance** (scheduled/shift rules) → Attendance records.

### What Addbell has ✅

| Capability | Location |
|------------|----------|
| Bundy clock IN/OUT (portal) | `app/employee-portal/bundy/page.tsx`, `app/api/employee-portal/clock-punch/route.ts` |
| Punch → sessions | `lib/timeEntries.ts` |
| Business day (7 AM Manila, 23h auto-out) | `lib/bundy-business-day.ts`, `lib/bundy-auto-clock-out.ts` |
| Biometric / attlog import | `app/api/biometric/punch/route.ts`, `app/time-entries/attlog-import/page.tsx` |
| Auto timesheet from punches | `lib/timesheet-auto-generator.ts` |
| Bulk auto-generate API | `app/api/timesheet/auto-generate/route.ts` |
| HR timesheet view | `app/timesheet/page.tsx` (regenerates from punches + FTL + OT) |
| Admin time entries | `app/time-entries/page.tsx` |

### Gaps vs Frappe / GP-HRIS ⚠️

1. **No scheduled Auto Attendance** — generation is on-demand (page load / API), not nightly/cron.
2. **Dual source of truth:**
   - **Path A:** Live regen from `time_entries` (payslip page, payroll run generate) — *primary in practice*
   - **Path B:** `weekly_attendance` rows — *optional cache*
3. ~~**Period model drift:**~~ ✅ Auto-generate now writes `period_type: "weekly"` and `status: "draft"`.
4. **Legacy docs** still reference `time_clock_entries` (removed); see `docs/guides/PAYSLIP_GENERATION_LOGIC.md`.
5. **`computeDaysWork` not wired on `/timesheet`** — exported in `lib/ph-payroll/attendance-cutoff.ts` but HR timesheet footer still rolls up BH inline; payslip breakdown uses parallel logic in `PayslipDetailedBreakdown`.
6. **Shift-driven rules** — Frappe links checkins to Shift Type; Addbell uses `determineDayType` + holidays DB + schedule flags, not shift auto-rules.

### Known issues (production history)

- Bundy superseded IN / stale sessions / 6:59 auto-out (addressed in code + SQL cleanup scripts).
- Holiday pay when period starts on RH — needs 7-day punch lookback (`HOLIDAY_ELIGIBILITY_LOOKBACK_DAYS`).
- Jan 5 2026 missing clock-ins — `docs/debugging/JAN_5_2026_CLOCK_IN_ANALYSIS.md`.

### Phase 1 recommendations

1. Port or reintroduce GP-HRIS **`lib/ph-payroll/attendance-cutoff.ts`** pattern: one function used by timesheet + payslip + reports.
2. Align `weekly_attendance.period_type` and all generators to **weekly** cutoffs only.
3. Add optional nightly job: auto-generate `weekly_attendance` for active employees for current cutoff.
4. Archive/update docs that mention `time_clock_entries` and bi-monthly as primary.

---

## Phase 2 — Approval workflow

**Frappe pattern:** Leave Application / OT → approvers → **Attendance marked** → timesheet locked before payroll.

### What Addbell has ✅

| Workflow | Location |
|----------|----------|
| Leave (manager → HR) | `app/leave-approval/page.tsx`, `app/employee-portal/leave-request/` |
| OT (ops manager → HR) | `app/overtime-approval/page.tsx`, OT group routing in `lib/manager-approval-queue.ts` |
| Failure to log | `app/failure-to-log-approval/page.tsx`, `lib/ftl-ot-synthesis.ts` |
| Dashboard queue | `lib/fetch-dashboard-approval-queue.ts`, `app/dashboard/HRDashboard.tsx` |
| Fund requests (separate) | `app/fund-request/`, `app/fund-request-approval/` |

### Gaps vs Frappe / GP-HRIS ⚠️

1. **`weekly_attendance` workflow is thin:** `draft | finalized` only — no submit/approve steps.
2. **Auto-generate auto-finalizes** (`app/api/timesheet/auto-generate/route.ts` sets `status: "finalized"`) — skips HR review.
3. **Documented but missing:**
   - `/timesheet-review` page — in `docs/guides/IMPLEMENTATION_SUMMARY.md`, **not in repo**
   - `083_add_timesheet_approval_workflow.sql` — **not in repo** (use `20260429_create_weekly_attendance.sql`)
4. **Time entry approve/reject on `/time-entries`** — stub; punches don’t use per-entry approval like Frappe checkin validation.
5. **Payslip generation does not require finalized timesheet** — bulk path regenerates from live data.

### Phase 2 recommendations

1. ~~Implement **Timesheet Review** page~~ ✅ `app/timesheet-review/page.tsx` (Jun 2026, Sprint B)
2. ~~Change auto-generate default to `draft`~~ ✅ HR finalizes on review page
3. ~~Gate `generate-payslips` on finalized `weekly_attendance`~~ ✅ Admin override with reason
4. Keep leave/OT/FTL as-is — already matches Frappe Leave Application pattern well.

---

## Phase 3 — Bulk operations

**Frappe pattern:** **Payroll Entry** selects employees + period → validates → creates **Salary Slips** in batch.

### What Addbell has ✅

| Capability | Location |
|------------|----------|
| Payroll runs (batch container) | `app/payroll/page.tsx`, `payroll_runs` table |
| Bulk payslip generation | `app/api/payroll-runs/generate-payslips/route.ts` |
| Exports after finalize | `export-payroll-excel`, `export-payroll-table`, `payslip-print` |
| Payroll register | ~~`/reports`~~ disabled Jun 2026 — redirects to `/payroll`; code kept in `lib/ph-payroll/payroll-register.ts` |
| Individual payslip editor | `app/payslips/page.tsx` (large, full breakdown) |

### Gaps vs Frappe / GP-HRIS ⚠️

1. ~~**No `validatePayrollEntry`**~~ ✅ `lib/ph-payroll/payroll-entry-validation.ts` + `PayrollReadinessPanel` on `/payroll`.
2. **Two bulk paths:** payroll run batch vs manual per-employee save on `/payslips` — can produce different snapshots.
3. **Documented `/api/payslip/bulk-generate`** — **missing**; replaced by payroll-runs route.
4. **No Salary Structure components** — earnings are computed in `PayslipDetailedBreakdown` + `payroll-calculator`, not configurable rows like Frappe Salary Component.

### Phase 3 recommendations

1. Add **Pre-Generate checklist** on payroll run: missing punches, pending OT/leave, zero-rate employees, unfinalized timesheets.
2. Port GP-HRIS `validatePayrollEntry` / `summarizePayrollEntry` into Addbell `lib/ph-payroll/` (new module).
3. Prefer payroll run as **only** bulk path; demote individual save to exceptions/corrections.

---

## Phase 4 — Validation & alerts

**Frappe pattern:** Payroll Entry submission blocked until attendance/submitted documents valid; reports for exceptions.

### What Addbell has ✅

- Payroll run **finalize** blocks Excel/PDF export until `status = finalized`.
- Payslip edit lock when linked to finalized run (`app/payslips/page.tsx`).
- Clock location validation (office geofence).
- SIL / leave validation on portal.

### Gaps ❌

1. ~~No **pre-payroll validation dashboard**~~ ✅ `PayrollReadinessPanel` + `GET /api/payroll-runs/validate`.
2. No email/notification alerts (listed as future in `IMPLEMENTATION_SUMMARY.md`).
3. ~~**No attendance finalize gate**~~ ✅ `canGeneratePayslipForTimesheet` on bulk generate (admin override).
4. Calculation verification docs exist but no automated regression suite tied to payroll runs:
   - `docs/debugging/DEC_1-15_PAYSLIP_ISSUE.md`
   - `docs/VERIFICATION_PAYSLIP_TIME_ATTENDANCE_CALCULATIONS.md`

### Phase 4 recommendations

1. Build **Cutoff Readiness** panel on `/payroll` (green/yellow/red per employee).
2. Wire Playwright smoke tests for: clock → timesheet RH → payslip gross (Carizza May 27 case).
3. Add admin alert when payroll run generated with live regen while timesheet not finalized.

---

## Phase 5 — Self-service (employee portal)

**Frappe pattern:** Mobile ESS — check-in, leave, payslips, profile.

### What Addbell has ✅

| Feature | Location |
|---------|----------|
| Portal shell + nav | `app/employee-portal/`, `components/EmployeePortalSidebar.tsx` |
| Bundy + attendance preview | `app/employee-portal/bundy/page.tsx` |
| Payslips list + preview | `app/employee-portal/payslips/page.tsx` |
| Leave / OT / FTL filing | `app/employee-portal/leave-request`, `overtime`, `failure-to-log` |
| Fund requests | `app/employee-portal/fund-request/` |
| Project time | `app/employee-portal/project-time/` |
| Playwright tests | `tests/leave-request-employee.spec.ts`, `payslips-employee.spec.ts`, etc. |

### Gaps ⚠️

1. No **submit timesheet for approval** or dispute workflow (Frappe ESS attendance confirm).
2. ~~Payslip download is print/preview only~~ ✅ `GET /api/employee-portal/payslips/pdf`.
3. Schedule coverage uneven — many employees without `employee_week_schedules` (see Jan 5 analysis).
4. `IMPLEMENTATION_SUMMARY.md` still says “employees cannot view payslips” — **stale** (portal payslips exist).

### Phase 5 recommendations

1. Add read-only **My Timesheet** for cutoff with “Request correction” link to FTL.
2. Update employee portal guide + remove stale IMPLEMENTATION_SUMMARY claims.
3. Backfill schedules for payroll cohort employees.

---

## GP-HRIS fork parity checklist

Items GP-HRIS has (or documented) that Addbell should track:

| GP-HRIS artifact | Addbell status |
|------------------|----------------|
| `lib/ph-payroll/` unified engine | ✅ Ported (Jun 2026) |
| `attendance-cutoff.ts` (one engine, multiple views) | ✅ Payslip + bulk generate + timesheet |
| `payroll-entry-validation.ts` | ✅ |
| `bulk-payslip.ts` / Payroll Entry API | ⚠️ Replaced by `payroll-runs/generate-payslips` |
| `/timesheet-review` | ✅ |
| `/api/payslip/bulk-generate` | ❌ Missing (renamed route) |
| `083_add_timesheet_approval_workflow.sql` | ❌ Different migration (`20260429_*`) |
| Payroll audit upload (`payroll_audit` tables) | ❌ Not in Addbell |
| Legacy Admin pages (`/audit`, `/bir-reports`) | ⚠️ Routes exist; not wired to Addbell DB |

---

## Recommended implementation order (Frappe-aligned)

### Sprint A — Single engine (Phase 1 + 4 foundation) ✅

1. ~~Create `lib/ph-payroll/`~~ ✅
2. ~~Point payslip, bulk generate, and `/timesheet`~~ ✅ `buildCutoffAttendance` + `resolveDaysWorkTotals` / `computeDaysWork`
3. ~~Standardize weekly period~~ ✅ auto-generate + payroll runs

### Sprint B — Lock cutoff (Phase 2 + 4) ✅

1. ~~Add `/timesheet-review`~~ ✅
2. ~~Auto-generate → `draft`~~ ✅
3. ~~`generate-payslips` finalize gate~~ ✅

### Sprint C — Payroll Entry parity (Phase 3 + 4) ✅

1. ~~`validatePayrollEntry` before bulk generate on `/payroll`~~ ✅ `GET /api/payroll-runs/validate`
2. ~~Cutoff readiness UI + export blocked employees list~~ ✅ `PayrollReadinessPanel` on payroll run detail

### Sprint D — ESS polish (Phase 5) ✅

1. ~~Portal “My cutoff hours” + FTL correction CTA~~ ✅ `/employee-portal/my-timesheet`
2. ~~PDF payslip download API~~ ✅ `GET /api/employee-portal/payslips/pdf`

---

## Doc hygiene (stale references to fix)

| File | Issue |
|------|--------|
| `docs/guides/IMPLEMENTATION_SUMMARY.md` | Claims timesheet-review + bulk-generate routes that don’t exist |
| `docs/guides/PAYROLL_BEST_PRACTICES.md` | Still describes manual timesheet as primary gap |
| `docs/guides/PAYSLIP_GENERATION_LOGIC.md` | `time_clock_entries`, bi-monthly flow |
| `docs/README.md` | Titled “GP-HRIS Documentation” — see root `README.md` for Addbell |

---

## Conclusion

Addbell now implements **most of Frappe HR’s employee-facing, approval, and payroll-entry validation surface**. Remaining gap vs GP-HRIS/Frappe is mainly **one attendance engine on every screen** (`/timesheet` HR view) and optional ESS timesheet submit/dispute.

Bulk payslip generation is gated on **finalized `weekly_attendance`** (with admin override) and **Payroll Entry validation** before generate — aligned with Frappe’s Payroll Entry → finalized attendance → Salary Slip contract.

---

*Audit methodology mirrors GP-HRIS `docs/guides/PAYROLL_BEST_PRACTICES.md` Phases 1–5 and Frappe HR module boundaries (Checkin, Attendance, Leave, Payroll Entry, Salary Slip).*
