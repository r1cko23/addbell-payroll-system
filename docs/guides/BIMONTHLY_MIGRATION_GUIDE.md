# Bi-Monthly Migration Guide

## Overview

This guide documents the migration from weekly to bi-monthly payroll periods (every 2 weeks, Monday-Friday).

## Changes Made

### 1. Database Schema (`011_bimonthly_periods.sql`)

- Renamed `week_start_date` → `period_start`
- Renamed `week_end_date` → `period_end`
- Added `period_type` field (default: 'bimonthly')
- Updated indexes and constraints

### 2. Utility Functions Created

#### `utils/bimonthly.ts`

- `getBiMonthlyPeriodStart()` - Gets Monday start of bi-monthly period
- `getBiMonthlyPeriodEnd()` - Gets Friday end (13 days later)
- `getBiMonthlyWorkingDays()` - Returns 10 working days (Mon-Fri x 2 weeks)
- `getNextBiMonthlyPeriod()` - Next period (14 days later)
- `getPreviousBiMonthlyPeriod()` - Previous period (14 days earlier)
- `formatBiMonthlyPeriod()` - Format for display

#### `utils/ph-deductions.ts`

- `calculateMonthlySalary()` - Calculate from daily rate
- `calculateSSS()` - SSS contribution based on salary brackets
- `calculatePagIBIG()` - Pag-IBIG contribution based on salary brackets
- `calculatePhilHealth()` - PhilHealth contribution based on salary brackets
- `calculateAllContributions()` - All contributions for bi-monthly period

### 3. Files to Update

#### Completed:

- ✅ Migration script created
- ✅ Utility functions created
- ✅ Partial timesheet page updates

#### Still Need Updates:

- ⏳ Complete timesheet page (`app/timesheet/page.tsx`)

  - Replace all `weekDays` → `periodDays`
  - Replace all `weekStart` → `periodStart`
  - Update database queries to use `period_start` instead of `week_start_date`
  - Update UI text from "Weekly" to "Bi-Monthly"
  - Update period navigation (14 days instead of 7)
- ⏳ Deductions page (`app/deductions/page.tsx`)

  - Update to bi-monthly periods
  - Auto-calculate SSS, Pag-IBIG, PhilHealth based on daily rate
  - Use `calculateAllContributions()` utility
- ⏳ Payslip generation (`app/payslips/page.tsx`)

  - Update to bi-monthly periods
  - Update period display
- ⏳ Timekeeper utilities (`lib/timekeeper.ts`)

  - Update `fetchWeeklyTimeEntries` to work with bi-monthly periods

## Running the Migration

1. **Run the database migration:**

```sql
-- Run in Supabase SQL Editor
\i supabase/migrations/011_bimonthly_periods.sql
```

2. **Update existing data:**

```sql
-- Update existing records to have period_end
UPDATE weekly_attendance 
SET period_end = period_start + INTERVAL '13 days'
WHERE period_end IS NULL;

UPDATE employee_deductions 
SET period_end = period_start + INTERVAL '13 days'
WHERE period_end IS NULL;
```

## Testing Checklist

- [ ] Timesheet shows 10 working days (Mon-Fri x 2 weeks)
- [ ] Period navigation moves 14 days forward/backward
- [ ] Deductions auto-calculate based on daily rate
- [ ] Payslip generation works with bi-monthly periods
- [ ] Database queries use `period_start` instead of `week_start_date`

## Notes

- Bi-monthly period = 2 weeks = 14 days total
- Working days = Monday-Friday only = 10 days per period
- Period starts on Monday, ends on Friday (13 days later)
- Deductions are calculated monthly, then divided by 2 for bi-monthly
