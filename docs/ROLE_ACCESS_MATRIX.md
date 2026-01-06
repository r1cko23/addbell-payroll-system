# Role-Based Access Control Matrix

## Overview

This document outlines all pages, functionalities, and access permissions for each user role in the Green Pasture HRIS system.

**Roles:**

- **Admin** - Full system access with executive-level privileges
- **HR** - Human Resources staff with management capabilities
- **Account Manager** - Department managers with limited approval and viewing rights
- **OT Approver** - Can approve/reject OT requests for assigned employee groups only
- **OT Viewer** - Can view OT requests for assigned employee groups only (read-only)

---

## 📊 Dashboard Pages

### `/dashboard` - Main Dashboard

- **Admin**: ✅ Full access - Shows AdminDashboard with executive metrics
- **HR**: ✅ Full access - Shows HRDashboard with HR metrics
- **Account Manager**: ✅ Full access - Shows HRDashboard

**Features:**

- View system overview and key metrics
- Quick access to common tasks
- Role-specific dashboard views

---

## 👥 People Management

### `/employees` - Employee Directory

- **Admin**: ✅ Full access
  - View all employees
  - Create new employees
  - Edit employee information
  - Delete employees
  - Manage employee schedules
  - Reset employee passwords
- **HR**: ✅ Full access
  - View all employees
  - Create new employees
  - Edit employee information
  - Manage employee schedules
  - Reset employee passwords
  - ⚠️ Cannot delete employees (Admin only)
- **Account Manager**: ❌ No access
  - Cannot access employees page (hidden from navigation)
  - Cannot view employee salary information
  - Can still view schedules via `/schedules` page

**Features:**

- Employee directory with search and filters
- Employee profile management
- Schedule viewing/editing
- Password reset functionality

### `/schedules` - Employee Schedules

- **Admin**: ✅ Full access
- **HR**: ✅ Full access
- **Account Manager**: ✅ Full access
- **Others**: ❌ No access (redirected)

**Features:**

- View and manage employee schedules
- Create/edit schedule entries
- Week-by-week schedule management

### `/payslips` - Payslip Generation

- **Admin**: ✅ Full access
  - Generate payslips
  - View all payslips
  - Save payslips to database
  - Approve payslips (change status to approved/paid)
- **HR**: ✅ Full access
  - Generate payslips
  - View all payslips
  - Save payslips to database
  - ⚠️ Cannot approve payslips (Admin only)
- **Account Manager**: ❌ No access

**Features:**

- Generate payslips for bi-monthly periods
- Calculate earnings and deductions
- Preview and print payslips
- Save payslips to database

---

## ⏰ Time & Attendance

### `/timesheet` - Time Attendance

- **Admin**: ✅ Full access
- **HR**: ✅ Full access
- **Account Manager**: ✅ Full access

**Features:**

- View timesheet entries
- Generate timesheets from clock entries
- View attendance data
- Bi-monthly period management

### `/time-entries` - Time Clock Entries

- **Admin**: ✅ Full access
- **HR**: ✅ Full access
- **Account Manager**: ✅ Full access

**Features:**

- View all time clock entries
- Filter by employee, date, location
- View clock in/out times
- View calculated hours (regular, overtime, night differential)

### `/leave-approval` - Leave Request Approvals

- **Admin**: ✅ Full access
  - View all leave requests
  - Approve/reject leave requests
  - Add approval notes
- **HR**: ✅ Full access
  - View all leave requests
  - Approve/reject leave requests
  - Add approval notes
- **Account Manager**: ✅ Limited access
  - View leave requests for assigned employees
  - Approve/reject leave requests for assigned employees
  - Add approval notes

**Features:**

- View pending leave requests
- Approve/reject requests
- View leave history
- Filter by status, employee, date range

### `/overtime-approval` - Overtime Request Approvals

- **Admin**: ✅ Full access
  - View all overtime requests
  - Approve/reject overtime requests
- **HR**: ❌ No access (hidden from sidebar)
- **Account Manager**: ✅ Full access
  - View overtime requests for assigned employees
  - Approve/reject overtime requests
- **OT Approver**: ✅ Limited access
  - View OT requests for employees in assigned groups only
  - Approve/reject OT requests for assigned groups only
  - Cannot access other pages (restricted access)
