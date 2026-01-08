# CRUD Access Matrix - Complete Role-Based Access Control

**Date:** January 2025  
**System:** Green Pasture HRIS

---

## Role Definitions

| Role | Description | Key Characteristics |
|------|-------------|---------------------|
| **Admin** | Full system administrator | Full access to all tables, all CRUD operations |
| **HR** | Human Resources staff | Full access to most tables, can view all employees/requests, can approve |
| **Approver** | Department managers/OT approvers | Limited to assigned employee groups, can approve for assigned groups |
| **Viewer** | Read-only OT viewer | View-only access to OT approvals for assigned groups |
| **Employee** | Regular employees | Can only access own data via employee portal |

---

## April Gammad - Specific Access Profile

**User Details:**
- **Email:** anngammad@greenpasture.ph
- **Full Name:** April Nina Gammad
- **Role:** `hr`
- **Can Access Salary:** ✅ Yes (`can_access_salary = true`)
- **Is Active:** ✅ Yes
- **Overtime Group Assignment:** Approver for "HR COMPENSATION & BENEFITS" group

**Special Access Notes:**
- As HR: Can view ALL employees, ALL requests (bypasses group filtering)
- As Approver: Can approve requests for "HR COMPENSATION & BENEFITS" group
- Can access salary information (payslips, loans, deductions)
- Can access Admin pages (Audit Dashboard, BIR Reports)

---

## Complete CRUD Access Matrix by Table

### 1. Employees (`employees`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full CRUD access |
| **HR** | ✅ | ✅ All | ✅ All | ❌ | Cannot delete employees |
| **Approver** | ❌ | ✅ Assigned only | ❌ | ❌ | Limited to assigned groups |
| **Viewer** | ❌ | ✅ Assigned only | ❌ | ❌ | View-only, assigned groups |
| **Employee** | ❌ | ✅ Own only | ✅ Own profile pic | ❌ | Via employee portal |

**April Gammad Access:**
- ✅ **CREATE:** Yes (as HR)
- ✅ **READ:** All employees (HR bypasses group filtering)
- ✅ **UPDATE:** All employees (as HR)
- ❌ **DELETE:** No (HR cannot delete)

---

### 2. Leave Requests (`leave_requests`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ❌ | Can approve/reject all |
| **HR** | ✅ | ✅ All | ✅ All | ❌ | Can approve/reject all (acts as manager + HR) |
| **Approver** | ✅ | ✅ Assigned only | ✅ Assigned only | ❌ | Can approve manager-level for assigned groups |
| **Viewer** | ✅ | ✅ Assigned only | ❌ | ❌ | View-only for assigned groups |
| **Employee** | ✅ | ✅ Own only | ✅ Own (cancel pending) | ❌ | Can file and cancel own requests |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can file leave requests)
- ✅ **READ:** All leave requests (HR sees everything)
- ✅ **UPDATE:** All leave requests (can approve/reject as HR)
  - Can approve pending requests (acts as manager)
  - Can approve manager-approved requests (acts as HR)
- ❌ **DELETE:** No

**Approval Levels:**
- As HR: Can approve at both manager and HR levels
- As Approver: Can approve at manager level for "HR COMPENSATION & BENEFITS" group

---

### 3. Overtime Requests (`overtime_requests`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ❌ | Can approve/reject all |
| **HR** | ✅ | ✅ All | ✅ All | ❌ | Can approve/reject all (HR sees everything) |
| **Approver** | ✅ | ✅ Assigned only | ✅ Assigned only | ❌ | Can approve/reject for assigned groups |
| **Viewer** | ✅ | ✅ Assigned only | ❌ | ❌ | View-only for assigned groups |
| **Employee** | ✅ | ✅ Own only | ✅ Own (cancel) | ❌ | Can file and cancel own requests |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can file OT requests)
- ✅ **READ:** All OT requests (HR sees everything, bypasses group filtering)
- ✅ **UPDATE:** All OT requests (can approve/reject as HR)
- ❌ **DELETE:** No

**Special Note:** Even though April is assigned as Approver to "HR COMPENSATION & BENEFITS" group, as HR she bypasses group filtering and sees ALL OT requests.

---

