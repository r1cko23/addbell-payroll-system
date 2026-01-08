# Supabase Security & Performance Audit Report

**Date:** January 2025
**Total Issues Found:** 108+ (Security: 22, Performance: 86+)

---

## 🔴 CRITICAL SECURITY ISSUES (ERROR Level)

### 1. **RLS Disabled on `overtime_groups` Table** ⚠️ CRITICAL
- **Issue:** Table has RLS policies but RLS is not enabled
- **Impact:** Policies exist but are not enforced, allowing unauthorized access
- **Table:** `public.overtime_groups`
- **Policies Affected:**
  - "Admins can manage overtime groups"
  - "All authenticated users can view overtime groups"
- **Fix Required:** Enable RLS on the table
- **Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled

**SQL Fix:**
```sql
ALTER TABLE public.overtime_groups ENABLE ROW LEVEL SECURITY;
```

---

## ⚠️ SECURITY WARNINGS

### 2. **RLS Enabled But No Policies** (INFO)
- **Table:** `public.password_reset_requests`
- **Issue:** RLS is enabled but no policies exist
- **Impact:** Table is completely inaccessible
- **Fix:** Either disable RLS or add appropriate policies

### 3. **Function Search Path Mutable** (WARN - 15 functions)
Multiple functions have mutable search_path, which is a security risk:

**Affected Functions:**
1. `public.is_date_in_selected_dates`
2. `public.get_leave_request_dates`
3. `public.log_employee_changes`
4. `public.log_employee_deductions_changes`
5. `public.get_server_time`
6. `public.log_employee_loan_changes`
7. `public.log_employee_location_assignments_changes`
8. `public.log_employee_week_schedules_changes`
9. `public.now_ph`
10. `public.today_ph`
11. `public.calculate_time_clock_hours`
12. `public.calculate_distance`
13. `public.is_location_allowed`
14. *(and potentially more)*

**Fix Required:** Set `search_path` parameter in function definitions:
```sql
CREATE OR REPLACE FUNCTION function_name(...)
RETURNS ...
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
-- function body
$$;
```

**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable

### 4. **Overly Permissive RLS Policies** (WARN)
Several tables have INSERT policies with `WITH CHECK (true)`, which bypasses security:

**Affected Tables:**
1. `public.employee_first_login` - Policy: "System can insert employee first login"
2. `public.employee_week_schedules` - Policy: "Employees can insert schedules"
3. `public.failure_to_log` - Policies:
   - "Employees can create failure to log requests"
   - "failure_to_log_insert_all"
4. `public.leave_request_documents` - Policy: "Employees can insert SIL docs"
5. `public.overtime_documents` - Policy: "Users can insert own OT docs"

**Recommendation:** Review these policies and add proper validation checks instead of `WITH CHECK (true)`.

**Remediation:** https://supabase.com/docs/guides/database/database-linter?lint=0024_permissive_rls_policy

### 5. **Leaked Password Protection Disabled** (WARN)
- **Issue:** Supabase Auth is not checking passwords against HaveIBeenPwned.org
- **Impact:** Users can set compromised passwords
- **Fix:** Enable leaked password protection in Supabase Auth settings
- **Remediation:** https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

---

## 📊 PERFORMANCE ISSUES (86+ Warnings)

Performance issues detected. Common patterns include:
- Missing indexes on frequently queried columns
- Unoptimized queries
- Missing foreign key indexes
- Large table scans

**Note:** Detailed performance issues are in the advisors output. Review and prioritize based on:
1. Query frequency
2. Table size
3. Impact on user experience

---

## 🎯 PRIORITY FIXES

### Immediate (Critical Security):
1. ✅ **Enable RLS on `overtime_groups` table** - CRITICAL
2. ⚠️ **Fix mutable search_path in functions** - High priority (15+ functions)
3. ⚠️ **Review permissive RLS policies** - Medium priority

### Short-term (Security Hardening):
4. ⚠️ **Enable leaked password protection** - Easy fix, high value
5. ⚠️ **Add RLS policies to `password_reset_requests`** or disable RLS

### Medium-term (Performance):
6. 📊 **Review and optimize performance issues** (86+ warnings)
7. 📊 **Add missing indexes** based on query patterns

---

## 🔧 RECOMMENDED ACTIONS

### 1. Fix Critical RLS Issue (Immediate)
```sql
-- Enable RLS on overtime_groups table
ALTER TABLE public.overtime_groups ENABLE ROW LEVEL SECURITY;

-- Verify policies are working
SELECT * FROM pg_policies WHERE tablename = 'overtime_groups';
```

### 2. Fix Function Search Path (High Priority)
For each affected function, update to include `SET search_path = public`:
```sql
-- Example fix for one function
CREATE OR REPLACE FUNCTION public.log_employee_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- function body
END;
$$;
```

### 3. Review Permissive Policies
Consider adding validation to INSERT policies:
```sql
-- Example: Instead of WITH CHECK (true)
-- Use: WITH CHECK (auth.uid() = employee_id)
-- Or: WITH CHECK (auth.jwt() ->> 'role' = 'admin')
```

### 4. Enable Password Protection
- Go to Supabase Dashboard → Authentication → Settings
- Enable "Leaked Password Protection"

---

## 📝 NOTES

- **Total Security Issues:** 22 (1 ERROR, 21 WARN/INFO)
- **Total Performance Issues:** 86+ (all WARN level)
- **Most Critical:** RLS disabled on `overtime_groups` table
- **Easiest Fix:** Enable leaked password protection (dashboard setting)

---

*This audit was generated using Supabase Advisors. For detailed remediation steps, follow the links provided for each issue.*