- **OT Viewer**: ✅ Read-only access
  - View OT requests for employees in assigned groups only
  - Cannot approve/reject (view only)
  - Cannot access other pages (restricted access)

**Features:**

- View pending overtime requests
- Approve/reject requests (OT Approvers and above)
- View overtime history
- Filter by status, employee, date range
- Group-based access control for OT Approvers/Viewers

### `/failure-to-log-approval` - Failure to Log Approvals

- **Admin**: ✅ Full access
  - View all failure to log requests
  - Approve/reject requests
- **HR**: ❌ No access (hidden from sidebar, redirected if accessed)
- **Account Manager**: ✅ Limited access
  - View requests for assigned employees
  - Approve/reject requests

**Features:**

- View pending failure to log requests
- Approve/reject requests
- View request history

---

## 💰 Payroll & Deductions

### `/deductions` - Employee Deductions

- **Admin**: ✅ Full access
- **HR**: ✅ Full access
- **Account Manager**: ❌ No access

**Features:**

- View employee deductions
- Manage deduction amounts
- Set deductions per bi-monthly period
- View deduction history

---

## ⚙️ Settings & Administration

### `/settings` - System Settings

- **Admin**: ✅ Full access
  - View all users
  - Create new users
  - Edit user information
  - Delete users
  - Change user roles
  - Activate/deactivate users
- **HR**: ✅ Limited access
  - View all users
  - View user information
  - ❌ Cannot create/edit/delete users
  - ❌ Cannot change roles
- **Account Manager**: ❌ No access

**Features:**

- User management
- Role assignment
- User activation/deactivation
- Profile management

---

## 🔐 Authentication Pages

### `/login` - Login Page

- **All Roles**: ✅ Public access
- Redirects to dashboard if already logged in

### `/employee-login` - Employee Portal Login

- **All Roles**: ✅ Public access
- Separate login for employees (not system users)

### `/reset-password` - Password Reset

- **All Roles**: ✅ Public access

---

## 👤 Employee Portal Pages

These pages are accessible via `/employee-portal/*` and use separate authentication:

### `/employee-portal` - Employee Portal Home

- **Employees**: ✅ Access via employee credentials

### `/employee-portal/info` - Employee Information

- **Employees**: ✅ View own information

### `/employee-portal/bundy` - Time Clock

- **Employees**: ✅ Clock in/out

### `/employee-portal/schedule` - View Schedule

- **Employees**: ✅ View own schedule

### `/employee-portal/leave-request` - Request Leave

- **Employees**: ✅ Create leave requests

### `/employee-portal/overtime` - Request Overtime

- **Employees**: ✅ Create overtime requests

### `/employee-portal/failure-to-log` - Failure to Log Request

- **Employees**: ✅ Create failure to log requests

### `/employee-portal/payslips` - View Payslips

- **Employees**: ✅ View own payslips

---

## 📋 API Endpoints Access

### `/api/auth/*` - Authentication APIs

- **All Roles**: ✅ Public access (login/logout)

### `/api/users/*` - User Management APIs

- **Create User** (`/api/users/create`): Admin only
- **Delete User** (`/api/users/delete`): Admin only
- **Update User Status** (`/api/users/update-status`): Admin only

### `/api/timesheet/auto-generate` - Timesheet Generation

- **Admin**: ✅ Full access
- **HR**: ✅ Full access
- **Account Manager**: ❌ No access

---

## 🔒 Database Access (RLS Policies)

### Employees Table

- **View**: All authenticated users
- **Create/Update/Delete**: Admin, HR

### Weekly Attendance Table

- **View**: All authenticated users
- **Create/Update/Delete**: Admin, HR

### Employee Deductions Table

- **View**: All authenticated users
- **Create/Update/Delete**: Admin, HR

### Payslips Table

- **View**: All authenticated users
- **Create/Update**: Admin, HR
- **Approve** (status change): Admin only

### Leave Requests Table

- **View**: All authenticated users (own requests)
- **View All**: Admin, HR, Account Manager (assigned employees)
- **Approve**: Admin, HR, Account Manager (assigned employees)

### Overtime Requests Table

- **View**: All authenticated users (own requests)
- **View All**: Admin, Account Manager (all), OT Approver/Viewer (assigned groups only)
- **Approve**: Admin, Account Manager (all), OT Approver (assigned groups only)

### Failure to Log Table

