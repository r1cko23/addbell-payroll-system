# Addbell Technical Services, Inc. - Roles and Permissions

## Role Structure

This document outlines the role-based access control (RBAC) system tailored to Addbell's organizational structure.

## Role Definitions

### 1. Upper Management (Admin)
**Role Code:** `upper_management` or `admin`
**Description:** Full system access with executive-level privileges

**Key Permissions:**
- ✅ Full access to all system modules
- ✅ User management (create, edit, delete users)
- ✅ Project management (create, edit, delete projects)
- ✅ Payroll approval (approve payslips)
- ✅ Fund request approval (final management approval step)
- ✅ System settings and configuration
- ✅ Audit logs and reports
- ✅ BIR reports access
- ✅ Employee deletion (only role with this permission)

**Accessible Pages:**
- All dashboard pages
- Employee management
- Project management (clients, projects)
- Payroll processing and approval
- Fund request approval (management step)
- System settings
- Audit logs
- Reports and analytics

---

### 2. Operations Manager (Supervisor/Account Manager)
**Role Code:** `operations_manager`
**Description:** Project management oversight, employee supervision, and operational approvals

**Key Permissions:**
- ✅ Project management (view, create, edit projects)
- ✅ Client management (view, create, edit clients)
- ✅ Fund request approval (Project Manager step - first approval)
- ✅ Schedule management (view and edit employee schedules)
- ✅ Leave/Overtime approvals (for assigned employee groups)
- ✅ Failure-to-log approvals (for assigned groups)
- ✅ Project progress tracking
- ✅ Project cost tracking
- ✅ Employee assignment to projects
- ❌ Cannot delete employees
- ❌ Cannot approve payslips
- ❌ Cannot manage users
- ❌ Cannot access system settings

**Accessible Pages:**
- Dashboard (workforce overview)
- Projects (clients, projects, project details)
- Schedules
- Leave approval (for assigned groups)
- Overtime approval (for assigned groups)
- Failure-to-log approval (for assigned groups)
- Fund request approval (Project Manager step)
- Project time entries
- Project costs

**Fund Request Workflow:**
- **Step 1:** Operations Manager approves pending fund requests
- Moves request to "Project Manager Approved" status
- Next step: Purchasing Officer

---

### 3. HR (Human Resources)
**Role Code:** `hr`
**Description:** Human Resources staff with employee management and approval capabilities

**Key Permissions:**
- ✅ Employee management (create, edit employees - cannot delete)
- ✅ Payroll processing (generate payslips, cannot approve)
- ✅ Leave/Overtime approvals (all employees)
- ✅ Failure-to-log approvals (all employees)
- ✅ Schedule management
- ✅ Deduction management
- ✅ Loan management
- ✅ Timesheet management
- ✅ Fund request approval (management step - after Purchasing Officer)
- ❌ Cannot delete employees
- ❌ Cannot approve payslips (Admin/Upper Management only)
- ❌ Cannot manage users
- ❌ Cannot access system settings

**Accessible Pages:**
- Dashboard (HR dashboard)
- Employee directory
- Payroll processing
- Leave approval
- Overtime approval
- Failure-to-log approval
- Schedules
- Deductions
- Loans
- Timesheet
- Fund request approval (Management step)
- Reports (limited)

**Fund Request Workflow:**
- **Step 3:** HR can approve after Purchasing Officer approval
- Moves request to "Management Approved" status
- Can also reject requests

---

### 4. Purchasing Officer
**Role Code:** `purchasing_officer`
**Description:** Fund request approval and procurement management

**Key Permissions:**
- ✅ Fund request approval (Purchasing Officer step - second approval)
- ✅ View fund requests
- ✅ Add supplier bank details during approval
- ✅ Procurement management
- ✅ Vendor/supplier coordination
- ❌ Cannot manage projects directly
- ❌ Cannot manage employees
- ❌ Cannot approve payroll
- ❌ Cannot access system settings

**Accessible Pages:**
- Dashboard (limited view)
- Fund request approval (Purchasing Officer step)
- View projects (read-only for context)

