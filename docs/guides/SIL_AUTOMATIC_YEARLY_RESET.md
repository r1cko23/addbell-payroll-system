# SIL Automatic Yearly Reset

## Overview

The SIL (Service Incentive Leave) credits are now automatically reset at the start of each calendar year (January 1st) using a PostgreSQL cron job.

## Implementation

### Migration: 069_auto_sil_reset_yearly.sql

This migration creates:

1. **Function: `reset_all_sil_credits_yearly()`**
   - Resets all employees' SIL credits for the new year
   - Processes employees whose `sil_balance_year` differs from the current year
   - Returns statistics: employees reset, already reset, and errors

2. **Scheduled Job: `sil-yearly-reset`**
   - Runs automatically on **January 1st at 00:01 AM** each year
   - Uses PostgreSQL's `pg_cron` extension
   - Status: ✅ Active

## How It Works

### Automatic Reset Process

1. **Trigger**: On January 1st at 00:01 AM, the cron job executes
2. **Reset Logic**: 
   - Sets `sil_credits` = 0
   - Sets `sil_last_accrual` = NULL
   - Updates `sil_balance_year` to current year
3. **Accrual Application**: 
   - Employees < 1 year: Continue accruing on hire date day
   - Employees >= 1 year: Start accruing from January 1st

### Manual Execution

You can also manually trigger the reset function:

```sql
SELECT * FROM public.reset_all_sil_credits_yearly();
```

This returns:
- `employees_reset`: Number of employees reset
- `employees_already_reset`: Number already in current year
- `errors`: Number of errors encountered

## Verification

### Check Cron Job Status

```sql
SELECT jobid, jobname, schedule, command, active 
FROM cron.job 
WHERE jobname = 'sil-yearly-reset';
```

Expected result:
- `jobname`: `sil-yearly-reset`
- `schedule`: `1 0 1 1 *` (January 1st at 00:01 AM)
- `active`: `true`

### Check Employee Reset Status

```sql
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN sil_balance_year = EXTRACT(YEAR FROM CURRENT_DATE) THEN 1 END) as current_year,
  COUNT(CASE WHEN sil_balance_year < EXTRACT(YEAR FROM CURRENT_DATE) THEN 1 END) as needs_reset
FROM employees;
```

## Benefits

1. **Automatic**: No manual intervention required
2. **Consistent**: All employees reset at the same time
3. **Reliable**: Uses PostgreSQL's built-in cron scheduler
4. **Auditable**: Function returns statistics on execution

## Troubleshooting

### If Cron Job Doesn't Run

1. **Check Extension**: Verify pg_cron is enabled
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_cron';
   ```

2. **Check Job Status**: Verify job is active
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'sil-yearly-reset';
   ```

3. **Manual Execution**: Run manually if needed
   ```sql
   SELECT * FROM public.reset_all_sil_credits_yearly();
   ```

### If Errors Occur

The function logs warnings for individual employee errors but continues processing. Check PostgreSQL logs for details:

```sql
SELECT * FROM cron.job_run_details 
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'sil-yearly-reset')
ORDER BY start_time DESC 
LIMIT 10;
```

## Related Files

- `supabase/migrations/069_auto_sil_reset_yearly.sql` - Migration file
- `supabase/migrations/068_fix_sil_accrual_after_reset.sql` - Fixed accrual logic
- `scripts/reset-sil-for-2026.js` - Manual reset script (for reference)

## Notes

- The cron job runs at 00:01 AM to ensure it executes early in the day
- The function is idempotent - safe to run multiple times
- Individual employee errors don't stop the entire process
- The reset happens automatically, but accrual still requires the `refresh_employee_leave_balances()` function to be called (which happens when employees access their leave credits)