- **View**: All authenticated users (own requests)
- **View All**: Admin, Account Manager (assigned employees)
- **Approve**: Admin, Account Manager (assigned employees)

### Holidays Table

- **View**: All authenticated users
- **Create/Update/Delete**: Admin only

### Users Table

- **View**: All authenticated users (active users only)
- **Create/Update/Delete**: Admin only

### Time Clock Entries Table

- **View**: All authenticated users
- **Create/Update/Delete**: Admin, HR

---

## 📝 Summary by Role

### Admin Role

**Full System Access:**

- ✅ All dashboard pages
- ✅ All employee management
- ✅ All time & attendance features
- ✅ All approval workflows
- ✅ Payslip generation and approval
- ✅ User management
- ✅ System settings
- ✅ Holiday management

**Unique Privileges:**

- Can approve payslips (change status to approved/paid)
- Can delete employees
- Can manage users (create/edit/delete)
- Can manage holidays
- Can see Admin Dashboard with executive metrics

### HR Role

**Management Access:**

- ✅ All dashboard pages
- ✅ Employee management (except delete)
- ✅ All time & attendance features
- ✅ Leave request approvals
- ✅ Payslip generation (cannot approve)
- ✅ View users (cannot manage)
- ❌ Overtime approvals (hidden)
- ❌ Failure to log approvals (hidden)
- ❌ User management
- ❌ Holiday management

**Unique Privileges:**

- Can generate and save payslips
- Can manage employee schedules
- Can approve leave requests
- Cannot approve payslips (Admin only)

### Account Manager Role

**Limited Management Access:**

- ✅ Dashboard
- ❌ Employees page (hidden - cannot view salary information)
- ✅ View schedules (via `/schedules` page)
- ✅ Time attendance viewing
- ✅ Leave approvals (assigned employees only)
- ✅ Overtime approvals (assigned employees only)
- ✅ Failure to log approvals (assigned employees only)
- ❌ Employee management (create/edit/delete)
- ❌ Payslip generation
- ❌ User management
- ❌ Settings access

**Unique Privileges:**

- Can approve requests for assigned employees only
- Can view time entries and attendance
- Cannot manage employees or payroll

### OT Approver Role

**Restricted Access (OT Approvals Only):**

- ✅ OT Approvals page (assigned groups only)
- ❌ All other pages (redirected to OT approvals)
- ✅ Approve/reject OT requests for assigned groups
- ✅ View OT requests for assigned groups
- ❌ Cannot view other groups' OT requests
- ❌ Cannot access dashboard, employees, payslips, etc.

**Unique Privileges:**

- Can approve/reject OT requests for employees in assigned overtime groups
- Group-based access control (e.g., Hotel, Non-Hotel, GP Heads, etc.)
- Restricted to OT approval functionality only

### OT Viewer Role

**Restricted Access (OT Viewing Only):**

- ✅ OT Approvals page (assigned groups only, read-only)
- ❌ All other pages (redirected to OT approvals)
- ✅ View OT requests for assigned groups
- ❌ Cannot approve/reject OT requests
- ❌ Cannot view other groups' OT requests
- ❌ Cannot access dashboard, employees, payslips, etc.

**Unique Privileges:**

- Can view OT requests for employees in assigned overtime groups
- Group-based access control (e.g., Hotel, Non-Hotel, GP Heads, etc.)
- Read-only access to OT approval functionality

---

## 🚫 Restricted Pages

### Pages Not Accessible to Any Role (via normal navigation):

- `/clock` - Time clock page (likely employee portal feature)
- `/activity` - Activity log (if exists)

---

## 📌 Notes

1. **Sidebar Navigation**: HR users see a filtered sidebar that hides "OT Approvals" and "Failure to Log" menu items
2. **Middleware Protection**: All dashboard pages require authentication
3. **RLS Policies**: Database-level security enforces role-based access
4. **Employee Portal**: Separate authentication system for employees
5. **Payslip Approval**: Only Admin can change payslip status from draft to approved/paid
6. **User Management**: Only Admin can create/edit/delete system users

---

## 🔄 Access Control Implementation

- **Frontend**: Role checks using `useUserRole()` hook
- **Backend**: API route role validation
- **Database**: Row Level Security (RLS) policies
- **Middleware**: Session-based route protection

---

_Last Updated: December 2025_
