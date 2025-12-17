# Admin Dashboard Metrics - SQL Query Reference

Quick reference guide for all executive dashboard metrics with ready-to-use SQL queries and Supabase client code.

## Financial Metrics

### 1. Current Week Payroll (Gross & Net)

```sql
-- SQL
SELECT 
  SUM(gross_pay) as total_gross,
  SUM(net_pay) as total_net,
  SUM(total_deductions) as total_deductions,
  COUNT(DISTINCT employee_id) as employee_count,
  AVG(gross_pay) as avg_gross_per_employee
FROM payslips
WHERE week_start_date = '2025-11-17';
```

```typescript
// Supabase Client
const { data } = await supabase
  .from('payslips')
  .select('gross_pay, net_pay, total_deductions, employee_id')
  .eq('week_start_date', weekStartDate);

const totals = {
  gross: data?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0,
  net: data?.reduce((sum, p) => sum + Number(p.net_pay), 0) || 0,
  deductions: data?.reduce((sum, p) => sum + Number(p.total_deductions), 0) || 0,
  employeeCount: new Set(data?.map(p => p.employee_id)).size || 0,
};
```

### 2. Previous Week Payroll (for comparison)

```sql
-- SQL
SELECT 
  SUM(gross_pay) as total_gross,
  SUM(net_pay) as total_net
FROM payslips
WHERE week_start_date = '2025-11-10';  -- Previous week
```

```typescript
// Supabase Client
const previousWeekStart = subWeeks(currentWeekStart, 1);
const { data } = await supabase
  .from('payslips')
  .select('gross_pay, net_pay')
  .eq('week_start_date', format(previousWeekStart, 'yyyy-MM-dd'));

const previousGross = data?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
const weekOverWeekChange = ((currentGross - previousGross) / previousGross) * 100;
```

### 3. Year-to-Date (YTD) Payroll

```sql
-- SQL
SELECT 
  SUM(gross_pay) as ytd_gross,
  SUM(net_pay) as ytd_net,
  SUM(total_deductions) as ytd_deductions,
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(DISTINCT week_start_date) as total_weeks
FROM payslips
WHERE EXTRACT(YEAR FROM week_start_date) = 2025;
```

```typescript
// Supabase Client
const yearStart = startOfYear(new Date());
const { data } = await supabase
  .from('payslips')
  .select('gross_pay, net_pay, total_deductions')
  .gte('week_start_date', format(yearStart, 'yyyy-MM-dd'));

const ytdGross = data?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
const ytdNet = data?.reduce((sum, p) => sum + Number(p.net_pay), 0) || 0;
```

### 4. Month-to-Date (MTD) Payroll

```sql
-- SQL
SELECT 
  SUM(gross_pay) as mtd_gross,
  SUM(net_pay) as mtd_net,
  COUNT(DISTINCT week_start_date) as weeks_in_month
FROM payslips
WHERE EXTRACT(YEAR FROM week_start_date) = 2025
  AND EXTRACT(MONTH FROM week_start_date) = 11;
```

```typescript
// Supabase Client
const monthStart = startOfMonth(new Date());
const { data } = await supabase
  .from('payslips')
  .select('gross_pay, net_pay, week_start_date')
  .gte('week_start_date', format(monthStart, 'yyyy-MM-dd'));

const mtdGross = data?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
const uniqueWeeks = new Set(data?.map(p => p.week_start_date));
```

### 5. Cost Breakdown by Pay Type

```sql
-- SQL (requires parsing earnings_breakdown JSON)
SELECT 
  week_start_date,
  SUM((earnings_breakdown->>'regular_pay')::NUMERIC) as total_regular,
  SUM((earnings_breakdown->>'overtime_pay')::NUMERIC) as total_overtime,
  SUM((earnings_breakdown->>'night_diff')::NUMERIC) as total_night_diff,
  SUM((earnings_breakdown->>'holiday_pay')::NUMERIC) as total_holiday,
  SUM((earnings_breakdown->>'sunday_pay')::NUMERIC) as total_sunday
FROM payslips
WHERE week_start_date = '2025-11-17'
GROUP BY week_start_date;
```

