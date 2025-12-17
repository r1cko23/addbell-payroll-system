# Diagnose Employees Not Showing Issue

## Quick Diagnostic Steps

### 1. Check Browser Console
Open your browser's Developer Tools (F12) and check the Console tab when you visit `/employees`. Look for:
- Any error messages
- Logs starting with "Fetching employees..."
- "Test query result:" logs
- "Full query result:" logs

### 2. Run Migration 040
Run the migration `040_fix_employees_rls_access.sql` in your Supabase SQL Editor.

### 3. Test Direct Query in Supabase
Run this query in Supabase SQL Editor to verify you can access employees:

```sql
-- Test 1: Simple employees query
SELECT id, employee_id, full_name 
FROM public.employees 
LIMIT 5;

-- Test 2: With nested relations
SELECT 
  e.id,
  e.employee_id,
  e.full_name,
  ela.location_id,
  ol.name as location_name
FROM public.employees e
LEFT JOIN public.employee_location_assignments ela ON e.id = ela.employee_id
LEFT JOIN public.office_locations ol ON ela.location_id = ol.id
LIMIT 5;

-- Test 3: Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'employees';
```

### 4. Check Current User
Verify you're authenticated and have the right role:

```sql
-- Check current auth user
SELECT auth.uid(), auth.role(), auth.email();

-- Check your user record
SELECT id, email, role, is_active 
FROM public.users 
WHERE email = 'jericko.razal@greenpasture.ph';
```

### 5. Temporary Workaround
If the nested query is the issue, the code now has a fallback that will:
1. Try the full query with relations
2. If that fails, try a simple query without relations
3. Then fetch relations separately

Check the console logs to see which path it's taking.

## Common Issues

1. **RLS Policy Not Applied**: Migration 040 might not have been run
2. **Nested Query Blocked**: The `employee_location_assignments` or `office_locations` policies might be blocking
3. **Auth Role Issue**: `auth.role()` might not be returning 'authenticated'
4. **Multiple Policies Conflict**: Multiple permissive policies might be causing issues

## Solution

Run migration `040_fix_employees_rls_access.sql` which:
- ✅ Ensures employees table is accessible to authenticated users
- ✅ Adds permissive policy for employee_location_assignments
- ✅ Ensures office_locations is accessible
- ✅ Grants proper permissions

After running the migration, refresh the employees page and check the console logs.










