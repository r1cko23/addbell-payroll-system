# April Gammad - Quick Access Reference

**User:** April Nina Gammad (anngammad@greenpasture.ph)
**Role:** HR
**Can Access Salary:** ✅ Yes
**Group Assignment:** Approver for "HR COMPENSATION & BENEFITS"

---

## Quick Access Summary

### ✅ Can Do Everything:
- View ALL employees, leave requests, OT requests, failure-to-log
- Approve/reject ALL leave requests, OT requests, failure-to-log
- Generate, view, update, delete payslips
- Manage employee loans and deductions
- View and manage weekly attendance
- View and manage time clock entries
- Create and manage employee schedules
- Access Admin pages (Audit Dashboard, BIR Reports)

### ❌ Cannot Do:
- Delete employees (HR restriction)
- Approve payslip status (Admin only)
- Delete users (service_role only)
- Update user salary access (Admin only)

---

## CRUD Operations by Table

| Table | Create | Read | Update | Delete |
|-------|--------|------|--------|--------|
| **Employees** | ✅ | ✅ All | ✅ All | ❌ |
| **Leave Requests** | ✅ | ✅ All | ✅ All | ❌ |
| **Overtime Requests** | ✅ | ✅ All | ✅ All | ❌ |
| **Failure to Log** | ✅ | ✅ All | ✅ All | ❌ |
| **Payslips** | ✅ | ✅ All | ✅ All | ✅ |
| **Weekly Attendance** | ✅ | ✅ All | ✅ All | ✅ |
| **Time Clock Entries** | ✅ | ✅ All | ✅ All | ✅ |
| **Employee Loans** | ✅ | ✅ All | ✅ All | ✅ |
| **Employee Deductions** | ✅ | ✅ All | ✅ All | ✅ |
| **Employee Schedules** | ✅ | ✅ All | ✅ All | ✅ |
| **Users** | ❌ | ✅ Active | ❌ | ❌ |
| **OT Documents** | ✅ | ✅ All | ❌ | ❌ |
| **Leave Documents** | ✅ | ✅ All | ❌ | ❌ |

---

## Special Access Notes

1. **Sees Everything:** As HR, April bypasses group filtering and sees ALL employees/requests
2. **Can Approve:** Can approve at both manager and HR levels for leave requests
3. **Group Approver:** Can approve OT/leave/failure-to-log for "HR COMPENSATION & BENEFITS" group
4. **Salary Access:** Can view payslips, loans, deductions (has `can_access_salary = true`)
5. **Admin Pages:** Can access Audit Dashboard and BIR Reports

---

*See `CRUD_ACCESS_MATRIX.md` for complete details on all roles*