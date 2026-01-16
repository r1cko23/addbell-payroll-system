# Loan Bi-Monthly Deduction System

## Overview

All employee loans are now deducted **bi-monthly** (twice per month), regardless of how the loan payment is calculated. The monthly payment amount is automatically split in half for each cutoff period.

## How It Works

### Loan Calculation
- Loans are calculated with **monthly payment amounts**
- Example: ₱10,000 loan with 10 terms = ₱1,000/month

### Bi-Monthly Deduction
- Monthly payment is **always divided by 2** for each cutoff
- Example: ₱1,000/month = **₱500 per cutoff**

### Cutoff Assignment

The `cutoff_assignment` field controls **which cutoff(s)** the loan is deducted in:

| Assignment | Deduction Schedule | Monthly Total |
|------------|-------------------|---------------|
| **"first"** | ₱500 in 1st cutoff only (days 1-15) | ₱500/month |
| **"second"** | ₱500 in 2nd cutoff only (days 16-31) | ₱500/month |
| **"both"** | ₱500 in 1st cutoff + ₱500 in 2nd cutoff | ₱1,000/month |

## Examples

### Example 1: Company Loan
- **Loan Amount:** ₱10,000
- **Terms:** 10 months
- **Monthly Payment:** ₱1,000
- **Cutoff Assignment:** "both"
- **Deduction:**
  - 1st cutoff (days 1-15): ₱500
  - 2nd cutoff (days 16-31): ₱500
  - **Total per month:** ₱1,000 ✓

### Example 2: Emergency Loan
- **Loan Amount:** ₱6,000
- **Terms:** 6 months
- **Monthly Payment:** ₱1,000
- **Cutoff Assignment:** "first"
- **Deduction:**
  - 1st cutoff (days 1-15): ₱500
  - 2nd cutoff (days 16-31): ₱0
  - **Total per month:** ₱500

### Example 3: SSS Loan
- **Loan Amount:** ₱24,000
- **Terms:** 24 months
- **Monthly Payment:** ₱1,000
- **Cutoff Assignment:** "second"
- **Deduction:**
  - 1st cutoff (days 1-15): ₱0
  - 2nd cutoff (days 16-31): ₱500
  - **Total per month:** ₱500

## Terms Reduction

- **Terms reduction:** Always **0.5 terms per cutoff**
- **Reason:** Since we're doing bi-monthly deductions, one full term is completed after both cutoffs in a month
- **Example:** A 10-term loan will complete after 20 cutoffs (10 months × 2 cutoffs/month)

## Implementation Details

### Payslip Calculation (`app/payslips/page.tsx`)

```typescript
// Calculate payment amount - always divide by 2 for bi-monthly deductions
const paymentAmount = loan.monthly_payment / 2;
```

### Balance Update (`updateLoanBalancesAndTerms`)

```typescript
// Calculate deduction amount - always divide by 2
const deductionAmount = parseFloat(loanRecord.monthly_payment) / 2;

// Calculate terms reduction - always 0.5 terms per cutoff
const termsReduction = 0.5;
```

## Benefits

1. **Consistent Deductions:** All loans follow the same bi-monthly pattern
2. **Flexible Scheduling:** Cutoff assignment allows control over when deductions occur
3. **Accurate Tracking:** Terms are properly reduced based on bi-monthly schedule
4. **Employee-Friendly:** Smaller, more frequent deductions are easier to manage

## Notes

- Loans are still calculated with monthly payment amounts for simplicity
- The bi-monthly split happens automatically during payroll processing
- `cutoff_assignment` only affects **which cutoff(s)** to deduct in, not the amount
- All active loans with `current_balance > 0` are eligible for deduction
