# Audit Trail Implementation

## Overview

This document describes the comprehensive audit trail system implemented for employee-related features, including first login tracking and an admin-only audit dashboard.

## Features Implemented

### 1. Employee First Login Tracking

**Database Table**: `employee_first_login`

Tracks the first time an employee logs into the employee portal, capturing:
- **IP Address**: Client IP address at first login
- **Device Information**: Browser, OS, device type
- **MAC Address**: If available (limited browser support)
- **User Agent**: Full browser user agent string
- **Login/Logout Times**: Timestamp of first login and first logout

**Key Features**:
- One record per employee (UNIQUE constraint)
- Automatic recording via database function `record_employee_first_login()`
- RLS policy: Only Admins can view first login records
- Indexed for performance on employee_id, IP address, and login time

### 2. Comprehensive Audit Logging

**Database Table**: `audit_logs` (existing, enhanced)

All employee-related tables now have automatic audit logging:

#### Tables with Audit Tracking:
1. **employees** - All create, update, delete operations
   - Tracks: employee_id, full_name, position, job_level, rates, status changes, password changes
   - Special handling: Password changes logged without exposing actual password

2. **employee_loans** - Already implemented (see LOAN_MANAGEMENT_SECURITY_AUDIT.md)
   - Tracks: loan creation, balance/term changes, status changes

3. **employee_deductions** - All create, update, delete operations
   - Tracks: vale amounts, SSS loans, Pag-IBIG loans

4. **employee_location_assignments** - All create, delete operations
   - Tracks: location assignments and removals

5. **employee_week_schedules** - All create, update, delete operations
   - Tracks: schedule changes, day off modifications

**Audit Log Fields**:
- `user_id`: Who made the change
- `action`: INSERT, UPDATE, or DELETE
- `table_name`: Which table was modified
- `record_id`: ID of the affected record
- `old_data`: Previous values (JSONB)
- `new_data`: New values (JSONB)
- `created_at`: When the change occurred

### 3. Database Triggers

All audit logging is implemented via PostgreSQL triggers:
- **Automatic**: Cannot be bypassed (database-level enforcement)
- **SECURITY DEFINER**: Runs with elevated privileges to ensure logging even if RLS blocks direct access
- **Efficient**: Only logs changed fields for UPDATE operations
- **Indexed**: Optimized indexes for fast queries by table_name and record_id

### 4. Frontend Updates

#### Employee Management (`app/employees/page.tsx`)
- Sets `updated_by` field when:
  - Creating new employees
  - Updating employee information
  - Toggling employee status
  - Changing employee passwords

#### Employee Login (`app/login/LoginPageClient.tsx`)
- Captures device information on login
- Calls API to record first login
- Uses `utils/device-info.ts` to parse user agent

#### Employee Logout (`app/employee-portal/layout.tsx`)
- Records logout time for first login tracking

### 5. Admin Audit Dashboard

**Location**: `/audit` (Admin only)

**Features**:
- **Audit Logs Tab**: View all audit log entries
  - Filter by table name (employees, loans, deductions, etc.)
  - Filter by action (INSERT, UPDATE, DELETE)
  - Search by user, record ID, or table name
  - Shows before/after values for updates
  - Displays user who made the change

- **First Login Tracking Tab**: View employee first login records
  - Shows IP address, device info, browser, OS
  - Displays login and logout times
  - Search by employee ID, name, or IP address

**Access Control**:
- Only visible to Admin users
- Added to Sidebar under "Admin" group
- Redirects non-admin users to dashboard

## Database Migrations

### Migration Files Created:
1. `create_employee_first_login_tracking.sql`
   - Creates `employee_first_login` table
   - Sets up RLS policies
   - Creates indexes

2. `add_employee_audit_tracking.sql`
   - Adds `updated_by` column to `employees` table
   - Creates `log_employee_changes()` function
   - Creates trigger `trigger_log_employee_changes`

3. `add_employee_deductions_audit_tracking.sql`
   - Adds `updated_by` column to `employee_deductions` table
   - Creates `log_employee_deductions_changes()` function
   - Creates trigger `trigger_log_employee_deductions_changes`

4. `add_employee_location_schedule_audit_tracking.sql`
   - Adds `updated_by` columns to `employee_location_assignments` and `employee_week_schedules`
   - Creates audit logging functions and triggers for both tables

5. `create_employee_first_login_function.sql`
   - Creates `record_employee_first_login()` function
   - Handles first login recording and logout time updates

## API Routes

### `/api/employee/first-login` (POST)
- Records employee first login with device information
- Captures IP address from request headers
- Returns success status and whether it was first login

## Utility Functions

### `utils/device-info.ts`
- `parseUserAgent()`: Parses user agent string to extract browser, OS, device type
- `getDeviceInfo()`: Gets device information from current browser
- `getMacAddress()`: Attempts to get MAC address (returns null - browser limitation)

## Security Features

### Row Level Security (RLS)
- **employee_first_login**: Only Admins can SELECT
- **audit_logs**: Only Admins can SELECT (existing policy)
- **System inserts**: Allowed via SECURITY DEFINER functions

### Audit Trail Benefits
1. **Accountability**: Every change is tracked with user ID
2. **Compliance**: Complete audit trail for regulatory requirements
3. **Forensics**: Can trace back who changed what and when
4. **Security**: Detects unauthorized changes or suspicious activity
5. **Transparency**: Admins can review all system changes

## Access Control Summary

| Feature | Admin | HR | Account Manager | Other |
|---------|-------|----|-----------------|-------|
| View Audit Logs | ✅ | ❌ | ❌ | ❌ |
| View First Login Records | ✅ | ❌ | ❌ | ❌ |
| Access Audit Dashboard | ✅ | ❌ | ❌ | ❌ |
| Employee Changes (tracked) | ✅ | ✅ | ❌ | ❌ |

## Testing Checklist

- [x] Employee first login is recorded with device info
- [x] Employee logout time is recorded
- [x] Employee create/update/delete operations are logged
- [x] Employee status changes are logged
- [x] Employee password changes are logged (without exposing password)
- [x] Loan changes are logged (already implemented)
- [x] Deduction changes are logged
- [x] Location assignment changes are logged
- [x] Schedule changes are logged
- [x] Audit dashboard displays all logs correctly
- [x] Audit dashboard filters work correctly
- [x] First login tracking displays correctly
- [x] Non-admin users cannot access audit dashboard
- [x] RLS policies prevent unauthorized access

## Notes

### MAC Address Limitation
MAC addresses are generally not accessible via web browsers for security reasons. The system attempts to capture them but will return `null` in most cases. Enterprise solutions may use browser extensions or plugins to capture MAC addresses if required.

### IP Address Accuracy
IP addresses are captured from request headers (`x-forwarded-for`). In production environments with proxies/load balancers, the actual client IP may be in the forwarded header chain.

### Performance Considerations
- Audit logs are limited to 500 most recent entries in the dashboard
- First login records are limited to 200 most recent entries
- Indexes are created for optimal query performance
- Triggers use efficient JSONB operations

## Future Enhancements (Optional)

1. **Export Functionality**: Export audit logs to CSV/PDF
2. **Email Notifications**: Alert admins on critical changes
3. **Change Reason Field**: Require reason for critical changes
4. **Two-Person Approval**: Require approval for sensitive changes
5. **Monitoring Dashboard**: Real-time alerts for suspicious activity
6. **Retention Policy**: Automatic archival of old audit logs