```typescript
// Supabase Client
const { data } = await supabase
  .from('payslips')
  .select('earnings_breakdown')
  .eq('week_start_date', weekStartDate);

const breakdown = data?.reduce((acc, p) => {
  const earnings = p.earnings_breakdown as any;
  return {
    regular: acc.regular + (earnings?.regular_pay || 0),
    overtime: acc.overtime + (earnings?.overtime_pay || 0),
    nightDiff: acc.nightDiff + (earnings?.night_diff || 0),
    holiday: acc.holiday + (earnings?.holiday_pay || 0),
    sunday: acc.sunday + (earnings?.sunday_pay || 0),
  };
}, { regular: 0, overtime: 0, nightDiff: 0, holiday: 0, sunday: 0 });
```

### 6. Deductions Breakdown

```sql
-- SQL
SELECT 
  SUM(sss_amount) as total_sss,
  SUM(philhealth_amount) as total_philhealth,
  SUM(pagibig_amount) as total_pagibig,
  SUM((deductions_breakdown->>'vale_amount')::NUMERIC) as total_vale,
  SUM((deductions_breakdown->>'uniform_ppe_amount')::NUMERIC) as total_uniform,
  SUM((deductions_breakdown->>'sss_salary_loan')::NUMERIC) as total_sss_loan,
  SUM((deductions_breakdown->>'pagibig_salary_loan')::NUMERIC) as total_pagibig_loan
FROM payslips
WHERE week_start_date = '2025-11-17';
```

```typescript
// Supabase Client
const { data } = await supabase
  .from('payslips')
  .select('sss_amount, philhealth_amount, pagibig_amount, deductions_breakdown')
  .eq('week_start_date', weekStartDate);

const deductions = {
  sss: data?.reduce((sum, p) => sum + Number(p.sss_amount), 0) || 0,
  philhealth: data?.reduce((sum, p) => sum + Number(p.philhealth_amount), 0) || 0,
  pagibig: data?.reduce((sum, p) => sum + Number(p.pagibig_amount), 0) || 0,
  // ... parse deductions_breakdown for other deductions
};
```

## Workforce Metrics

### 7. Total & Active Employees

```sql
-- SQL
SELECT 
  COUNT(*) as total_employees,
  COUNT(*) FILTER (WHERE is_active = true) as active_employees,
  COUNT(*) FILTER (WHERE is_active = false) as inactive_employees
FROM employees;
```

```typescript
// Supabase Client
const { count: totalEmployees } = await supabase
  .from('employees')
  .select('*', { count: 'exact', head: true });

const { count: activeEmployees } = await supabase
  .from('employees')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', true);

const inactiveEmployees = (totalEmployees || 0) - (activeEmployees || 0);
```

### 8. New Hires & Departures (Month-to-Date)

```sql
-- SQL
-- New hires
SELECT COUNT(*) as new_hires
FROM employees
WHERE created_at >= '2025-11-01'
  AND EXTRACT(MONTH FROM created_at) = EXTRACT(MONTH FROM CURRENT_DATE);

-- Departures (employees marked inactive)
SELECT COUNT(*) as departures
FROM employees
WHERE is_active = false
  AND updated_at >= '2025-11-01'
  AND EXTRACT(MONTH FROM updated_at) = EXTRACT(MONTH FROM CURRENT_DATE);
```

```typescript
// Supabase Client
const monthStart = startOfMonth(new Date());

// New hires
const { count: newHires } = await supabase
  .from('employees')
  .select('*', { count: 'exact', head: true })
  .gte('created_at', format(monthStart, 'yyyy-MM-dd'));

// Departures (would need audit log or status change tracking)
const { count: departures } = await supabase
  .from('employees')
  .select('*', { count: 'exact', head: true })
  .eq('is_active', false)
  .gte('updated_at', format(monthStart, 'yyyy-MM-dd'));
```

### 9. Turnover Rate (Annual)

```sql
-- SQL
WITH 
  departures AS (
    SELECT COUNT(*) as departed
    FROM employees
    WHERE is_active = false
      AND updated_at >= CURRENT_DATE - INTERVAL '12 months'
  ),
  avg_headcount AS (
    SELECT 
      AVG(monthly_count) as avg_count
    FROM (
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as monthly_count
      FROM employees
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
    ) monthly_counts
  )
SELECT 
  ROUND((d.departed::NUMERIC / a.avg_count * 100), 2) as turnover_rate_percentage
FROM departures d, avg_headcount a;
```

