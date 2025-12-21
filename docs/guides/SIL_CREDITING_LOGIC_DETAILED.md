# SIL Crediting Logic - Detailed Explanation

## Current Date: December 20, 2025

## Step-by-Step Logic

### Step 1: Check Annual Reset
**Condition**: `sil_balance_year` ≠ current year (2025)

**Action**:
- Set `sil_credits` = 0
- Set `sil_last_accrual` = NULL
- Set `sil_balance_year` = 2025

**Why**: Credits reset at the start of each calendar year

---

### Step 2: Determine Employee Status Based on Hire Date

#### Case A: Employee has NO hire_date
**Result**: 
- `sil_credits` = 0
- `sil_balance_year` = 2025
- `sil_last_accrual` = NULL
- **No accrual happens**

---

#### Case B: Employee hired LESS than 1 year ago
**Condition**: `hire_date` + 1 year > TODAY (Dec 20, 2025)
**Example**: Hired July 7, 2025 → First anniversary is July 7, 2026

**Result**:
- `sil_credits` = 0 (hasn't reached 1-year mark yet)
- `sil_balance_year` = 2025
- `sil_last_accrual` = NULL
- **No accrual happens until first anniversary**

---

#### Case C: Employee reached FIRST ANNIVERSARY in 2025
**Condition**: 
- `hire_date` + 1 year ≤ TODAY
- AND anniversary year = 2025
- AND `sil_last_accrual` is NULL (hasn't been granted yet)

**Example**: 
- Hired: November 10, 2024
- First anniversary: November 10, 2025
- Today: December 20, 2025

**Result**:
- `sil_credits` = 10 (one-time grant)
- `sil_balance_year` = 2025
- `sil_last_accrual` = 2025-12-20 (today)
- **Full 10 credits granted, valid until Dec 31, 2025**

---

#### Case D: Employee PAST first anniversary (subsequent years)
**Condition**: 
- `hire_date` + 1 year < TODAY
- AND current year (2025) > anniversary year
- Example: Hired Jan 27, 2020 → Anniversary was Jan 27, 2021 (past)

**Calculation**:
1. If `sil_last_accrual` is NULL → set to Jan 1, 2025 (start of year)
2. Calculate months since last accrual:
   ```
   months = (2025 - accrual_year) * 12 + (12 - accrual_month)
   ```
3. Accrue credits:
   ```
   credits = MIN(10, months × 0.8333)
   ```

**Example Scenarios**:

**Scenario D1: Long-term employee, never accrued in 2025**
- Hired: May 1, 2014
- Last accrual: NULL
- Months to accrue: 12 (Jan 1 to Dec 20, 2025)
- Credits: MIN(10, 12 × 0.8333) = 10.0

**Scenario D2: Employee accrued earlier in 2025**
- Hired: Jan 27, 2020
- Last accrual: Dec 1, 2025
- Months since last accrual: 0 (same month)
- Credits: No change (already at 10)

**Scenario D3: Employee accrued in previous month**
- Hired: June 24, 2024
- Last accrual: Nov 1, 2025
- Months since last accrual: 1 month (Nov to Dec)
- Credits: MIN(10, 1 × 0.8333) = 0.8333 (added to existing)

---

## Summary Table

| Hire Date Status | First Anniversary | Current Credits Logic |
|-----------------|-------------------|----------------------|
| No hire_date | N/A | 0 credits |
| < 1 year ago | Future | 0 credits (wait for anniversary) |
| Anniversary in 2025 | 2025 | 10 credits (one-time grant) |
| Anniversary before 2025 | Past | Monthly accrual: months × 0.8333 (max 10) |

## Key Rules

1. **Annual Reset**: Credits reset to 0 on Jan 1 of each year
2. **First Anniversary**: One-time grant of 10 credits in the anniversary year
3. **Subsequent Years**: Monthly accrual of 0.8333 credits (10/12)
4. **Maximum Cap**: 10 credits per calendar year
5. **Monthly Calculation**: Based on months since last accrual date

## Current Date Context

- **Today**: December 20, 2025
- **Current Year**: 2025
- **Employees should have**: Credits for calendar year 2025
- **Next Reset**: January 1, 2026 (all credits reset to 0)