### 4. Failure to Log (`failure_to_log`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ❌ | Can approve/reject all |
| **HR** | ✅ | ✅ All | ✅ All | ❌ | Can approve/reject all (HR sees everything) |
| **Approver** | ✅ | ✅ Assigned only | ✅ Assigned only | ❌ | Can approve/reject for assigned groups |
| **Viewer** | ✅ | ✅ Assigned only | ❌ | ❌ | View-only for assigned groups |
| **Employee** | ✅ | ✅ Own only | ✅ Own (cancel pending) | ❌ | Can file and cancel own requests |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can file failure to log requests)
- ✅ **READ:** All failure to log requests (HR sees everything)
- ✅ **UPDATE:** All failure to log requests (can approve/reject as HR)
- ❌ **DELETE:** No

---

### 5. Payslips (`payslips`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full access, can approve |
| **HR** | ✅ | ✅ All* | ✅ All* | ✅ | *If `can_access_salary = true` |
| **Approver** | ❌ | ❌ | ❌ | ❌ | No access |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | No access |
| **Employee** | ❌ | ✅ Own only | ❌ | ❌ | Via employee portal |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can generate payslips)
- ✅ **READ:** All payslips (has `can_access_salary = true`)
- ✅ **UPDATE:** All payslips (can modify payslip data)
- ✅ **DELETE:** Yes (HR can delete payslips)
- ❌ **APPROVE:** No (only Admin can approve payslips - change status)

**Note:** April can generate, view, update, and delete payslips, but cannot approve them (change status to approved/paid).

---

### 6. Weekly Attendance (`weekly_attendance`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **HR** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Approver** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Viewer** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Employee** | ❌ | ✅ Own only | ❌ | ❌ | View-only via portal |

**April Gammad Access:**
- ✅ **CREATE:** Yes
- ✅ **READ:** All weekly attendance records
- ✅ **UPDATE:** All weekly attendance records
- ✅ **DELETE:** Yes

---

### 7. Time Clock Entries (`time_clock_entries`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **HR** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Approver** | ❌ | ✅ All | ❌ | ❌ | View-only |
| **Viewer** | ❌ | ✅ All | ❌ | ❌ | View-only |
| **Employee** | ✅ | ✅ Own only | ❌ | ❌ | Can clock in/out |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can create time entries)
- ✅ **READ:** All time clock entries
- ✅ **UPDATE:** All time clock entries
- ✅ **DELETE:** Yes

---

### 8. Employee Loans (`employee_loans`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **HR** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Approver** | ❌ | ❌ | ❌ | ❌ | No access |
| **Viewer** | ❌ | ❌ | ❌ | ❌ | No access |
| **Employee** | ❌ | ✅ Own* | ❌ | ❌ | *If `can_access_salary = true` |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can create employee loans)
- ✅ **READ:** All employee loans (HR access)
- ✅ **UPDATE:** All employee loans (HR access)
- ✅ **DELETE:** Yes (HR can delete loans)

---

### 9. Employee Deductions (`employee_deductions`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **HR** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Approver** | ❌ | ✅ All | ❌ | ❌ | View-only |
| **Viewer** | ❌ | ✅ All | ❌ | ❌ | View-only |
| **Employee** | ❌ | ✅ Own* | ❌ | ❌ | *If `can_access_salary = true` |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can create deductions)
- ✅ **READ:** All employee deductions
- ✅ **UPDATE:** All employee deductions
- ✅ **DELETE:** Yes

---

### 10. Employee Week Schedules (`employee_week_schedules`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **HR** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Approver** | ✅ | ✅ All | ✅ All | ✅ | Full access |
| **Viewer** | ❌ | ✅ All | ❌ | ❌ | View-only |
| **Employee** | ✅ | ✅ Own only | ✅ Own only | ❌ | Can manage own schedule |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can create schedules)
- ✅ **READ:** All schedules (HR sees everything)
- ✅ **UPDATE:** All schedules (HR access)
- ✅ **DELETE:** Yes (HR can delete schedules)

---

### 11. Users (`users`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ✅ All | ❌ | Cannot delete (service_role only) |
| **HR** | ❌ | ✅ Active only | ❌ | ❌ | View active users only |
| **Approver** | ❌ | ✅ Active only | ❌ | ❌ | View active users only |
| **Viewer** | ❌ | ✅ Active only | ❌ | ❌ | View active users only |
| **Employee** | ❌ | ❌ | ✅ Own profile pic | ❌ | Can update own profile picture |