### 10. Department Distribution

```sql
-- SQL (requires department field)
SELECT 
  department,
  COUNT(*) as employee_count,
  COUNT(*) FILTER (WHERE is_active = true) as active_count,
  ROUND(COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER () * 100, 1) as percentage
FROM employees
GROUP BY department
ORDER BY employee_count DESC;
```

```typescript
// Supabase Client (if department field exists)
const { data: departments } = await supabase
  .from('employees')
  .select('department, is_active')
  .eq('is_active', true);

const distribution = departments?.reduce((acc, emp) => {
  const dept = emp.department || 'General';
  acc[dept] = (acc[dept] || 0) + 1;
  return acc;
}, {} as Record<string, number>);
```

## Operational Metrics

### 11. Payslip Status Summary

```sql
-- SQL
SELECT 
  status,
  COUNT(*) as count,
  SUM(gross_pay) as total_gross,
  SUM(net_pay) as total_net
FROM payslips
WHERE week_start_date = '2025-11-17'
GROUP BY status;
```

```typescript
// Supabase Client
const { count: draftCount } = await supabase
  .from('payslips')
  .select('*', { count: 'exact', head: true })
  .eq('week_start_date', weekStartDate)
  .eq('status', 'draft');

const { count: approvedCount } = await supabase
  .from('payslips')
  .select('*', { count: 'exact', head: true })
  .eq('week_start_date', weekStartDate)
  .eq('status', 'approved');
```

### 12. Pending Approvals

```sql
-- SQL
SELECT 
  COUNT(*) as pending_count,
  SUM(gross_pay) as pending_amount
FROM payslips
WHERE status = 'draft';
```

```typescript
// Supabase Client
const { data: pendingPayslips, count } = await supabase
  .from('payslips')
  .select('gross_pay, net_pay', { count: 'exact' })
  .eq('status', 'draft');

const pendingAmount = pendingPayslips?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
```

### 13. Exception Detection

```sql
-- SQL: Employees with no bank account
SELECT 
  e.employee_id,
  e.full_name,
  'No bank account' as exception_type,
  'critical' as severity
FROM employees e
WHERE e.is_active = true
  AND (e.bank_account_number IS NULL OR e.bank_account_number = '');

-- SQL: Negative net pay
SELECT 
  e.employee_id,
  e.full_name,
  p.net_pay,
  'Negative net pay' as exception_type,
  'critical' as severity
FROM payslips p
JOIN employees e ON p.employee_id = e.id
WHERE p.week_start_date = '2025-11-17'
  AND p.net_pay < 0;

-- SQL: Excessive overtime (>40% of regular hours)
SELECT 
  e.employee_id,
  e.full_name,
  wa.total_regular_hours,
  wa.total_overtime_hours,
  ROUND((wa.total_overtime_hours / NULLIF(wa.total_regular_hours, 0) * 100), 1) as ot_percentage,
  'Excessive overtime' as exception_type,
  'warning' as severity
FROM weekly_attendance wa
JOIN employees e ON wa.employee_id = e.id
WHERE wa.week_start_date = '2025-11-17'
  AND wa.total_overtime_hours > (wa.total_regular_hours * 0.4);

-- SQL: Deductions exceed 40% of gross pay
SELECT 
  e.employee_id,
  e.full_name,
  p.gross_pay,
  p.total_deductions,
  ROUND((p.total_deductions / NULLIF(p.gross_pay, 0) * 100), 1) as deduction_percentage,
  'High deduction ratio' as exception_type,
  'warning' as severity
FROM payslips p
JOIN employees e ON p.employee_id = e.id
WHERE p.week_start_date = '2025-11-17'
  AND p.total_deductions > (p.gross_pay * 0.4);
```

## Trend Analysis

### 14. Weekly Payroll Trend (Last 12 Weeks)

```sql
-- SQL
SELECT 
  week_start_date,
  SUM(gross_pay) as weekly_gross,
  SUM(net_pay) as weekly_net,
  COUNT(DISTINCT employee_id) as employee_count,
  AVG(gross_pay) as avg_per_employee
FROM payslips
WHERE week_start_date >= CURRENT_DATE - INTERVAL '84 days'
GROUP BY week_start_date
ORDER BY week_start_date DESC
LIMIT 12;
```

