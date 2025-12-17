# Admin/Executive Dashboard Specification
**For CEO, COO, and Admin Roles**

## 🎯 Executive Summary

This document outlines the metrics, KPIs, and features that should be available to executives (CEO/COO) and admin users. The executive dashboard provides a high-level overview of payroll operations, financial health, workforce analytics, and compliance status.

---

## 📊 Key Metrics & KPIs

### 1. **Financial Overview** 💰

#### A. Payroll Costs
```
┌─────────────────────────────────────┐
│  PAYROLL COST SUMMARY              │
├─────────────────────────────────────┤
│  Current Week:        ₱ 245,000.00 │
│  Previous Week:       ₱ 238,500.00 │
│  Change:              ↑ 2.73%      │
│                                     │
│  Month-to-Date:       ₱ 982,000.00 │
│  Year-to-Date:      ₱ 11,784,000   │
│  Monthly Budget:    ₱ 1,000,000    │
│  Budget Used:            98.2%     │
└─────────────────────────────────────┘
```

**Metrics to Track:**
- Total Gross Payroll (current period)
- Total Net Payroll (after deductions)
- Week-over-week comparison
- Month-over-month comparison
- Year-over-year comparison
- Budget vs. Actual
- Payroll as % of Revenue (if revenue data available)

#### B. Cost Breakdown
```
PAYROLL COMPOSITION
├── Regular Hours:        62% (₱151,900)
├── Overtime:             18% (₱44,100)
├── Night Differential:    8% (₱19,600)
├── Holiday Pay:           7% (₱17,150)
└── Sunday/Rest Day:       5% (₱12,250)
```

**Metrics to Track:**
- Regular pay vs. premium pay ratio
- Overtime costs and trends
- Holiday pay impact
- Night shift differential costs
- Average cost per employee

#### C. Deductions Summary
```
TOTAL DEDUCTIONS BREAKDOWN
├── Government Contributions:  ₱45,200 (46%)
│   ├── SSS:                  ₱20,100
│   ├── PhilHealth:           ₱12,400
│   └── Pag-IBIG:             ₱12,700
├── Loans:                     ₱32,800 (34%)
│   ├── SSS Loans:            ₱15,600
│   └── Pag-IBIG Loans:       ₱17,200
├── Vale/Cash Advance:         ₱12,300 (13%)
├── Withholding Tax:            ₱6,500 (7%)
└── Uniform/PPE:                  ₱800 (1%)
```

**Metrics to Track:**
- Total deductions per category
- Government remittance obligations
- Outstanding loans total
- Average deduction per employee
- Cash advance trends

---

### 2. **Workforce Analytics** 👥

#### A. Headcount Metrics
```
┌─────────────────────────────────────┐
│  WORKFORCE OVERVIEW                │
├─────────────────────────────────────┤
│  Total Employees:              156  │
│  Active Employees:             142  │
│  Inactive/On Leave:             14  │
│                                     │
│  New Hires (MTD):                8  │
│  Departures (MTD):               3  │
│  Net Change:                   +5   │
│                                     │
│  Turnover Rate (Annual):      18.2% │
└─────────────────────────────────────┘
```

**Metrics to Track:**
- Total headcount
- Active vs. inactive employees
- New hires per period
- Departures/terminations per period
- Net headcount change
- Monthly/Annual turnover rate
- Retention rate

#### B. Workforce Distribution
```
EMPLOYEES BY CATEGORY
├── Production:           65% (92 employees)
├── Logistics:            20% (28 employees)
├── Administration:       10% (14 employees)
└── Management:            5% (8 employees)
```

#### C. Labor Productivity
```
PRODUCTIVITY METRICS
├── Average Hours/Employee/Week:      48.5 hrs
├── Average Regular Hours:            43.2 hrs
├── Average OT Hours:                  5.3 hrs
│
├── Total Labor Hours (Week):       6,887 hrs
├── Total Output Value:         ₱2,450,000
└── Revenue per Labor Hour:         ₱355.66
```

**Metrics to Track:**
- Average hours per employee
- Overtime hours per employee
- Total productive hours
- Labor efficiency ratios
- Cost per productive hour

---

### 3. **Operational Metrics** ⚙️

#### A. Payroll Processing Status
```
┌─────────────────────────────────────┐
│  PAYROLL STATUS - Week 47 2025     │
├─────────────────────────────────────┤
│  ✅ Timesheets Completed:   142/142│
│  📝 Draft Payslips:          142   │
│  ✓ Approved Payslips:          0   │
│  💰 Paid Payslips:             0   │
│                                     │
│  ⚠️  Pending Approvals:       142   │
│  🔴 Exceptions:                 3   │
└─────────────────────────────────────┘
```

