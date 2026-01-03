# Admin Flow: Time Entries → Time Attendance → Payslips

## Overview

This document describes the complete flow for admins to view and manage employee data from time entries through time attendance to payslip generation, across all job levels.

## Flow Diagram

```
Time Entries (Raw Data)
    ↓
Time Attendance (Processed Data)
    ↓
Payslips (Payroll Calculation)
```

## 1. Time Entries (`/time-entries`)

### Purpose
View and approve raw clock in/out entries from the `time_clock_entries` table.

### Admin Access
- ✅ **Full Access**: Can view all employees' time entries
- ✅ **Filter by Employee**: Can filter to view specific employee entries
- ✅ **Filter by Status**: Can filter by entry status (clocked_in, clocked_out, approved, rejected)
- ✅ **Filter by Week**: Can navigate between weeks
- ✅ **Approve/Reject**: Can approve or reject entries with HR notes

### Data Source
- **Table**: `time_clock_entries`
- **Query**: Fetches all entries for selected week, optionally filtered by employee and status
- **Employee Filter**: Loads all active employees (no job level restriction)

### Key Features
- View clock in/out times with location details
- See calculated hours (regular, overtime, night differential)
- Approve entries to make them available for timesheet generation
- Export entries to CSV

### Employee Loading
```typescript
// Loads ALL active employees (no job level filter)
const { data } = await supabase
  .from("employees")
  .select("id, employee_id, full_name")
  .order("full_name", { ascending: true });
```

### Status Flow
1. **clocked_in**: Employee has clocked in but not out yet
2. **clocked_out**: Employee has clocked out, pending review
3. **approved**: Entry approved by admin/HR
4. **auto_approved**: Entry automatically approved (system)
5. **rejected**: Entry rejected by admin/HR

---

## 2. Time Attendance (`/timesheet`)

### Purpose
View processed attendance data generated from approved time entries, showing daily breakdown of hours worked.

### Admin Access
- ✅ **Full Access**: Can view all employees' attendance records
- ✅ **Select Employee**: Can select any employee from dropdown
- ✅ **Select Period**: Can view first or second cutoff period (bi-monthly)
- ✅ **Auto-Generate**: Automatically generates timesheet from clock entries if missing

### Data Source
- **Table**: `weekly_attendance` (generated from `time_clock_entries`)
- **Generation**: Uses `generateTimesheetFromClockEntries()` function
- **Period**: Bi-monthly periods (1-15, 16-end of month)

### Key Features
- Daily attendance breakdown showing:
  - Regular hours
  - Overtime hours
  - Night differential hours
  - Leave days (SIL, LWOP, CTO, OB)
  - Rest days
- Visual calendar view
- Summary totals for the period

### Employee Loading
```typescript
// Loads ALL active employees (no job level filter)
const { data } = await supabase
  .from("employees")
  .select("id, employee_id, full_name, eligible_for_ot, position")
  .eq("is_active", true)
  .order("full_name");
```

### Data Generation Flow
1. Select employee and period
2. Check if `weekly_attendance` record exists for period
3. If missing, auto-generate from `time_clock_entries` via API endpoint
4. Display attendance data with daily breakdown

### Attendance Calculation
- Uses `generateTimesheetFromClockEntries()` function
- Groups clock entries by date (Asia/Manila timezone)
- Calculates regular hours, OT, and night differential
- Applies holiday rules
- Handles rest days for Account Supervisors

---

## 3. Payslips (`/payslips`)

### Purpose
Generate and manage employee payslips based on attendance data, calculating gross pay, deductions, and net pay.

### Admin Access
- ✅ **Full Access**: Can generate payslips for all employees
- ✅ **Select Employee**: Can select any employee from dropdown
- ✅ **Select Period**: Can view first or second cutoff period
- ✅ **Generate Payslip**: Can generate payslip from attendance data
- ✅ **Approve Payslip**: Can approve payslips (change status to approved/paid)
- ✅ **Save Payslip**: Can save payslip to database

### Data Source
- **Primary**: Generates from `time_clock_entries` (same as timesheet)
- **Deductions**: From `employee_deductions` table
- **Loans**: From `loans` table (active loans)
- **Leave Requests**: From `leave_requests` table (approved leaves)

### Key Features
- Calculate gross pay based on:
  - Regular hours × rate
  - Overtime hours × OT rate
  - Night differential hours × ND rate
  - Leave days (SIL counts as 8 hours)
- Calculate deductions:
  - SSS (monthly, applied on second cutoff)
  - PhilHealth (monthly, applied on second cutoff)
  - Pag-IBIG (monthly, applied on second cutoff)
  - Withholding Tax (based on BIR tables)
  - Loan deductions
- Generate payslip PDF
- Save payslip to `payslips` table
- Approve payslip (Admin only)

### Employee Loading
```typescript
// Loads ALL active employees including job_level (no filter)
const { data } = await supabase
  .from("employees")
  .select("id, employee_id, full_name, monthly_rate, per_day, position, eligible_for_ot, assigned_hotel, employee_type, job_level")
  .eq("is_active", true)
  .order("full_name");
```