**Fund Request Workflow:**
- **Step 2:** Purchasing Officer approves after Operations Manager
- Moves request from "Project Manager Approved" to "Purchasing Officer Approved"
- Can add supplier bank details
- Next step: Upper Management/HR (final approval)

---

### 5. Employee
**Role Code:** `employee` (via employee portal)
**Description:** Regular employees with access to own data and project assignments

**Key Permissions:**
- ✅ View own profile and information
- ✅ Clock in/out per project
- ✅ View own time entries
- ✅ View assigned projects
- ✅ Submit leave requests
- ✅ Submit overtime requests
- ✅ Submit failure-to-log requests
- ✅ View own payslips
- ✅ View own schedule
- ✅ Create fund requests
- ❌ Cannot view other employees' data
- ❌ Cannot approve requests
- ❌ Cannot access admin/HR pages

**Accessible Pages (Employee Portal):**
- Employee dashboard
- Project clock in/out (per project)
- Leave requests
- Overtime requests
- Failure-to-log requests
- Payslips (own)
- Schedule (own)
- Fund requests (create and view own)

---

## Fund Request Approval Workflow

The fund request workflow follows this sequence:

1. **Employee** → Creates fund request (status: `pending`)
2. **Operations Manager** → Approves (status: `project_manager_approved`)
3. **Purchasing Officer** → Approves and adds supplier bank details (status: `purchasing_officer_approved`)
4. **Upper Management/HR** → Final approval (status: `management_approved`)

Any role in the workflow can reject the request with a reason.

---

## Project Management Permissions

### Clients Management
- **Upper Management:** ✅ Full CRUD
- **Operations Manager:** ✅ Full CRUD
- **HR:** ✅ Full CRUD
- **Purchasing Officer:** ❌ No access
- **Employee:** ❌ No access

### Projects Management
- **Upper Management:** ✅ Full CRUD
- **Operations Manager:** ✅ Full CRUD
- **HR:** ✅ Full CRUD
- **Purchasing Officer:** 👁️ Read-only (for context)
- **Employee:** 👁️ View assigned projects only

### Project Costs
- **Upper Management:** ✅ Full CRUD
- **Operations Manager:** ✅ Full CRUD
- **HR:** ✅ Full CRUD
- **Purchasing Officer:** ❌ No access
- **Employee:** ❌ No access

### Project Time Entries
- **Upper Management:** ✅ View all, manage all
- **Operations Manager:** ✅ View all, manage all
- **HR:** ✅ View all, manage all
- **Purchasing Officer:** ❌ No access
- **Employee:** ✅ Create own, view own

### Project Assignments
- **Upper Management:** ✅ Full CRUD
- **Operations Manager:** ✅ Full CRUD
- **HR:** ✅ Full CRUD
- **Purchasing Officer:** ❌ No access
- **Employee:** 👁️ View own assignments only

---

## Payroll Permissions

### Payslip Generation
- **Upper Management:** ✅ Generate and approve
- **HR:** ✅ Generate (cannot approve)
- **Operations Manager:** ❌ No access
- **Purchasing Officer:** ❌ No access
- **Employee:** 👁️ View own payslips only

### Payslip Approval
- **Upper Management:** ✅ Can approve payslips
- **HR:** ❌ Cannot approve (can only generate)
- **Others:** ❌ No access

---

## Notes

- All roles are stored in the `profiles` table with the `role` column
- Row Level Security (RLS) policies enforce these permissions at the database level
- Role checks are performed both in the UI and in database policies
- The system uses Addbell's organizational structure for role assignments
- Project-based time tracking allows employees to clock in/out per project
- Fund request workflow is integrated with project management

---

## Current Role Distribution (from database)

- **Upper Management:** 4 users
- **Operations Manager:** 3 users
- **HR:** 1 user
- **Purchasing Officer:** 1 user
- **Employees:** Multiple (via employee portal)

---

## Migration Notes

- Roles are preserved from existing database
- All existing profiles and employees are maintained
- RLS policies are configured to match Addbell's role structure
- Fund request workflow uses Operations Manager → Purchasing Officer → Upper Management/HR