**Metrics to Track:**
- Timesheet completion rate
- Payslip generation status
- Pending approvals count
- Processing timeline
- Exception/error count

#### B. Compliance Alerts
```
COMPLIANCE DASHBOARD
├── ✅ Weekly Payroll:           On Time
├── ⚠️  Government Remittance:   Due in 5 days
├── ✅ Tax Filings:              Up to Date
├── ⚠️  BIR 2316 (Annual):       Due in 45 days
└── ✅ Audit Logs:               Active
```

**Metrics to Track:**
- Payroll processing timeliness
- Compliance due dates
- Outstanding obligations
- Audit trail completeness
- Regulatory deadlines

---

### 4. **Trend Analysis** 📈

#### A. Historical Cost Trends
```
PAYROLL COST TREND (Last 12 Weeks)
Week 36: ████████████████░░░░ ₱232K
Week 37: █████████████████░░░ ₱238K
Week 38: ████████████████░░░░ ₱235K
Week 39: ██████████████████░░ ₱245K
Week 40: ████████████████░░░░ ₱233K
Week 41: █████████████████░░░ ₱241K
Week 42: ██████████████████░░ ₱248K
Week 43: ████████████████░░░░ ₱234K
Week 44: ████████████████░░░░ ₱236K
Week 45: █████████████████░░░ ₱242K
Week 46: ██████████████████░░ ₱246K
Week 47: ██████████████████░░ ₱245K
```

#### B. Headcount Trends
```
HEADCOUNT TREND (Last 6 Months)
Jun 2025: 138 employees
Jul 2025: 142 employees (+4)
Aug 2025: 145 employees (+3)
Sep 2025: 148 employees (+3)
Oct 2025: 151 employees (+3)
Nov 2025: 142 employees (-9) ⚠️
```

#### C. Overtime Trends
```
OVERTIME HOURS (Monthly Average)
├── Jan-Mar 2025:    4.2 hrs/employee/week
├── Apr-Jun 2025:    5.8 hrs/employee/week ↑
├── Jul-Sep 2025:    6.4 hrs/employee/week ↑
└── Oct-Nov 2025:    5.3 hrs/employee/week ↓
```

**Metrics to Track:**
- Weekly/monthly payroll trends
- Seasonal variations
- Peak periods identification
- Cost anomalies
- Staffing level changes over time

---

### 5. **Department/Cost Center Analysis** 🏢

```
PAYROLL BY DEPARTMENT
┌────────────────────────────────────────────────────┐
│ Department      │ Headcount │ Total Cost │ Avg Cost│
├─────────────────┼───────────┼────────────┼─────────┤
│ Production      │    92     │ ₱156,800   │ ₱1,704  │
│ Logistics       │    28     │  ₱52,360   │ ₱1,870  │
│ Administration  │    14     │  ₱24,780   │ ₱1,770  │
│ Management      │     8     │  ₱26,400   │ ₱3,300  │
└─────────────────┴───────────┴────────────┴─────────┘
```

**Metrics to Track:**
- Cost per department
- Average salary by department
- Department headcount
- Cost per employee by department
- Department cost as % of total

---

### 6. **Exceptions & Risk Management** ⚠️

```
ALERTS & EXCEPTIONS
├── 🔴 Critical (3)
│   ├── Employee has no bank account set
│   ├── Negative net pay detected
│   └── Missing timesheet for active employee
│
├── ⚠️  Warning (7)
│   ├── Overtime exceeds 40% of regular hours
│   ├── Government contribution not applied (Week 3)
│   └── Deduction exceeds 40% of gross pay
│
└── ℹ️  Info (12)
    ├── New employee onboarded
    └── Rate change pending approval
```

**Metrics to Track:**
- Critical errors requiring immediate action
- Warning conditions
- Policy violations
- Unusual patterns (e.g., excessive OT)
- Missing or incomplete data

---

### 7. **Audit & Activity Tracking** 🔍

```
RECENT ACTIVITY (Last 24 Hours)
├── 09:15 AM - John Smith (HR) - Generated 142 payslips
├── 10:30 AM - Jane Doe (Admin) - Approved payslip batch #47
├── 11:45 AM - Mark Lee (HR) - Updated employee deductions
├── 02:20 PM - Sarah Chen (Admin) - Exported bank transfer file
└── 03:40 PM - John Smith (HR) - Modified timesheet for EMP-034
```

**Metrics to Track:**
- User activity logs
- Recent changes to payroll data
- Approval history
- Export/print history
- Security events

---

### 8. **Cash Flow & Forecasting** 💵

```
CASH FLOW PROJECTION
├── This Week Net Payout:      ₱197,200
├── Next Week (Projected):     ₱205,000
├── Week After (Projected):    ₱203,500
│
└── Monthly Cash Required:     ₱820,700
    (4 weeks average)
```