### Payslip Generation Flow
1. Select employee and period
2. Load attendance data (generated from clock entries)
3. Load deductions (SSS, PhilHealth, Pag-IBIG, Tax)
4. Load active loans
5. Calculate gross pay from attendance
6. Calculate total deductions
7. Calculate net pay = gross pay - deductions
8. Generate payslip preview
9. Save to database (optional)
10. Approve payslip (Admin only)

### Job Level Handling
- **Managerial**: Uses monthly rate calculation
- **Supervisory**: Uses monthly rate or per day calculation
- **Rank and File**: Uses per day calculation
- All job levels are included in employee dropdown (no filtering)

---

## Complete Flow Example

### Scenario: Admin reviewing employee payroll for December 1-15, 2024

1. **Time Entries** (`/time-entries`)
   - Admin navigates to Time Entries page
   - Selects week containing Dec 1-15
   - Views all employees' clock entries
   - Reviews entries for accuracy
   - Approves entries (changes status from `clocked_out` to `approved`)

2. **Time Attendance** (`/timesheet`)
   - Admin navigates to Time Attendance page
   - Selects employee (e.g., "John Doe")
   - Selects period: "First Cutoff" (Dec 1-15)
   - System auto-generates timesheet from approved clock entries
   - Admin reviews daily breakdown:
     - Regular hours: 80 hours
     - Overtime: 10 hours
     - Night differential: 5 hours
     - Leave days: 1 day SIL

3. **Payslips** (`/payslips`)
   - Admin navigates to Payslips page
   - Selects same employee ("John Doe")
   - Selects same period (Dec 1-15)
   - System loads attendance data (same as timesheet)
   - Calculates gross pay:
     - Regular: 80 hours × rate
     - OT: 10 hours × OT rate
     - ND: 5 hours × ND rate
     - SIL: 8 hours × rate
   - Calculates deductions:
     - SSS: (if second cutoff)
     - PhilHealth: (if second cutoff)
     - Pag-IBIG: (if second cutoff)
     - Tax: Based on gross pay
     - Loans: Active loan deductions
   - Generates payslip preview
   - Admin reviews and saves payslip
   - Admin approves payslip (status: approved/paid)

---

## Job Level Coverage

### Current Implementation
- ✅ **All Job Levels Visible**: Admin can see all employees regardless of job level
- ✅ **No Filtering**: No job level filter in any of the three pages
- ✅ **Consistent Data**: All pages use the same employee list (all active employees)

### Job Levels Supported
1. **RANK AND FILE**: Rank and file employees
2. **SUPERVISORY**: Supervisory level employees
3. **MANAGERIAL**: Managerial level employees

### Employee Selection
All three pages load employees using:
```typescript
.eq("is_active", true)
.order("full_name")
```

No job level filtering is applied, ensuring admins can view all employees.

---

## Data Consistency

### Ensuring Consistency Across Pages

1. **Time Entries → Time Attendance**
   - Time attendance is generated from approved time entries
   - Uses same timezone (Asia/Manila) for date grouping
   - Same calculation logic for hours

2. **Time Attendance → Payslips**
   - Payslips regenerate attendance from clock entries (same as timesheet)
   - Uses same `generateTimesheetFromClockEntries()` function
   - Ensures payslip matches timesheet data

### Key Consistency Points
- ✅ Same timezone handling (Asia/Manila)
- ✅ Same date filtering logic
- ✅ Same hour calculation methods
- ✅ Same holiday handling
- ✅ Same leave request processing

---

## Admin Privileges Summary

| Feature | Time Entries | Time Attendance | Payslips |
|---------|-------------|----------------|----------|
| View All Employees | ✅ | ✅ | ✅ |
| Filter by Employee | ✅ | ✅ | ✅ |
| Filter by Job Level | ❌ | ❌ | ❌ |
| Approve/Reject | ✅ | ❌ | ✅ (Payslip approval) |
| Generate Data | ❌ | ✅ (Auto-generate) | ✅ (Generate payslip) |
| Export | ✅ (CSV) | ❌ | ✅ (PDF) |
| Save to Database | ✅ (Approve entry) | ✅ (Auto-save) | ✅ (Save payslip) |

---

## Potential Improvements

### 1. Job Level Filtering
Add job level filter to all three pages to help admins focus on specific employee groups:
- Filter dropdown: "All Levels", "Rank and File", "Supervisory", "Managerial"

### 2. Bulk Operations
- Bulk approve time entries
- Bulk generate timesheets for multiple employees
- Bulk generate payslips for multiple employees

### 3. Reporting
- Summary report showing all employees' hours for a period
- Comparison report across job levels
- Export attendance data for all employees

### 4. Data Validation
- Warning if timesheet doesn't match time entries
- Warning if payslip doesn't match timesheet
- Validation checks before payslip approval

---

## Notes

- All three pages respect the admin role and show all employees
- No job level restrictions are applied
- Data flows consistently from time entries → attendance → payslips
- Admin can view and manage all employees across all job levels
