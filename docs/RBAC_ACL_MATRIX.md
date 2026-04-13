# RBAC/ACL Matrix - Complete Role-Based Access Control

**Last Updated:** January 2025
**System:** Green Pasture HRIS Admin/HR Dashboard

## Role Definitions

| Role | Description | Key Permissions |
|------|-------------|----------------|
| **Admin** | Full system administrator | ✅ All pages, all functions, can approve payslips, delete employees, manage users |
| **HR** | Human Resources staff | ✅ Most pages, can approve leaves/OT/failure-to-log, generate payslips (cannot approve), view all employees |
| **Approver** | Department managers/OT approvers | ✅ Limited to assigned employee groups, can approve OT/leaves/failure-to-log for assigned groups only |
| **Viewer** | Read-only OT viewer | 👁️ View-only access to OT approvals for assigned groups only |

**Note:** HR role now has approver permissions (`isApprover: role === "approver" || role === "hr"`)

---

## Complete Page-by-Page Access Matrix

### 📊 Overview / Dashboard

#### `/dashboard` - Main Dashboard

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • Executive Dashboard (executive metrics)<br>• Workforce Overview<br>• Switch between dashboard types |
| **HR** | ✅ Full | • Workforce Overview only<br>• HR metrics and KPIs |
| **Approver** | ❌ Redirected | Redirected to `/overtime-approval` |
| **Viewer** | ❌ Redirected | Redirected to `/overtime-approval` |

**Access Control:**
- Admin sees both Executive and Workforce dashboards
- HR and others see Workforce Overview only
- Restricted access users (approver/viewer) are redirected to OT approvals

---

### 👥 People Management

#### `/employees` - Employee Directory

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all employees<br>• Create new employees<br>• Edit employee information<br>• Delete employees<br>• Manage employee schedules<br>• Reset employee passwords<br>• View salary information<br>• Manage employee assignments |
| **HR** | ✅ Full (except delete) | • View all employees<br>• Create new employees<br>• Edit employee information<br>• Manage employee schedules<br>• Reset employee passwords<br>• View salary information<br>• Manage employee assignments<br>• ❌ Cannot delete employees |
| **Approver** | ❌ Hidden | Page hidden from navigation (cannot view salary information) |
| **Viewer** | ❌ Hidden | Page hidden from navigation |

**Access Control:**
- Admin: Full CRUD access
- HR: Full access except delete
- Approver/Viewer: Hidden from sidebar, redirected if accessed directly

**Key Functions:**
- Employee CRUD operations
- Schedule management
- Password reset
- Profile picture upload
- Location assignments
- Overtime group assignments

---

#### `/schedules` - Employee Schedules

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all employee schedules<br>• Create/edit schedule entries<br>• Week-by-week schedule management<br>• Manage rest days |
| **HR** | ✅ Full | • View all employee schedules<br>• Create/edit schedule entries<br>• Week-by-week schedule management<br>• Manage rest days |
| **Approver** | ✅ Full | • View schedules for assigned employees<br>• Create/edit schedule entries<br>• Week-by-week schedule management |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin/HR: See all employees
- Approver: See assigned employees only (filtered by overtime groups)

---

#### `/payslips` - Payslip Generation

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all employees<br>• Generate payslips<br>• Save payslips<br>• Approve payslips (change status)<br>• Print payslips<br>• View detailed breakdown<br>• Export payslips |
| **HR** | ✅ Limited | • View all employees (if `can_access_salary = true`)<br>• Generate payslips<br>• Save payslips<br>• Print payslips<br>• View detailed breakdown<br>• Export payslips<br>• ❌ Cannot approve payslips (Admin only) |
| **Approver** | ❌ No Access | Redirected to dashboard |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Requires `canAccessSalaryInfo` (Admin or HR with `can_access_salary = true`)
- HR users without salary access are redirected
- Only Admin can approve payslips (change status to approved/paid)

**Key Functions:**
- Payslip generation for bi-monthly periods
- Automatic calculation of gross pay, deductions, net pay
- Detailed breakdown view
- Print/export functionality
- Payslip approval workflow (Admin only)

---

#### `/loans` - Employee Loans Management

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all employee loans<br>• Create new loans<br>• Edit loan details<br>• Deactivate/reactivate loans<br>• View loan audit trail<br>• Manage loan types (company, SSS, Pag-IBIG, emergency, other) |
| **HR** | ✅ Full | • View all employee loans<br>• Create new loans<br>• Edit loan details<br>• Deactivate/reactivate loans<br>• View loan audit trail<br>• Manage loan types |
| **Approver** | ❌ No Access | Redirected to dashboard |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin and HR only
- Full CRUD operations
- Audit trail tracking for all changes

