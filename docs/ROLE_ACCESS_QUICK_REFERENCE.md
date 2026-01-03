# Role Access - Quick Reference

## Quick Access Matrix

| Page/Feature                        | Admin   | HR           | Account Manager  |
| ----------------------------------- | ------- | ------------ | ---------------- |
| **Dashboard**                       |
| Dashboard Overview                  | ✅      | ✅           | ✅               |
| Admin Dashboard (Executive Metrics) | ✅      | ❌           | ❌               |
| **People Management**               |
| Employee Directory                  | ✅ Full | ✅ Full\*    | ❌ No Access     |
| Create/Edit Employees               | ✅      | ✅           | ❌               |
| Delete Employees                    | ✅      | ❌           | ❌               |
| Employee Schedules                  | ✅      | ✅           | ✅               |
| Payslip Generation                  | ✅      | ✅           | ❌               |
| Payslip Approval                    | ✅      | ❌           | ❌               |
| **Time & Attendance**               |
| Timesheet                           | ✅      | ✅           | ✅               |
| Time Entries                        | ✅      | ✅           | ✅               |
| Leave Approvals                     | ✅ All  | ✅ All       | ✅ Assigned Only |
| OT Approvals                        | ✅ All  | ❌ Hidden    | ✅ Assigned Only |
| Failure to Log Approvals            | ✅ All  | ❌ Hidden    | ✅ Assigned Only |
| **Payroll**                         |
| Deductions Management               | ✅      | ✅           | ❌               |
| **Settings**                        |
| User Management                     | ✅      | ❌ View Only | ❌               |
| System Settings                     | ✅      | ❌           | ❌               |

\*HR cannot delete employees

---

## Key Differences

### Admin Only

- Delete employees
- Approve payslips (change status)
- Manage users (create/edit/delete)
- Manage holidays
- View Admin Dashboard

### HR Only

- Generate payslips (but cannot approve)
- Cannot see OT/Failure to Log approvals in sidebar
- Cannot delete employees

### Account Manager Only

- Approve requests for assigned employees only
- Cannot access employees page (hidden to prevent viewing salary information)
- Cannot manage employees or payroll
- Cannot access settings

---

## Sidebar Visibility

**Admin sees:**

- Dashboard
- People (Employees, Schedules, Payslips)
- Time & Attendance (All items including OT & Failure to Log)
- Settings

**Account Manager sees:**

- Dashboard
- People (Schedules, Payslips only - Employees hidden)
- Time & Attendance (All items including OT & Failure to Log)
- Settings

**HR sees:**

- Dashboard
- People (Employees, Schedules, Payslips)
- Time & Attendance (Time Attendance, Time Entries, Leave Approvals only)
- Settings

---

## Database Access Summary

| Table               | Admin             | HR        | Account Manager |
| ------------------- | ----------------- | --------- | --------------- |
| employees           | ✅ CRUD           | ✅ CRUD\* | ❌ No Access    |
| weekly_attendance   | ✅ CRUD           | ✅ CRUD   | ✅ Read         |
| employee_deductions | ✅ CRUD           | ✅ CRUD   | ✅ Read         |
| payslips            | ✅ CRUD + Approve | ✅ CRUD   | ✅ Read         |
| leave_requests      | ✅ All            | ✅ All    | ✅ Assigned     |
| overtime_requests   | ✅ All            | ❌        | ✅ Assigned     |
| failure_to_log      | ✅ All            | ❌        | ✅ Assigned     |
| holidays            | ✅ CRUD           | ✅ Read   | ✅ Read         |
| users               | ✅ CRUD           | ✅ Read   | ❌              |
| time_clock_entries  | ✅ CRUD           | ✅ CRUD   | ✅ Read         |

\*HR cannot delete employees

---

## Approval Workflows

### Leave Requests

- **Admin**: Can approve all
- **HR**: Can approve all
- **Account Manager**: Can approve assigned employees only

### Overtime Requests

- **Admin**: Can approve all
- **HR**: ❌ No access
- **Account Manager**: Can approve assigned employees only

### Failure to Log

- **Admin**: Can approve all
- **HR**: ❌ No access
- **Account Manager**: Can approve assigned employees only

### Payslips

- **Admin**: Can approve (change status to approved/paid)
- **HR**: Can generate/save but cannot approve
- **Account Manager**: ❌ No access

---

_For detailed information, see [ROLE_ACCESS_MATRIX.md](./ROLE_ACCESS_MATRIX.md)_