**April Gammad Access:**
- ❌ **CREATE:** No (only service_role can create users)
- ✅ **READ:** All active users (authenticated users can view active users)
- ❌ **UPDATE:** No (only Admin can update salary access, users can update own profile)
- ❌ **DELETE:** No (only service_role can delete)

---

### 12. Overtime Documents (`overtime_documents`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ❌ | ❌ | Can view all, create |
| **HR** | ✅ | ✅ All* | ❌ | ❌ | *Can view if approver/admin |
| **Approver** | ✅ | ✅ Assigned only | ❌ | ❌ | Can view for assigned groups |
| **Viewer** | ✅ | ✅ Assigned only | ❌ | ❌ | Can view for assigned groups |
| **Employee** | ✅ | ✅ Own only | ❌ | ❌ | Can upload own documents |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can upload OT documents)
- ✅ **READ:** All OT documents (as HR + Approver)
- ❌ **UPDATE:** No (documents are immutable)
- ❌ **DELETE:** No

---

### 13. Leave Request Documents (`leave_request_documents`)

| Role | CREATE | READ | UPDATE | DELETE | Notes |
|------|--------|------|--------|--------|-------|
| **Admin** | ✅ | ✅ All | ❌ | ❌ | Can view all, create |
| **HR** | ✅ | ✅ All | ❌ | ❌ | Can view all, create |
| **Approver** | ✅ | ✅ Assigned only | ❌ | ❌ | Can view for assigned groups |
| **Viewer** | ✅ | ✅ Assigned only | ❌ | ❌ | Can view for assigned groups |
| **Employee** | ✅ | ✅ Own only | ❌ | ❌ | Can upload own documents |

**April Gammad Access:**
- ✅ **CREATE:** Yes (can upload leave documents)
- ✅ **READ:** All leave documents (HR sees everything)
- ❌ **UPDATE:** No (documents are immutable)
- ❌ **DELETE:** No

---

## Summary: April Gammad's Complete Access

### ✅ Full Access (CREATE, READ, UPDATE, DELETE):
- **Weekly Attendance** - All operations
- **Time Clock Entries** - All operations
- **Employee Loans** - All operations
- **Employee Deductions** - All operations
- **Employee Week Schedules** - All operations
- **Payslips** - All operations (except approve status)

### ✅ Full Access (CREATE, READ, UPDATE):
- **Employees** - Cannot delete
- **Leave Requests** - Can approve/reject all
- **Overtime Requests** - Can approve/reject all
- **Failure to Log** - Can approve/reject all

### ✅ Limited Access:
- **Users** - READ only (active users)
- **Overtime Documents** - CREATE, READ (no UPDATE/DELETE)
- **Leave Request Documents** - CREATE, READ (no UPDATE/DELETE)

### ❌ No Access:
- None (as HR, April has access to all relevant tables)

---

## Key Access Rules for April Gammad

1. **HR Role Override:** As HR, April sees ALL employees and ALL requests, regardless of group assignments
2. **Group Assignment:** As Approver for "HR COMPENSATION & BENEFITS", she can approve requests for that group
3. **Salary Access:** Has `can_access_salary = true`, so can view payslips, loans, deductions
4. **Admin Pages:** Can access Audit Dashboard and BIR Reports (HR privilege)
5. **Approval Powers:** Can approve leaves, OT, and failure-to-log requests (both manager and HR levels)

---

## Comparison: Admin vs HR vs Approver

| Operation | Admin | HR (April) | Approver |
|-----------|-------|------------|----------|
| View all employees | ✅ | ✅ | ❌ (assigned only) |
| View all leave requests | ✅ | ✅ | ❌ (assigned only) |
| View all OT requests | ✅ | ✅ | ❌ (assigned only) |
| Approve payslips | ✅ | ❌ | ❌ |
| Delete employees | ✅ | ❌ | ❌ |
| Delete payslips | ✅ | ✅ | ❌ |
| Access Admin pages | ✅ | ✅ | ❌ |
| Access salary info | ✅ | ✅* | ❌ |
| Approve requests | ✅ | ✅ | ✅ (assigned only) |

*HR requires `can_access_salary = true` (April has this)

---

*Last Updated: January 2025*
*Based on current RLS policies and role configurations*