```typescript
// Supabase Client
const twelveWeeksAgo = subWeeks(new Date(), 12);
const { data } = await supabase
  .from('payslips')
  .select('week_start_date, gross_pay, net_pay, employee_id')
  .gte('week_start_date', format(twelveWeeksAgo, 'yyyy-MM-dd'))
  .order('week_start_date', { ascending: false });

// Group by week
const weekGroups = data?.reduce((acc, record) => {
  const week = record.week_start_date;
  if (!acc[week]) {
    acc[week] = { gross: 0, net: 0, employees: new Set() };
  }
  acc[week].gross += Number(record.gross_pay);
  acc[week].net += Number(record.net_pay);
  acc[week].employees.add(record.employee_id);
  return acc;
}, {} as Record<string, any>);
```

### 15. Headcount Trend (Last 6 Months)

```sql
-- SQL
SELECT 
  DATE_TRUNC('month', created_at) as month,
  COUNT(*) as employees_added,
  (SELECT COUNT(*) FROM employees WHERE created_at <= DATE_TRUNC('month', e.created_at)) as cumulative_count
FROM employees e
WHERE created_at >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;
```

### 16. Overtime Trend (Monthly Average)

```sql
-- SQL
SELECT 
  DATE_TRUNC('month', week_start_date) as month,
  AVG(total_overtime_hours) as avg_ot_hours_per_employee,
  SUM(total_overtime_hours) as total_ot_hours,
  COUNT(DISTINCT employee_id) as employee_count
FROM weekly_attendance
WHERE week_start_date >= CURRENT_DATE - INTERVAL '6 months'
GROUP BY DATE_TRUNC('month', week_start_date)
ORDER BY month DESC;
```

## Department Analysis

### 17. Department Cost Breakdown (Current Week)

```sql
-- SQL (requires department field)
SELECT 
  e.department,
  COUNT(DISTINCT p.employee_id) as employee_count,
  SUM(p.gross_pay) as total_cost,
  AVG(p.gross_pay) as avg_cost_per_employee,
  ROUND((SUM(p.gross_pay) / SUM(SUM(p.gross_pay)) OVER () * 100), 1) as percentage_of_total
FROM payslips p
JOIN employees e ON p.employee_id = e.id
WHERE p.week_start_date = '2025-11-17'
GROUP BY e.department
ORDER BY total_cost DESC;
```

### 18. Department Comparison (vs Previous Period)

```sql
-- SQL
WITH 
  current_week AS (
    SELECT 
      e.department,
      SUM(p.gross_pay) as current_cost
    FROM payslips p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.week_start_date = '2025-11-17'
    GROUP BY e.department
  ),
  previous_week AS (
    SELECT 
      e.department,
      SUM(p.gross_pay) as previous_cost
    FROM payslips p
    JOIN employees e ON p.employee_id = e.id
    WHERE p.week_start_date = '2025-11-10'
    GROUP BY e.department
  )
SELECT 
  c.department,
  c.current_cost,
  p.previous_cost,
  ROUND(((c.current_cost - p.previous_cost) / NULLIF(p.previous_cost, 0) * 100), 1) as change_percentage
FROM current_week c
LEFT JOIN previous_week p ON c.department = p.department
ORDER BY c.current_cost DESC;
```

## Audit & Activity

### 19. Recent Activity Log

```sql
-- SQL
SELECT 
  al.created_at,
  u.full_name as user_name,
  u.role,
  al.action,
  al.table_name,
  al.record_id
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
ORDER BY al.created_at DESC
LIMIT 20;
```

```typescript
// Supabase Client
const { data: recentActivity } = await supabase
  .from('audit_logs')
  .select(`
    created_at,
    action,
    table_name,
    record_id,
    users (
      full_name,
      role
    )
  `)
  .order('created_at', { ascending: false })
  .limit(20);
```

### 20. User Activity Summary (Last 24 Hours)

```sql
-- SQL
SELECT 
  u.full_name,
  u.role,
  COUNT(*) as action_count,
  array_agg(DISTINCT al.action) as actions_performed
FROM audit_logs al
JOIN users u ON al.user_id = u.id
WHERE al.created_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
GROUP BY u.id, u.full_name, u.role
ORDER BY action_count DESC;
```

