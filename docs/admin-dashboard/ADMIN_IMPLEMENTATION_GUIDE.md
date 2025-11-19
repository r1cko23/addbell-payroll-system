# Admin Dashboard Implementation Guide

## Overview

This guide explains how to implement role-based dashboards in your payroll system, providing different views for Admin (CEO/COO) vs HR users.

## Files Created

1. **`ADMIN_DASHBOARD_SPEC.md`** - Complete specification of metrics and features for admin dashboard
2. **`app/dashboard/admin-page.tsx.example`** - Example implementation of admin dashboard
3. **`lib/hooks/useUserRole.ts`** - React hook for checking user roles

## Implementation Steps

### Step 1: Set Up Role-Based Routing

Update your main dashboard page to check user role and render appropriate view:

**File: `app/dashboard/page.tsx`**

```typescript
'use client';

import { useUserRole } from '@/lib/hooks/useUserRole';
import AdminDashboard from './admin-dashboard';
import HRDashboard from './hr-dashboard';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';

export default function DashboardPage() {
  const { role, loading, isAdmin } = useUserRole();

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  // Render admin dashboard for admin users
  if (isAdmin) {
    return <AdminDashboard />;
  }

  // Render HR dashboard for HR users (existing dashboard)
  return <HRDashboard />;
}
```

### Step 2: Create Separate Dashboard Components

**Option A: Rename existing dashboard** (Recommended)

```bash
# Rename current dashboard to hr-dashboard.tsx
mv app/dashboard/page.tsx app/dashboard/hr-dashboard.tsx

# Rename example admin dashboard to admin-dashboard.tsx
mv app/dashboard/admin-page.tsx.example app/dashboard/admin-dashboard.tsx

# Create new page.tsx with role-based routing (as shown in Step 1)
```

**Option B: Keep existing structure**

Keep `page.tsx` as is, and add conditional rendering at the top:

```typescript
// At the top of app/dashboard/page.tsx
const { isAdmin } = useUserRole();

if (isAdmin) {
  return <AdminDashboardView />;
}

// ... rest of existing code for HR view
```

### Step 3: Add Required Database Functions (Optional)

For better performance, add these database functions for metric calculations:

**File: `supabase/migrations/005_admin_dashboard_functions.sql`**

```sql
-- Function to calculate YTD payroll totals
CREATE OR REPLACE FUNCTION get_ytd_payroll_totals(year_param INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER)
RETURNS TABLE (
  total_gross NUMERIC,
  total_net NUMERIC,
  total_deductions NUMERIC,
  total_employees BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    SUM(gross_pay)::NUMERIC as total_gross,
    SUM(net_pay)::NUMERIC as total_net,
    SUM(total_deductions)::NUMERIC as total_deductions,
    COUNT(DISTINCT employee_id) as total_employees
  FROM payslips
  WHERE EXTRACT(YEAR FROM week_start_date::DATE) = year_param;
END;
$$ LANGUAGE plpgsql;

-- Function to get weekly payroll trends
CREATE OR REPLACE FUNCTION get_payroll_trends(weeks_back INTEGER DEFAULT 12)
RETURNS TABLE (
  week_start_date DATE,
  total_gross NUMERIC,
  total_net NUMERIC,
  employee_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.week_start_date::DATE,
    SUM(p.gross_pay)::NUMERIC as total_gross,
    SUM(p.net_pay)::NUMERIC as total_net,
    COUNT(DISTINCT p.employee_id) as employee_count
  FROM payslips p
  WHERE p.week_start_date >= CURRENT_DATE - (weeks_back * 7 || ' days')::INTERVAL
  GROUP BY p.week_start_date
  ORDER BY p.week_start_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate department costs
CREATE OR REPLACE FUNCTION get_department_costs(week_start DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  department TEXT,
  employee_count BIGINT,
  total_cost NUMERIC,
  avg_cost NUMERIC,
  percentage NUMERIC
) AS $$
DECLARE
  total_payroll NUMERIC;
BEGIN
  -- Get total payroll for percentage calculation
  SELECT SUM(gross_pay) INTO total_payroll
  FROM payslips
  WHERE week_start_date = week_start;

  RETURN QUERY
  SELECT 
    e.department,
    COUNT(DISTINCT p.employee_id) as employee_count,
    SUM(p.gross_pay)::NUMERIC as total_cost,
    AVG(p.gross_pay)::NUMERIC as avg_cost,
    CASE 
      WHEN total_payroll > 0 THEN (SUM(p.gross_pay) / total_payroll * 100)::NUMERIC
      ELSE 0::NUMERIC
    END as percentage
  FROM payslips p
  JOIN employees e ON p.employee_id = e.id
  WHERE p.week_start_date = week_start
  GROUP BY e.department
  ORDER BY total_cost DESC;
END;
$$ LANGUAGE plpgsql;
```

### Step 4: Add Department Field to Employees Table

If not already present, add a department field:

**File: `supabase/migrations/006_add_department_field.sql`**

```sql
-- Add department field to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'General';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);

-- Update existing employees with default department
UPDATE employees 
SET department = 'General' 
WHERE department IS NULL;
```

### Step 5: Update Type Definitions

Update `types/database.ts` to include the department field:

```typescript
employees: {
  Row: {
    id: string
    employee_id: string
    full_name: string
    department: string  // Add this
    rate_per_day: number
    rate_per_hour: number
    is_active: boolean
    created_at: string
    updated_at: string
    created_by: string | null
  }
  // ... Insert and Update types
}
```

## Key Features to Implement

### 1. Financial Metrics (Priority: High)