**Key Functions:**
- Loan creation and management
- Loan type management (company, SSS, Pag-IBIG, emergency, other)
- Cutoff assignment (first, second, both)
- Loan balance tracking
- Audit log viewing

---

### ⏰ Time & Attendance

#### `/timesheet` - Time Attendance

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all employees' timesheets<br>• View daily attendance<br>• View OT/ND hours<br>• View leave days<br>• Calculate days worked<br>• Export timesheet data |
| **HR** | ✅ Full | • View all employees' timesheets<br>• View daily attendance<br>• View OT/ND hours<br>• View leave days<br>• Calculate days worked<br>• Export timesheet data |
| **Approver** | ✅ Limited | • View timesheets for assigned employees only<br>• View daily attendance<br>• View OT/ND hours<br>• View leave days |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin/HR: See all employees (bypass group restrictions)
- Approver: See assigned employees only (filtered by `assignedGroupIds`)

**Key Functions:**
- Daily attendance viewing
- OT/ND hours display
- Leave days tracking
- Days worked calculation
- Period-based filtering

---

#### `/time-entries` - Time Clock Entries

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all time clock entries<br>• Filter by employee, date range<br>• View clock in/out times<br>• View location information |
| **HR** | ✅ Full | • View all time clock entries<br>• Filter by employee, date range<br>• View clock in/out times<br>• View location information |
| **Approver** | ✅ Limited | • View time entries for assigned employees only<br>• Filter by date range<br>• View clock in/out times |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin/HR: See all employees (bypass group restrictions)
- Approver: See assigned employees only

**Key Functions:**
- Time entry viewing
- Date range filtering
- Employee filtering
- Location tracking

---

#### `/leave-approval` - Leave Request Approvals

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all leave requests<br>• Approve/reject pending requests<br>• Approve requests already approved by manager<br>• View leave history<br>• Filter by status, employee, date range<br>• Add notes to approvals |
| **HR** | ✅ Full | • View all leave requests<br>• Approve/reject pending requests (acting as manager)<br>• Approve requests already approved by manager (acting as HR)<br>• View leave history<br>• Filter by status, employee, date range<br>• Add notes to approvals |
| **Approver** | ✅ Limited | • View leave requests for assigned employees only<br>• Approve/reject pending requests (manager level)<br>• Filter by status, employee, date range<br>• Add notes to approvals |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin/HR: See all employees (bypass group restrictions)
- Approver: See assigned employees only
- HR can approve at both manager and HR levels

**Key Functions:**
- Two-step approval workflow (manager → HR)
- Leave type management (SIL, LWOP, Maternity, Paternity)
- Document viewing/downloading
- Notes and rejection reasons
- Status filtering

**Approval Logic:**
- Admin: Can approve `pending` or `approved_by_manager` requests
- HR: Can approve `pending` (as manager) or `approved_by_manager` (as HR)
- Approver: Can approve `pending` requests only (manager level)

---

#### `/overtime-approval` - Overtime Request Approvals

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all OT requests<br>• Approve/reject OT requests<br>• View OT history<br>• Filter by status, employee, week<br>• Download supporting documents |
| **HR** | ✅ Full | • View all OT requests<br>• Approve/reject OT requests<br>• View OT history<br>• Filter by status, employee, week<br>• Download supporting documents |
| **Approver** | ✅ Limited | • View OT requests for assigned groups only<br>• Approve/reject OT requests for assigned groups<br>• Filter by status, employee, week<br>• Download supporting documents |
| **Viewer** | ✅ Limited (Read-only) | • View OT requests for assigned groups only<br>• Filter by status, employee, week<br>• Download supporting documents<br>• ❌ Cannot approve/reject |

**Access Control:**
- Admin/HR: See all employees (bypass group restrictions)
- Approver/Viewer: See assigned groups only (filtered by `assignedGroupIds`)

**Key Functions:**
- OT request approval/rejection
- Week-based filtering
- Employee filtering
- Document viewing/downloading
- Status filtering

**Note:** HR users can now access this page (previously hidden)

---