**Metrics to Track:**
- Net payroll payout amount
- Projected future payouts
- Monthly cash requirements
- Payment schedule
- Government remittance schedule

---

## 🎨 Dashboard Layout Recommendation

### **Admin/Executive Dashboard View**

```
┌─────────────────────────────────────────────────────────────────┐
│  EXECUTIVE DASHBOARD                    Week 47, 2025  👤 Admin │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Payroll  │ │ Active   │ │ Avg Cost │ │  YTD     │          │
│  │ This Week│ │ Employee │ │ Per Emp  │ │ Payroll  │          │
│  │ ₱245,000 │ │   142    │ │ ₱1,725   │ │ ₱11.78M  │          │
│  │  ↑ 2.7%  │ │  (-3)    │ │  ↑ 1.2%  │ │  +8.5%   │          │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  📊 PAYROLL COST TREND (Last 12 Weeks)             │       │
│  │  [Line chart showing weekly payroll costs]          │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌───────────────────────┐  ┌──────────────────────────┐      │
│  │  💰 COST BREAKDOWN    │  │  ⚠️  ALERTS & ACTIONS    │      │
│  │  - Regular:     62%   │  │  🔴 Critical:        3   │      │
│  │  - Overtime:    18%   │  │  ⚠️  Warning:        7   │      │
│  │  - Night Diff:   8%   │  │  📋 Pending Approvals: 142│     │
│  │  - Holiday:      7%   │  │  📝 Action Required:   3 │      │
│  │  - Rest Day:     5%   │  │  [View Details →]        │      │
│  └───────────────────────┘  └──────────────────────────┘      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  🏢 DEPARTMENT ANALYSIS                             │       │
│  │  [Table showing cost and headcount by department]   │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
│  ┌────────────────────┐  ┌─────────────────────────────┐      │
│  │  👥 WORKFORCE      │  │  💵 CASH FLOW FORECAST      │      │
│  │  Total:      156   │  │  This Week:    ₱197,200     │      │
│  │  Active:     142   │  │  Next Week:    ₱205,000     │      │
│  │  New (MTD):    8   │  │  Month Req:    ₱820,700     │      │
│  │  Turnover:  18.2%  │  │  [View Schedule →]          │      │
│  └────────────────────┘  └─────────────────────────────┘      │
│                                                                  │
│  ┌─────────────────────────────────────────────────────┐       │
│  │  🔍 RECENT ACTIVITY                                 │       │
│  │  09:15 - John generated 142 payslips                │       │
│  │  10:30 - Jane approved payslip batch #47            │       │
│  │  11:45 - Mark updated employee deductions           │       │
│  │  [View Audit Log →]                                 │       │
│  └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Role-Based Access Control

### Current System Roles
- **Admin**: Full access (CEO/COO level)
- **HR**: Operational access (HR Manager/Payroll Officer)

### Recommended Dashboard Differentiation

| Feature | Admin Dashboard | HR Dashboard |
|---------|----------------|--------------|
| Financial Summary | ✅ Full access | ⚠️ Limited (current week only) |
| YTD/Budget Analysis | ✅ Yes | ❌ No |
| Department Costs | ✅ Yes | ⚠️ Limited |
| Headcount Trends | ✅ Yes | ✅ Yes |
| Turnover Analysis | ✅ Yes | ✅ Yes |
| Audit Logs | ✅ Full access | ⚠️ Own actions only |
| Compliance Alerts | ✅ Yes | ✅ Yes |
| Cash Flow Forecast | ✅ Yes | ❌ No |
| Bank Transfer Summary | ✅ Yes | ✅ Yes |
| Exception Alerts | ✅ Yes | ✅ Yes |
| Historical Analytics | ✅ 2+ years | ⚠️ 3 months |

---

## 📱 Additional Executive Features

### 1. **Export & Reporting**
- Executive summary PDF export
- Monthly payroll report
- Year-end cost analysis
- Custom date range reports
- Department comparison reports

### 2. **Notifications & Alerts**
- Email digest (daily/weekly)
- Critical alerts (SMS/Email)
- Budget threshold warnings
- Compliance deadline reminders
- Anomaly detection alerts

### 3. **Drill-Down Capability**
From any metric, admin should be able to:
- Click to see detailed breakdown
- View individual employee data
- Access historical trends
- Compare across time periods
- Filter by department/status

### 4. **Benchmarking** (Future Enhancement)
- Industry average comparison
- Historical baseline comparison
- Department performance vs. company average
- Cost efficiency benchmarks

---

## 🛠️ Implementation Priority

### Phase 1: Essential Metrics (Week 1-2)
- [x] Basic stats (already implemented)
- [ ] Financial summary with trends
- [ ] Exception/alert system
- [ ] Department breakdown
- [ ] YTD calculations

### Phase 2: Analytics & Insights (Week 3-4)
- [ ] Historical trend charts
- [ ] Workforce analytics
- [ ] Cost composition analysis
- [ ] Audit log integration
- [ ] Export functionality

### Phase 3: Advanced Features (Week 5-6)
- [ ] Cash flow forecasting
- [ ] Custom date range selection
- [ ] Advanced filtering
- [ ] Email notifications
- [ ] Mobile-responsive design

### Phase 4: Intelligence & Automation (Future)
- [ ] Predictive analytics
- [ ] Anomaly detection AI
- [ ] Automated reporting
- [ ] Benchmarking
- [ ] Integration with accounting systems

---

## 💡 Key Recommendations

1. **Role-Based Views**: Implement different dashboard layouts for Admin vs. HR users
2. **Real-Time Updates**: Use Supabase realtime subscriptions for live data
3. **Performance**: Cache expensive calculations (YTD, trends)
4. **Mobile Access**: Ensure executives can view key metrics on mobile
5. **Alerts**: Proactive notification system for critical issues
6. **Drill-Down**: Every metric should allow clicking for details
7. **Export Options**: PDF, Excel, CSV for all reports
8. **Data Visualization**: Use charts/graphs for trends and comparisons
9. **Date Filters**: Global date range selector for all metrics
10. **Favorites**: Allow users to customize their dashboard widgets

---

## 📊 Sample SQL Queries for Metrics

### Total Payroll Cost (Current Week)
```sql
SELECT SUM(gross_pay) as total_gross, 
       SUM(net_pay) as total_net,
       COUNT(*) as employee_count
