# Payroll Register — Addbell vs Frappe HR Audit

**Date:** June 2026  
**Page:** `app/reports/page.tsx` (`/reports`, sidebar: People → Payroll Register)  
**Method:** Same Frappe HR DocType mapping as `docs/ADDBELL_FRAPPE_HRIS_5_PHASE_AUDIT.md`.

---

## What it is in Frappe HR

| Frappe HR | Role |
|-----------|------|
| **Salary Slip** | One employee × one payroll period — earnings + deductions |
| **Payroll Entry** | Batch container that generates salary slips |
| **Salary Register / reports** | Consolidated view of **submitted salary slips** for finance — not a generation screen |

Frappe’s register is always **downstream of saved salary slips**. It does not regenerate from attendance.

---

## What Addbell had (before enhancement)

| Aspect | Status | Issue |
|--------|--------|-------|
| Route & export | ✅ PDF + CSV | Works when data exists |
| Data source | ⚠️ `payslips` + `weekly_attendance` + allowances + deductions | Correct tables |
| Period model | ❌ Bi-monthly only (`Jun 1–15`) | Payslips use **weekly Wed–Tue** → empty register |
| Row scope | ❌ All active employees | Rows with zeros even when no payslip |
| Earnings shape | ⚠️ Assumes `earnings_breakdown` is array | Saved payslips use `{ attendance_data, payroll_result }` object |
| Rate resolution | ⚠️ `per_day` / `monthly_rate` only | Ignores `base_rate` + `salary_basis` |
| Engine sharing | ❌ Inline math in page | Not using `lib/ph-payroll/` or `normalizeEarningsBreakdownForExport` |

**Root cause of “No data”:** Register queried `period_start = 2026-06-01` while payroll runs saved slips like `2026-05-28 → 2026-06-03`.

---

## Frappe-aligned target (Addbell-specific)

Addbell keeps **weekly** as the payroll truth. The register should:

1. **Default to weekly cutoff** (Wed–Tue) — matches `/timesheet`, `/payslips`, `/payroll`.
2. **Optional semi-monthly rollup** — sum weekly payslips overlapping `1–15` or `16–end` for finance.
3. **Only list employees with payslips** in the selected window.
4. **Read saved slip snapshots** — same as Frappe; no live punch regen on this page.
5. **Use shared parsers** — `normalizeEarningsBreakdownForExport`, `getRatePerHour`.

---

## Phase mapping (5-phase audit)

| Phase | Register relevance | Before | After enhancement |
|-------|-------------------|--------|-------------------|
| **1 Automation** | Register reads output of attendance engine | Mismatched period | Weekly mode aligned with engine |
| **2 Approval** | Should prefer finalized/paid slips | No status filter | Shows draft/paid; semi-monthly sums all saved |
| **3 Bulk ops** | Aggregates payroll-run slips | Bi-monthly key miss | Weekly + rollup queries |
| **4 Validation** | Empty state / coverage stats | Generic “no data” | Explains missing slips + week count |
| **5 Self-service** | N/A (admin/finance only) | — | — |

---

## Implementation (Sprint: Payroll Register)

| Item | Location |
|------|----------|
| Period resolver + row builder | `lib/ph-payroll/payroll-register.ts` |
| UI: weekly default + semi-monthly toggle | `app/reports/page.tsx` |
| Exports | Unchanged format; labels use resolved period |

### Not in scope (future)

- Live regen from punches on register page (anti-Frappe; keep on `/payslips`)
- `validatePayrollEntry` gate (belongs on `/payroll`, Sprint C)
- PDF payslip download API (Sprint D)

---

## Comparison vs GP-HRIS

| GP-HRIS | Addbell (enhanced) |
|---------|-------------------|
| Bi-monthly primary | **Weekly primary**, semi-monthly optional rollup |
| `aggregateCutoffDeductions` row schema | Wide `employee_deductions` per `period_start` (unchanged) |
| `/payroll-entry` generates drafts | `/payroll` payroll runs |
| Register at `/reports` | Same route; period logic fixed |

Addbell does **not** need GP-HRIS parity — it needs **Frappe pattern** (saved slips → register) on **Addbell’s weekly model**.