#### `/failure-to-log-approval` - Failure to Log Approvals

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all failure-to-log requests<br>• Approve/reject requests<br>• View request history<br>• Filter by status, employee, week<br>• Add rejection reasons |
| **HR** | ✅ Full | • View all failure-to-log requests<br>• Approve/reject requests<br>• View request history<br>• Filter by status, employee, week<br>• Add rejection reasons |
| **Approver** | ✅ Limited | • View requests for assigned employees only<br>• Approve/reject requests<br>• Filter by status, employee, week<br>• Add rejection reasons |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin/HR: See all employees (bypass group restrictions)
- Approver: See assigned employees only

**Key Functions:**
- Failure-to-log request approval/rejection
- Manual time entry correction
- Rejection reason tracking
- Week-based filtering

**Note:** HR users can now access this page (previously hidden)

---

### 💰 Payroll & Deductions

#### `/deductions` - Employee Deductions

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all employee deductions<br>• Create/edit deductions<br>• Set deductions per bi-monthly period<br>• View deduction history<br>• Manage all deduction types |
| **HR** | ✅ Full | • View all employee deductions<br>• Create/edit deductions<br>• Set deductions per bi-monthly period<br>• View deduction history<br>• Manage all deduction types |
| **Approver** | ❌ No Access | Redirected to dashboard |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin and HR only

**Key Functions:**
- Vale amount management
- SSS loans (salary, calamity)
- Pag-IBIG loans (salary, calamity)
- Contribution management (SSS, PhilHealth, Pag-IBIG)
- Withholding tax
- Period-based assignment

---

### ⚙️ Settings & Administration

#### `/settings` - System Settings

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all users<br>• Create new users<br>• Edit user information<br>• Delete users<br>• Change user roles<br>• Activate/deactivate users<br>• Manage OT group assignments<br>• Manage holidays<br>• Upload profile pictures |
| **HR** | ✅ Limited (View Only) | • View all users<br>• View user information<br>• View OT group assignments<br>• View holidays<br>• ❌ Cannot create/edit/delete users<br>• ❌ Cannot change roles<br>• ❌ Cannot manage holidays |
| **Approver** | ❌ No Access | Redirected to dashboard |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin: Full CRUD access
- HR: Read-only access to users and settings

**Key Functions:**
- User management (CRUD)
- Role assignment
- User activation/deactivation
- Employee-specific OT assignment
- Holiday management (Admin only)
- Profile picture management

---

#### `/overtime-groups` - Retired

| Role | Access | Features Available |
|------|--------|-------------------|
| **All roles** | ⚠️ Informational only | Group-based routing has been removed; the page now links users back to settings |

**Access Control:**
- Retired page kept only to avoid broken links

**Key Functions:**
- OT group CRUD operations
- Approver/viewer assignment
- Account creation for OT approvers/viewers

---

### 📊 Reports & Audit

#### `/audit` - Audit Dashboard

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • View all audit logs<br>• Filter by table, user, action, date range<br>• View detailed change history<br>• Export audit logs<br>• View user activity |
| **HR** | ❌ No Access | Redirected to dashboard |
| **Approver** | ❌ No Access | Redirected to dashboard |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin only

**Key Functions:**
- Audit log viewing
- Change tracking
- User activity monitoring
- Table-based filtering
- Date range filtering

---

#### `/bir-reports` - BIR Reports

| Role | Access | Features Available |
|------|--------|-------------------|
| **Admin** | ✅ Full | • Generate BIR Form 2316 (per employee)<br>• Generate BIR Form 1604E (summary)<br>• Generate Alphalist of Employees<br>• Export to Excel<br>• Filter by year |
| **HR** | ✅ Full | • Generate BIR Form 2316 (per employee)<br>• Generate BIR Form 1604E (summary)<br>• Generate Alphalist of Employees<br>• Export to Excel<br>• Filter by year |
| **Approver** | ❌ No Access | Redirected to dashboard |
| **Viewer** | ❌ No Access | Redirected to dashboard |

**Access Control:**
- Admin and HR only

**Key Functions:**
- BIR Form 2316 generation
- BIR Form 1604E generation
- Alphalist of Employees generation
- Year-to-date calculations
- Excel export

---

## Function-Level Permissions Matrix

### Employee Management Functions

| Function | Admin | HR | Approver | Viewer |
|----------|-------|----|----------|--------|
| View all employees | ✅ | ✅ | ❌ | ❌ |
| View assigned employees | ✅ | ✅ | ✅ | ❌ |
| Create employee | ✅ | ✅ | ❌ | ❌ |
| Edit employee | ✅ | ✅ | ❌ | ❌ |
| Delete employee | ✅ | ❌ | ❌ | ❌ |
| Reset password | ✅ | ✅ | ❌ | ❌ |
| View salary info | ✅ | ✅* | ❌ | ❌ |
| Manage schedules | ✅ | ✅ | ✅ | ❌ |