FROM payslips
WHERE week_start_date = '2025-11-17';
```

### YTD Payroll Cost
```sql
SELECT SUM(gross_pay) as ytd_gross,
       SUM(net_pay) as ytd_net,
       SUM(total_deductions) as ytd_deductions
FROM payslips
WHERE EXTRACT(YEAR FROM week_start_date) = 2025;
```

### Department Cost Breakdown
```sql
SELECT e.department,
       COUNT(DISTINCT p.employee_id) as employee_count,
       SUM(p.gross_pay) as total_cost,
       AVG(p.gross_pay) as avg_cost_per_employee
FROM payslips p
JOIN employees e ON p.employee_id = e.id
WHERE p.week_start_date = '2025-11-17'
GROUP BY e.department
ORDER BY total_cost DESC;
```

### Turnover Rate (Last 12 Months)
```sql
WITH departures AS (
  SELECT COUNT(*) as left_count
  FROM employees
  WHERE is_active = false
    AND updated_at >= NOW() - INTERVAL '12 months'
),
avg_headcount AS (
  SELECT AVG(monthly_count) as avg_count
  FROM (
    SELECT DATE_TRUNC('month', created_at) as month,
           COUNT(*) as monthly_count
    FROM employees
    WHERE created_at >= NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
  ) monthly
)
SELECT 
  (d.left_count::float / a.avg_count * 100) as turnover_rate_percentage
FROM departures d, avg_headcount a;
```

### Payroll Trend (Last 12 Weeks)
```sql
SELECT 
  week_start_date,
  SUM(gross_pay) as weekly_gross,
  SUM(net_pay) as weekly_net,
  COUNT(DISTINCT employee_id) as employee_count
FROM payslips
WHERE week_start_date >= CURRENT_DATE - INTERVAL '84 days'
GROUP BY week_start_date
ORDER BY week_start_date DESC;
```

---

## 🎯 Success Metrics

The admin dashboard is successful when:
1. **Executives can answer key questions in < 30 seconds**
   - What's our weekly payroll cost?
   - How many employees do we have?
   - Are we on budget?
   - Any critical issues?

2. **Proactive Issue Detection**
   - Exceptions flagged before they become problems
   - Budget overruns detected early
   - Compliance deadlines visible and tracked

3. **Data-Driven Decision Making**
   - Historical trends inform hiring decisions
   - Cost analysis drives operational improvements
   - Department comparisons enable resource allocation

4. **Time Savings**
   - No manual report generation needed
   - Automated alerts reduce oversight burden
   - One-click exports for board meetings

---

## 📚 Related Documents
- [Implementation Plan](./IMPROVEMENT_RECOMMENDATIONS.md)
- [Database Schema](./supabase/migrations/001_initial_schema.sql)
- [Project Status](./PROJECT_STATUS.md)
- [Deployment Guide](./DEPLOYMENT_GUIDE.md)

---

**Last Updated**: November 19, 2025  
**Version**: 1.0  
**Author**: System Architect

