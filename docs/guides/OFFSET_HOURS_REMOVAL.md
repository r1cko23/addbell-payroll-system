# Offset Hours Removal

## Overview

The `offset_hours` field has been removed from the employees table and all related functionality. Offset hours tracking is no longer supported in the system.

## Changes Made

### Migration 070: remove_offset_hours.sql

This migration:

1. **Updated `refresh_employee_leave_balances()` function**
   - Still returns `offset_hours` in the return type for backward compatibility
   - Always returns `0` for `offset_hours` (deprecated)

2. **Updated `approve_overtime_request()` function**
   - Removed all logic that credited `offset_hours` when approving overtime requests
   - Overtime approvals no longer affect offset hours

3. **Updated `calculate_time_clock_hours()` trigger**
   - Removed logic that credited `offset_hours` for regular holiday shifts
   - Clock-out calculations no longer affect offset hours

4. **Updated `get_offset_balance_rpc()` function**
   - Now always returns `0`
   - Maintained for backward compatibility with any existing code that calls it

5. **Dropped `offset_hours` column**
   - Removed from `employees` table
   - All historical offset hours data has been removed

### Script Updates

- **`scripts/parse-excel.js`**: Removed `offset_hours` from the field list

## Impact

### Functions Still Work
- All functions continue to work normally
- `refresh_employee_leave_balances()` still returns `offset_hours` as `0` for backward compatibility
- `get_offset_balance_rpc()` returns `0` for any employee

### No More Offset Tracking
- Overtime approvals no longer credit offset hours
- Clock-out on holidays no longer credits offset hours
- No offset hours are stored or tracked anywhere

## Verification

The following queries confirm the removal:

```sql
-- Verify column is dropped
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'employees' 
AND column_name = 'offset_hours';
-- Should return no rows

-- Verify function returns 0
SELECT public.get_offset_balance_rpc('employee-uuid-here');
-- Should return 0

-- Verify refresh function works
SELECT * FROM public.refresh_employee_leave_balances('employee-uuid-here');
-- Should return sil_credits, maternity_credits, paternity_credits, and offset_hours = 0
```

## Backward Compatibility

- Functions that previously returned `offset_hours` still return it, but always as `0`
- This ensures existing code that expects `offset_hours` in the return value won't break
- Over time, these return values can be removed in future migrations if needed

## Related Files

- `supabase/migrations/070_remove_offset_hours.sql` - Main migration
- `scripts/parse-excel.js` - Updated to remove offset_hours field

## Notes

- Historical migration files still contain references to `offset_hours` - this is expected and fine
- These are historical records and don't affect current functionality
- The only active code referencing `offset_hours` is in migration 070, which handles the deprecation