## Cash Flow & Forecasting

### 21. Net Payout (This Week)

```sql
-- SQL
SELECT 
  SUM(net_pay) as total_net_payout,
  COUNT(*) as employee_count,
  AVG(net_pay) as avg_payout_per_employee
FROM payslips
WHERE week_start_date = '2025-11-17'
  AND status IN ('approved', 'paid');
```

### 22. Cash Flow Forecast (Next 4 Weeks)

```sql
-- SQL (based on historical average)
WITH recent_average AS (
  SELECT 
    AVG(weekly_net) as avg_weekly_net
  FROM (
    SELECT 
      week_start_date,
      SUM(net_pay) as weekly_net
    FROM payslips
    WHERE week_start_date >= CURRENT_DATE - INTERVAL '8 weeks'
    GROUP BY week_start_date
  ) recent_weeks
)
SELECT 
  'Next 4 weeks forecast' as period,
  avg_weekly_net * 4 as forecasted_amount
FROM recent_average;
```

### 23. Government Remittance Due

```sql
-- SQL
SELECT 
  'SSS' as remittance_type,
  SUM(sss_amount) as total_amount,
  COUNT(DISTINCT employee_id) as employee_count
FROM payslips
WHERE EXTRACT(MONTH FROM week_start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND apply_sss = true

UNION ALL

SELECT 
  'PhilHealth' as remittance_type,
  SUM(philhealth_amount) as total_amount,
  COUNT(DISTINCT employee_id) as employee_count
FROM payslips
WHERE EXTRACT(MONTH FROM week_start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND apply_philhealth = true

UNION ALL

SELECT 
  'Pag-IBIG' as remittance_type,
  SUM(pagibig_amount) as total_amount,
  COUNT(DISTINCT employee_id) as employee_count
FROM payslips
WHERE EXTRACT(MONTH FROM week_start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
  AND apply_pagibig = true;
```

## Performance Optimization Tips

### Use Materialized Views for Heavy Queries

```sql
-- Create materialized view for YTD calculations
CREATE MATERIALIZED VIEW ytd_payroll_summary AS
SELECT 
  EXTRACT(YEAR FROM week_start_date) as year,
  SUM(gross_pay) as ytd_gross,
  SUM(net_pay) as ytd_net,
  SUM(total_deductions) as ytd_deductions,
  COUNT(DISTINCT employee_id) as unique_employees,
  COUNT(DISTINCT week_start_date) as total_weeks
FROM payslips
GROUP BY EXTRACT(YEAR FROM week_start_date);

-- Refresh daily via cron job
REFRESH MATERIALIZED VIEW ytd_payroll_summary;
```

### Index Recommendations

```sql
-- Add these indexes for better query performance
CREATE INDEX idx_payslips_week_start ON payslips(week_start_date);
CREATE INDEX idx_payslips_status ON payslips(status);
CREATE INDEX idx_payslips_employee ON payslips(employee_id);
CREATE INDEX idx_employees_active ON employees(is_active);
CREATE INDEX idx_employees_department ON employees(department) WHERE department IS NOT NULL;
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

### Use Database Functions for Complex Calculations

```sql
-- Example: Get all dashboard metrics in one call
CREATE OR REPLACE FUNCTION get_admin_dashboard_metrics(
  target_week_start DATE DEFAULT CURRENT_DATE
)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'current_week', (
      SELECT json_build_object(
        'gross', SUM(gross_pay),
        'net', SUM(net_pay),
        'employee_count', COUNT(DISTINCT employee_id)
      )
      FROM payslips
      WHERE week_start_date = target_week_start
    ),
    'workforce', (
      SELECT json_build_object(
        'total', COUNT(*),
        'active', COUNT(*) FILTER (WHERE is_active = true)
      )
      FROM employees
    ),
    'pending_approvals', (
      SELECT COUNT(*)
      FROM payslips
      WHERE status = 'draft'
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Usage
SELECT * FROM get_admin_dashboard_metrics('2025-11-17');
```

---

**Last Updated**: November 19, 2025  
**Version**: 1.0  
**Purpose**: Quick reference for implementing admin dashboard metrics

