# Loan Bi-Monthly Deduction Option

## Overview

The loan management system now supports an optional **bi-monthly deduction** setting that controls how loan payments are calculated per cutoff.

## Feature Details

### Database Schema

A new column `deduct_bi_monthly` (BOOLEAN, default: `true`) has been added to the `employee_loans` table:

```sql
ALTER TABLE public.employee_loans
ADD COLUMN IF NOT EXISTS deduct_bi_monthly BOOLEAN DEFAULT true NOT NULL;
```

### Behavior

**When `deduct_bi_monthly = true` (Default):**
- Monthly payment is **divided by 2** for each cutoff
- Example: ₱1,000/month loan = ₱500 per cutoff
- Terms reduction: 0.5 terms per cutoff (full term completed after both cutoffs)
- This maintains backward compatibility with existing loans

**When `deduct_bi_monthly = false`:**
- **Full monthly payment** is deducted per cutoff
- Example: ₱1,000/month loan = ₱1,000 per cutoff
- Terms reduction: 1.0 term per cutoff (full term completed in one cutoff)

### UI

A checkbox has been added to the loan creation/edit form:
- **Label:** "Deduct Bi-Monthly (Divide by 2)"
- **Location:** After the "Cutoff Assignment" field
- **Default:** Checked (true)
- **Tooltip:** Explains the behavior when checked vs unchecked

### Payroll Calculation

The payslip generation logic checks the `deduct_bi_monthly` flag:

```typescript
const paymentAmount = loan.deduct_bi_monthly !== false
  ? loan.monthly_payment / 2
  : loan.monthly_payment;
```

### Loan Balance Update

When updating loan balances after payroll generation:

```typescript
const deductBiMonthly = loan.deduct_bi_monthly !== false;
const deductionAmount = deductBiMonthly
  ? loan.monthly_payment / 2
  : loan.monthly_payment;
const termsReduction = deductBiMonthly ? 0.5 : 1.0;
```

## Use Cases

### Bi-Monthly Deduction (Default)
- **Use when:** Loan payments should be split across two cutoffs per month
- **Example:** ₱10,000 loan over 10 months = ₱1,000/month = ₱500 per cutoff
- **Best for:** Most standard loans where payments are spread evenly

### Monthly Deduction
- **Use when:** Full monthly payment should be deducted in a single cutoff
- **Example:** ₱10,000 loan over 10 months = ₱1,000/month = ₱1,000 per cutoff
- **Best for:** Loans that need to be paid in full per cutoff period

## Migration

Existing loans default to `deduct_bi_monthly = true` to maintain current behavior. No manual migration is required.

## Files Modified

1. **Database Migration:** `supabase/migrations/146_add_deduct_bi_monthly_to_loans.sql`
2. **Loan Interface:** `app/loans/page.tsx` (EmployeeLoan interface, form state, UI checkbox)
3. **Payroll Calculation:** `app/payslips/page.tsx` (payment amount and terms reduction logic)
4. **Payment History:** `app/loans/page.tsx` (expected payment calculation)