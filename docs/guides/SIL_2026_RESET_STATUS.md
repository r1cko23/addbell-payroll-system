# SIL 2026 Reset Status & Logic Verification

## Current Status (January 2026)

### Reset Status
- **Total Employees**: 58
- **Reset to 2026**: 17 employees (29%)
- **Still in 2025**: 41 employees (71%)

**Issue**: The reset only happens when `refresh_employee_leave_balances()` is called for each employee. It's a "lazy" reset that occurs on-demand, not automatically for all employees at once.

### Action Required
Run the reset script to ensure all employees are reset for 2026:
```bash
npx tsx scripts/reset-sil-for-2026.ts
```

## SIL Accrual Logic (Verified & Fixed)

### ✅ Annual Reset
- **When**: January 1st of each calendar year
- **What happens**:
  - `sil_credits` → set to `0`
  - `sil_last_accrual` → set to `NULL`
  - `sil_balance_year` → updated to current year (2026)
- **Status**: ✅ Logic is correct

### ✅ Employees Less Than 1 Year
- **Accrual Day**: Same day of month as hire date
- **Accrual Amount**: 0.8333 credits per month
- **Example**: 
  - Hired: January 20, 2025
  - Accrual dates: Feb 20, Mar 20, Apr 20, May 20, ... until Jan 20, 2026 (1-year anniversary)
- **Status**: ✅ Logic is correct

### ✅ Employees >= 1 Year (Fixed)
- **Accrual Day**: 1st of each month
- **Accrual Amount**: 0.8333 credits per month
- **Start Date**: January 1st of current year (after reset)
- **Example**:
  - Employee hired: May 10, 2015 (past 1-year anniversary)
  - After reset on Jan 1, 2026: Start accruing from Jan 1, 2026
  - Accrual dates: Jan 1, Feb 1, Mar 1, Apr 1, ... Dec 1
- **Status**: ✅ Fixed in migration 068

### Bug Fix (Migration 068)
**Problem**: After year reset, employees >= 1 year were starting accrual from the month after their anniversary instead of January 1st.

**Solution**: Modified logic to start from `v_year_start` (January 1st) when `sil_last_accrual IS NULL` after reset.

## Logic Summary

| Tenure Status | Accrual Day | Accrual Amount | Example |
|--------------|-------------|----------------|---------|
| **Less than 1 year** | Same day of month as hire date | 0.8333/month | Hired Jan 20 → Accrue on 20th |
| **>= 1 year** | 1st of each month | 0.8333/month | Always on 1st |
| **Annual Reset** | January 1st | Reset to 0 | All employees |

## Verification Steps

1. ✅ Reset logic checks `sil_balance_year` vs current year
2. ✅ Unused 2025 credits are zeroed out on reset
3. ✅ Employees < 1 year accrue on hire date day
4. ✅ Employees >= 1 year accrue on 1st of month
5. ✅ After reset, employees >= 1 year start from Jan 1st (FIXED)

## Next Steps

1. **Run Reset Script**: Execute `scripts/reset-sil-for-2026.ts` to reset all employees
2. **Verify Results**: Check that all employees have `sil_balance_year = 2026`
3. **Test Accrual**: Verify that employees >= 1 year have `sil_last_accrual = 2026-01-01` and `sil_credits = 0.8333` (for January accrual)

## Example Test Cases

### Test Case 1: Employee < 1 Year
```
Hire Date: November 16, 2025
First Anniversary: November 16, 2026
Current Date: January 15, 2026

Expected:
- sil_balance_year = 2026
- sil_credits = 0.8333 (accrued on Dec 16, 2025)
- sil_last_accrual = 2025-12-16
```

### Test Case 2: Employee >= 1 Year
```
Hire Date: May 10, 2015
First Anniversary: May 10, 2016 (past)
Current Date: January 15, 2026

Expected:
- sil_balance_year = 2026
- sil_credits = 0.8333 (accrued on Jan 1, 2026)
- sil_last_accrual = 2026-01-01
```

### Test Case 3: Employee Exactly 1 Year
```
Hire Date: January 20, 2025
First Anniversary: January 20, 2026
Current Date: January 25, 2026

Expected:
- sil_balance_year = 2026
- sil_credits = 0.8333 (accrued on Jan 1, 2026 - switched to 1st of month rule)
- sil_last_accrual = 2026-01-01
```