*HR requires `can_access_salary = true` for salary-related pages

### Payslip Functions

| Function | Admin | HR | Approver | Viewer |
|----------|-------|----|----------|--------|
| Generate payslips | ✅ | ✅* | ❌ | ❌ |
| Save payslips | ✅ | ✅* | ❌ | ❌ |
| Approve payslips | ✅ | ❌ | ❌ | ❌ |
| Print payslips | ✅ | ✅* | ❌ | ❌ |
| View payslip details | ✅ | ✅* | ❌ | ❌ |

*HR requires `can_access_salary = true`

### Approval Functions

| Function | Admin | HR | Approver | Viewer |
|----------|-------|----|----------|--------|
| Approve OT requests (all) | ✅ | ✅ | ❌ | ❌ |
| Approve OT requests (assigned) | ✅ | ✅ | ✅ | ❌ |
| View OT requests (all) | ✅ | ✅ | ❌ | ❌ |
| View OT requests (assigned) | ✅ | ✅ | ✅ | ✅ |
| Approve leave requests (all) | ✅ | ✅ | ❌ | ❌ |
| Approve leave requests (assigned) | ✅ | ✅ | ✅ | ❌ |
| Approve failure-to-log (all) | ✅ | ✅ | ❌ | ❌ |
| Approve failure-to-log (assigned) | ✅ | ✅ | ✅ | ❌ |

### Time & Attendance Functions

| Function | Admin | HR | Approver | Viewer |
|----------|-------|----|----------|--------|
| View timesheets (all) | ✅ | ✅ | ❌ | ❌ |
| View timesheets (assigned) | ✅ | ✅ | ✅ | ❌ |
| View time entries (all) | ✅ | ✅ | ❌ | ❌ |
| View time entries (assigned) | ✅ | ✅ | ✅ | ❌ |
| Edit time entries | ✅ | ✅ | ❌ | ❌ |

### Settings & Administration Functions

| Function | Admin | HR | Approver | Viewer |
|----------|-------|----|----------|--------|
| View users | ✅ | ✅ | ❌ | ❌ |
| Create users | ✅ | ❌ | ❌ | ❌ |
| Edit users | ✅ | ❌ | ❌ | ❌ |
| Delete users | ✅ | ❌ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ | ❌ |
| Manage holidays | ✅ | ❌ | ❌ | ❌ |
| Manage OT groups | ✅ | ❌ | ❌ | ❌ |
| View audit logs | ✅ | ❌ | ❌ | ❌ |
| Generate BIR reports | ✅ | ✅ | ❌ | ❌ |

---

## Sidebar Navigation Visibility

### Admin Sidebar
- ✅ Overview (Executive Dashboard, Workforce Overview)
- ✅ People (Employees, Schedules, Loans, Payslips)
- ✅ Time & Attendance (Time Attendance, Time Entries, Leave Approvals, OT Approvals, Failure to Log)
- ✅ Admin (Audit Dashboard, BIR Reports)
- ✅ Settings

### HR Sidebar
- ✅ Overview (Workforce Overview only)
- ✅ People (Employees, Schedules, Loans, Payslips*)
- ✅ Time & Attendance (Time Attendance, Time Entries, Leave Approvals, OT Approvals, Failure to Log)
- ✅ Settings

*Payslips hidden if `can_access_salary = false`

### Approver Sidebar
- ❌ Overview (redirected to OT approvals)
- ❌ People (redirected to OT approvals)
- ✅ Time & Attendance (OT Approvals only - all other items hidden)
- ❌ Admin (redirected to OT approvals)
- ❌ Settings (redirected to OT approvals)

### Viewer Sidebar
- ❌ Overview (redirected to OT approvals)
- ❌ People (redirected to OT approvals)
- ✅ Time & Attendance (OT Approvals only - all other items hidden)
- ❌ Admin (redirected to OT approvals)
- ❌ Settings (redirected to OT approvals)

---

## Database Table Access Summary