- [x] Current week gross/net payroll
- [x] Week-over-week comparison
- [x] Year-to-date totals
- [x] Average cost per employee
- [x] Cost breakdown by pay type
- [ ] Budget vs. actual comparison (requires budget table)

### 2. Workforce Analytics (Priority: High)

- [x] Total/active employee count
- [x] Headcount changes
- [ ] Department distribution
- [ ] Turnover rate calculation
- [ ] New hires vs. departures tracking

### 3. Operational Metrics (Priority: Medium)

- [x] Pending approvals count
- [ ] Exception alerts
- [ ] Compliance status
- [ ] Processing timeline
- [ ] Audit log integration

### 4. Trend Analysis (Priority: Medium)

- [x] 12-week payroll trend visualization
- [ ] Headcount trend over time
- [ ] Overtime trend analysis
- [ ] Seasonal pattern identification

### 5. Advanced Features (Priority: Low)

- [ ] Cash flow forecasting
- [ ] Custom date range selection
- [ ] Export to PDF/Excel
- [ ] Email notifications
- [ ] Drill-down capability

## Dashboard Metrics Comparison

| Metric | Admin View | HR View | Notes |
|--------|-----------|---------|-------|
| Current Week Payroll | ✅ Full | ✅ Full | Both need this |
| YTD Totals | ✅ Yes | ❌ No | Admin only |
| Budget Analysis | ✅ Yes | ❌ No | Admin only |
| Department Costs | ✅ Yes | ⚠️ Limited | Admin sees all departments |
| Historical Trends | ✅ 2+ years | ⚠️ 3 months | Admin gets more history |
| Cash Flow Forecast | ✅ Yes | ❌ No | Financial planning - admin only |
| Bank Transfer | ✅ Yes | ✅ Yes | Both need for operations |
| Pending Approvals | ✅ Yes | ✅ Yes | Both need for workflow |
| Audit Logs | ✅ Full | ⚠️ Own only | Admin sees all activity |

## Testing Checklist

- [ ] Admin users see executive dashboard
- [ ] HR users see operational dashboard
- [ ] All metrics load correctly
- [ ] Week-over-week comparisons are accurate
- [ ] YTD calculations are correct
- [ ] Trend charts display properly
- [ ] Responsive design works on mobile
- [ ] Performance is acceptable (<2s load time)
- [ ] Error handling works properly
- [ ] Role switching works correctly

## Performance Optimization

### 1. Database Indexes

```sql
-- Optimize payslip queries
CREATE INDEX IF NOT EXISTS idx_payslips_week_start ON payslips(week_start_date);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);

-- Optimize employee queries
CREATE INDEX IF NOT EXISTS idx_employees_active ON employees(is_active);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
```

### 2. Caching Strategy

Consider implementing caching for expensive calculations:

```typescript
// Example: Cache YTD calculations for 1 hour
const cacheKey = `ytd_payroll_${year}`;
const cachedData = await redis.get(cacheKey);

if (cachedData) {
  return JSON.parse(cachedData);
}

const freshData = await calculateYTD();
await redis.setex(cacheKey, 3600, JSON.stringify(freshData));
return freshData;
```

### 3. Query Optimization

- Use `select()` with specific columns instead of `select('*')`
- Batch related queries when possible
- Use `rpc()` for complex calculations
- Implement pagination for large datasets

## Security Considerations

### 1. Row Level Security (RLS)

Ensure RLS policies are in place:

```sql
-- Only admins can view YTD financial data
CREATE POLICY "Only admins can view financial summaries" ON financial_summaries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 2. API Route Protection

If using API routes, add role checks:

```typescript
// app/api/admin/metrics/route.ts
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: userData } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (userData?.role !== 'admin') {
    return new Response('Forbidden', { status: 403 });
  }

  // Return admin metrics...
}
```

## Troubleshooting

### Issue: User role not loading

**Solution**: Check that the user exists in the `users` table:

```sql
SELECT id, email, role FROM users WHERE id = 'user-uuid-here';
```

### Issue: Metrics showing zero

**Solution**: Verify data exists for the time period:

```sql
SELECT COUNT(*), MIN(week_start_date), MAX(week_start_date) 
FROM payslips;
```

### Issue: Performance is slow

**Solution**: 
1. Check database indexes are created
2. Use browser DevTools to identify slow queries
3. Implement caching for expensive calculations
4. Consider using database functions for complex aggregations

## Next Steps

1. **Implement Phase 1** (Essential Metrics)
   - Get role-based routing working
   - Add YTD calculations
   - Show week-over-week comparisons

2. **Implement Phase 2** (Analytics)
   - Add trend visualizations
   - Department breakdown
   - Historical comparisons

3. **Implement Phase 3** (Advanced)
   - Export functionality
   - Email notifications
   - Custom date ranges
   - Drill-down capabilities

4. **Polish & Optimize**
   - Add loading states
   - Error boundaries
   - Performance monitoring
   - User feedback collection

## Resources

- **Specification**: `ADMIN_DASHBOARD_SPEC.md` - Full feature specification
- **Example Code**: `app/dashboard/admin-page.tsx.example` - Working example
- **Database Schema**: `supabase/migrations/001_initial_schema.sql` - Current schema
- **Type Definitions**: `types/database.ts` - TypeScript types

## Support

For questions or issues:
1. Review the `ADMIN_DASHBOARD_SPEC.md` for detailed requirements
2. Check the example implementation in `admin-page.tsx.example`
3. Refer to the Supabase documentation for query optimization
4. Review the project's `IMPROVEMENT_RECOMMENDATIONS.md` for related enhancements

---

**Last Updated**: November 19, 2025  
**Version**: 1.0  
**Status**: Ready for Implementation

