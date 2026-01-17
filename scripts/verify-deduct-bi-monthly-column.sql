-- Verify that deduct_bi_monthly column exists in employee_loans table
-- Run this in Supabase SQL Editor to check if the migration was applied

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'employee_loans'
  AND column_name = 'deduct_bi_monthly';

-- If the query returns a row, the column exists ✅
-- If the query returns no rows, run the migration in 146_add_deduct_bi_monthly_to_loans.sql