| Table | Admin | HR | Approver | Viewer |
|-------|-------|----|----------|--------|
| `employees` | ✅ CRUD | ✅ CRUD* | ❌ | ❌ |
| `weekly_attendance` | ✅ CRUD | ✅ CRUD | ✅ Read | ❌ |
| `payslips` | ✅ CRUD + Approve | ✅ CRUD | ❌ | ❌ |
| `employee_deductions` | ✅ CRUD | ✅ CRUD | ❌ | ❌ |
| `employee_loans` | ✅ CRUD | ✅ CRUD | ❌ | ❌ |
| `leave_requests` | ✅ All | ✅ All | ✅ Assigned | ❌ |
| `overtime_requests` | ✅ All | ✅ All | ✅ Assigned | ✅ Assigned (Read) |
| `failure_to_log` | ✅ All | ✅ All | ✅ Assigned | ❌ |
| `time_clock_entries` | ✅ CRUD | ✅ CRUD | ✅ Read | ❌ |
| `holidays` | ✅ CRUD | ✅ Read | ✅ Read | ❌ |
| `users` | ✅ CRUD | ✅ Read | ❌ | ❌ |
| `overtime_groups` | ✅ CRUD | ✅ Read | ✅ Read | ✅ Read |
| `audit_logs` | ✅ Read | ❌ | ❌ | ❌ |

*HR cannot delete employees

---

## Special Access Rules

### HR Role Enhancements (Recent Changes)
- ✅ HR users now have approver permissions (`isApprover: true`)
- ✅ HR can approve OT requests (previously blocked)
- ✅ HR can approve failure-to-log requests (previously blocked)
- ✅ HR can approve leave requests at both manager and HR levels
- ✅ HR can view all employees (bypasses group restrictions)

### Salary Access Flag
- HR users require `can_access_salary = true` to access:
  - `/payslips` page
  - Employee salary information
- Admin always has salary access

### First-Approver Routing
- `ADMIN STAFF`, `HR Assistant`, `Project Coordinator`, and `Industrial Engineer` route to **HR** first
- All other employees route to **Operations Manager** first
- Group-based routing is no longer used for request approvals

### Approval Workflows

#### Leave Requests (2-Step)
1. **First Approval**: Operations Manager approves most `pending` requests, while HR directly approves excluded-position requests
2. **HR Level**: HR approves `approved_by_manager` → `approved_by_hr` for the standard two-step flow
- Admin can approve at either level
- HR can approve excluded pending requests and the final HR stage

#### OT Requests (1-Step)
- Operations Manager or HR approves `pending` → `approved` based on employee position
- Admin and Upper Management retain broad visibility

#### Failure-to-Log (1-Step)
- Operations Manager or HR approves `pending` → `approved` based on employee position
- Updates time clock entries automatically

---

## Access Denial Behaviors

### Redirects
- **Approver/Viewer** accessing `/dashboard` → Redirected to `/overtime-approval`
- `/overtime-groups` remains as a retired informational page
- **Non-admin/HR** accessing `/audit` → Redirected to `/dashboard`
- **Non-admin/HR** accessing `/bir-reports` → Redirected to `/dashboard`
- **HR without salary access** accessing `/payslips` → Redirected to `/dashboard`

### Hidden Pages
- `/employees` hidden from Approver/Viewer sidebar
- `/overtime-approval` and `/failure-to-log-approval` hidden from HR sidebar (but accessible if URL is known)

### Error Messages
- Access denied pages show: "You do not have permission to access this page"
- Toast notifications for access violations

---

## Notes

1. **HR Role Evolution**: HR role now has dual capabilities (HR + Approver), allowing them to approve requests while maintaining HR-specific access.

2. **Group Assignments**: Approver/Viewer roles are restricted to assigned overtime groups. Admin and HR bypass these restrictions.

3. **Salary Access**: HR users need explicit `can_access_salary = true` flag to access payslip generation and salary information.

4. **Payslip Approval**: Only Admin can approve payslips (change status). HR can generate and save but cannot approve.

5. **Audit Trail**: All critical operations (employee changes, loan modifications, etc.) are logged in audit tables (Admin access only).

6. **BIR Reports**: Admin and HR can generate BIR-compliant reports for tax filing purposes.

---

## Quick Reference

### Who Can Do What?

**Full System Access:**
- ✅ Admin

**HR Functions:**
- ✅ Admin, HR

**Approval Functions (All Employees):**
- ✅ Admin, HR

**Approval Functions (Assigned Only):**
- ✅ Admin, HR, Approver

**View-Only (Assigned Only):**
- ✅ Admin, HR, Approver, Viewer (OT only)

**Read-Only Access:**
- ✅ Viewer (OT approvals only)

---

*This matrix reflects the current implementation as of January 2025. For updates or clarifications, refer to the codebase or contact the development team.*