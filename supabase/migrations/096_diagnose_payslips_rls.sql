-- =====================================================
-- 096: Diagnose Payslips RLS Issues
-- =====================================================
-- Run this to check if RLS policies are working correctly
-- =====================================================

-- Check 1: List all current policies on payslips table
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'payslips'
ORDER BY policyname, cmd;

-- Check 2: Verify get_user_role() function exists and works
SELECT
    p.proname as function_name,
    pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname = 'get_user_role';

-- Check 3: Test get_user_role() function (run this while logged in as Admin HR)
-- SELECT public.get_user_role() as current_user_role;

-- Check 4: Verify RLS is enabled on payslips table
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'payslips';

-- Check 5: Count policies by command type
SELECT
    cmd,
    COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'payslips'
GROUP BY cmd
ORDER BY cmd;






