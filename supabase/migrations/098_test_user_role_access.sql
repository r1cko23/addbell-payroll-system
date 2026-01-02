-- =====================================================
-- 098: Test User Role Access for Payslips
-- =====================================================
-- Run this while logged in as Admin HR to diagnose the issue
-- =====================================================

-- Test 1: Check if auth.uid() returns a value
SELECT 
    auth.uid() as current_auth_uid,
    auth.role() as current_auth_role;

-- Test 2: Check if user exists in users table
SELECT 
    id,
    email,
    role,
    is_active
FROM public.users
WHERE id = auth.uid();

-- Test 3: Test get_user_role() function
SELECT 
    public.get_user_role() as user_role_from_function;

-- Test 4: Test direct EXISTS query (what the fallback policy uses)
SELECT 
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.is_active = true
      AND u.role IN ('admin', 'hr')
    ) as is_admin_or_hr;

-- Test 5: List all current payslips policies
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'payslips'
ORDER BY cmd, policyname;

-- Test 6: Try to SELECT from payslips (this should work if policies are correct)
-- Uncomment the line below to test:
-- SELECT id, payslip_number FROM public.payslips LIMIT 1;










