# Improved RBAC Matrix for OT Approvals
## Green Pasture HRIS - Overtime Approval System

**Last Updated:** January 2025

---

## 📋 Executive Summary

This document outlines an improved Role-Based Access Control (RBAC) matrix for the Overtime (OT) approval system, addressing the current challenges with mixed approvers in groups and employee-specific assignments.

### Current Challenges

1. **Mixed Approvers in Groups**: Some groups (e.g., GP HEADS) have employees with different approvers
2. **Employee-Specific Overrides**: Individual employees can have different approvers than their group
3. **Inconsistent Assignment**: Some groups have consistent approvers, others don't
4. **Scalability**: Current system needs better organization as company grows

---

## 🎯 Proposed RBAC Hierarchy

### Priority Order (Highest to Lowest)

```
1. Employee-Specific Approver/Viewer (Highest Priority)
   ↓
2. Group-Based Approver/Viewer (Fallback)
   ↓
3. Department/Position-Based Approver (Future Enhancement)
   ↓
4. Default Approver (Admin/HR) (Last Resort)
```

### Current Implementation

✅ **Implemented:**
- Employee-specific approvers (`employees.overtime_approver_id`)
- Group-based approvers (`overtime_groups.approver_id`)
- Employee-specific viewers (`employees.overtime_viewer_id`)
- Group-based viewers (`overtime_groups.viewer_id`)

⚠️ **Needs Improvement:**
- Mixed approvers within groups (e.g., GP HEADS)
- No delegation/backup approver system
- No approval chain/hierarchy

---

## 📊 Current OT Approver Distribution

### By Assignment Type

| Assignment Type | Employee Count | Approver Distribution |
|----------------|----------------|----------------------|
| **Employee-Specific** | 49 | 10 different approvers |
| **Group-Based** | 0 | N/A (all have employee-specific) |
| **No Approver** | 9 | Needs assignment |

### By Approver

| Approver | Employee Count | Groups Covered |
|----------|----------------|----------------|
| **Michelle Razal** (michrazal@greenpasture.ph) | 11 | ACCOUNT SUPERVISOR FOR HOTEL |
| **Michael Magbag** (mjmagbag@greenpasture.ph) | 8 | ACCOUNT SUPERVISOR FOR HOTEL (subset) |
| **Regine Macabenta** (rmacabenta@greenpasture.ph) | 7 | RECRUITMENT |
| **Shyna Aya-Ay** (scaya-ay@greenpasture.ph) | 5 | HR & ADMIN (subset) |
| **Lea Valdez** (llvaldez@greenpasture.ph) | 5 | HR & ADMIN (subset) |
| **Mike Razal** (mgrazal@greenpasture.ph) | 4 | GP HEADS (subset) |
| **Jon Alfeche** (jonalfeche@greenpasture.ph) | 3 | GP HEADS (subset) |
| **Raquel Razal** (rarazal@greenpasture.ph) | 3 | HR & ADMIN (subset) |
| **April Nina Gammad** (anngammad@greenpasture.ph) | 2 | HR & ADMIN (subset) |
| **Cherryl Reyes** (cgpagulong@greenpasture.ph) | 1 | HR & ADMIN (subset) |

### GP HEADS Group Analysis

| Employee | Position | Approver | Notes |
|----------|----------|----------|-------|
| ANDRES A. ALFECHE II | BD & OPERATIONS MANAGER | Mike Razal | ✅ Employee-specific |
| MICHAEL J. MAGBAG | ACCOUNT MANAGER | Jon Alfeche | ✅ Employee-specific |
| CHERRYL GRACE P. REYES | BILLING & COLLECTION SUPERVISOR | Jon Alfeche | ✅ Employee-specific |

**Observation:** GP HEADS has mixed approvers (Mike Razal and Jon Alfeche), which is correctly handled by employee-specific assignments.

---

## 🔐 Improved RBAC Matrix

### Role Definitions

| Role | Description | OT Approval Scope |
|------|-------------|-------------------|
| **Admin** | Full system administrator | ✅ All employees (override) |
| **HR** | Human Resources staff | ❌ No OT approval access |
| **Account Manager** | Department managers | ✅ All assigned employees |
| **OT Approver** | Dedicated OT approver | ✅ Assigned employees/groups only |
| **OT Viewer** | Read-only OT access | 👁️ View only (no approval) |

### Access Control Rules

#### 1. Admin Role
```
✅ Can approve/reject ALL OT requests
✅ Can override any approver assignment
✅ Can view all OT requests
✅ Can manage OT group assignments
✅ Can assign employee-specific approvers
```

#### 2. Account Manager Role
```
✅ Can approve/reject OT requests for assigned employees
✅ Can view OT requests for assigned employees
❌ Cannot override employee-specific approvers
❌ Cannot manage OT group assignments
```

#### 3. OT Approver Role
```
✅ Can approve/reject OT requests for:
   - Employees with this user as employee-specific approver
   - Employees in groups where this user is group approver
   - Employees in groups where this user is assigned (if no employee-specific approver)

❌ Cannot approve OT requests for:
   - Employees with different employee-specific approver
   - Employees in groups with different group approver
   - Any employee not explicitly assigned

👁️ Can view OT requests for assigned employees/groups
```

#### 4. OT Viewer Role
```
👁️ Can view OT requests for:
   - Employees with this user as employee-specific viewer
   - Employees in groups where this user is group viewer
   - Employees in groups where this user is assigned (if no employee-specific viewer)

❌ Cannot approve/reject any OT requests
❌ Cannot view OT requests for unassigned employees/groups
```

---

## 🏗️ Recommended RBAC Structure

### Option 1: Hierarchical Approval (Recommended)

```
Level 1: Employee-Specific Approver (Primary)
   ↓ (if unavailable)
Level 2: Group Approver (Fallback)
   ↓ (if unavailable)
Level 3: Department Head (Future)
   ↓ (if unavailable)
Level 4: Admin/HR (Escalation)
```

**Benefits:**
- Clear escalation path
- Handles absences/delegation
- Maintains accountability

### Option 2: Multi-Approver Groups

Allow groups to have multiple approvers:

```sql
-- New table structure
overtime_group_approvers (
  group_id UUID,
  approver_id UUID,
  priority INTEGER, -- 1 = primary, 2 = backup, etc.
  is_active BOOLEAN
)
```

**Benefits:**
- Handles mixed approvers in groups naturally
- Supports backup approvers
- More flexible than single approver per group

### Option 3: Position-Based Approval

Assign approvers based on employee position:

```sql
-- New table structure
position_approvers (
  position_pattern TEXT, -- e.g., "MANAGER", "SUPERVISOR"
  approver_id UUID,
  priority INTEGER
)
```

**Benefits:**
- Automatic assignment for new employees
- Consistent approval structure
- Reduces manual assignment

---

## 📈 Recommended Implementation Strategy

### Phase 1: Current System Enhancement (Immediate)

1. ✅ **Keep employee-specific approvers** (already implemented)
2. ✅ **Keep group-based approvers as fallback** (already implemented)
3. 🔄 **Assign approvers to 9 employees without approvers**
4. 🔄 **Document approval hierarchy clearly**

### Phase 2: Multi-Approver Support (Short-term)

1. Add support for multiple approvers per group
2. Implement backup approver system
3. Add approval delegation feature

### Phase 3: Position-Based Approval (Long-term)

1. Create position-based approval rules
2. Auto-assign approvers for new employees
3. Implement approval chain/hierarchy

---

## 🔍 Current OT Approval Logic

### Approval Check Flow

```sql
-- Pseudocode for OT approval check
FUNCTION can_approve_ot_request(request_id, user_id):
  user_role = get_user_role(user_id)

  IF user_role = 'admin' OR user_role = 'account_manager':
    RETURN TRUE  -- Full access

  IF user_role = 'ot_approver':
    employee = get_employee_for_request(request_id)

    -- Check employee-specific approver (highest priority)
    IF employee.overtime_approver_id = user_id:
      RETURN TRUE

    -- Check group-based approver (fallback)
    group = get_group_for_employee(employee.id)
    IF group.approver_id = user_id:
      RETURN TRUE

    RETURN FALSE  -- Not authorized

  RETURN FALSE  -- Invalid role
```

### View Check Flow

```sql
-- Pseudocode for OT view check
FUNCTION can_view_ot_request(request_id, user_id):
  user_role = get_user_role(user_id)

  IF user_role = 'admin' OR user_role = 'account_manager':
    RETURN TRUE  -- Full access

  IF user_role IN ('ot_approver', 'ot_viewer'):
    employee = get_employee_for_request(request_id)

    -- Check employee-specific approver/viewer
    IF employee.overtime_approver_id = user_id OR
       employee.overtime_viewer_id = user_id:
      RETURN TRUE

    -- Check group-based approver/viewer
    group = get_group_for_employee(employee.id)
    IF group.approver_id = user_id OR group.viewer_id = user_id:
      RETURN TRUE

    RETURN FALSE  -- Not authorized

  RETURN FALSE  -- Invalid role
```

---

## 📋 RBAC Matrix Table

### OT Approval Access Matrix

| Role | Employee-Specific | Group-Based | All Employees | Override |
|------|-------------------|-------------|---------------|----------|
| **Admin** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **HR** | ❌ No | ❌ No | ❌ No | ❌ No |
| **Account Manager** | ✅ Assigned Only | ✅ Assigned Only | ✅ Assigned Only | ❌ No |
| **OT Approver** | ✅ Assigned Only | ✅ Assigned Only | ❌ No | ❌ No |
| **OT Viewer** | 👁️ View Only | 👁️ View Only | ❌ No | ❌ No |

### Page Access Matrix

| Page | Admin | HR | Account Manager | OT Approver | OT Viewer |
|------|-------|----|-----------------|-------------|-----------|
| Dashboard | ✅ | ✅ | ✅ | ❌ | ❌ |
| Employees | ✅ | ✅ | ❌ | ❌ | ❌ |
| OT Approvals | ✅ All | ❌ | ✅ Assigned | ✅ Assigned | 👁️ Assigned |
| Leave Approvals | ✅ All | ✅ All | ✅ Assigned | ❌ | ❌ |
| Payslips | ✅ | ✅ | ❌ | ❌ | ❌ |
| Settings | ✅ | 👁️ View Only | ❌ | ❌ | ❌ |

---

## 🎯 Best Practices

### 1. Assignment Strategy

**For Consistent Groups:**
- Use group-based approvers
- Set approver at group level
- Only override for exceptions

**For Mixed Groups (like GP HEADS):**
- Use employee-specific approvers
- Document why each employee has different approver
- Consider splitting group if pattern emerges

**For New Employees:**
- Assign to appropriate group first
- Set employee-specific approver if needed
- Document assignment reason

### 2. Approval Workflow

1. **Employee submits OT request**
2. **System checks approver hierarchy:**
   - Employee-specific approver → Notify
   - Group approver → Notify
   - Admin → Escalate
3. **Approver reviews and approves/rejects**
4. **System records approval with approver ID**

### 3. Delegation Handling

**Current:** No delegation support

**Recommended:**
- Add "delegated_to" field for temporary assignments
- Add "backup_approver_id" for groups
- Implement approval timeout → auto-escalate

---

## 🔧 Implementation Recommendations

### Immediate Actions

1. ✅ **Document current assignments** (this document)
2. 🔄 **Assign approvers to 9 employees without approvers**
3. 🔄 **Review GP HEADS group** - consider splitting or documenting rationale
4. 🔄 **Create approval workflow documentation**

### Short-term Enhancements

1. Add backup approver support
2. Implement approval delegation
3. Add approval history/audit trail
4. Create approval dashboard for approvers

### Long-term Improvements

1. Position-based auto-assignment
2. Multi-level approval chains
3. Approval analytics/reporting
4. Mobile approval notifications

---

## 📊 Group Assignment Recommendations

### Current Groups and Suggested Structure

| Group Name | Current Approver | Employee Count | Recommendation |
|------------|------------------|----------------|----------------|
| **GP HEADS** | Mixed (Mike Razal, Jon Alfeche) | 3 | ✅ Keep employee-specific (mixed approvers) |
| **ACCOUNT SUPERVISOR FOR HOTEL** | Mixed (Michelle Razal, Michael Magbag) | 19 | ⚠️ Consider splitting by sub-group |
| **HR & ADMIN** | Mixed (5 different approvers) | 22 | ⚠️ Consider splitting by department |
| **RECRUITMENT** | Regine Macabenta | 7 | ✅ Consistent - use group approver |
| **ACCOUNTING** | None | 0 | 🔄 Assign when employees added |

### Suggested Group Splits

**Option A: Split ACCOUNT SUPERVISOR FOR HOTEL**
- ACCOUNT SUPERVISOR FOR HOTEL - TEAM A (Michelle Razal)
- ACCOUNT SUPERVISOR FOR HOTEL - TEAM B (Michael Magbag)

**Option B: Split HR & ADMIN**
- HR OPERATIONS (Lea Valdez)
- HR LABOR RELATIONS (Shyna Aya-Ay)
- ADMIN SUPPORT (Raquel Razal)
- ACCOUNTING (Cherryl Reyes)

---

## ✅ Conclusion

The current RBAC system with **employee-specific approvers taking precedence over group-based approvers** is the correct approach for handling mixed approvers in groups like GP HEADS.

### Key Strengths

✅ Flexible - handles mixed approvers naturally
✅ Scalable - can add employee-specific overrides as needed
✅ Clear hierarchy - employee-specific > group-based
✅ Maintainable - easy to understand and modify

### Areas for Improvement

🔄 Assign approvers to 9 employees without approvers
🔄 Consider splitting groups with many different approvers
🔄 Add backup approver/delegation support
🔄 Document approval rationale for mixed groups

---

## 📝 Notes

- **Employee-Specific Approvers**: 49 employees assigned
- **Group-Based Approvers**: Used as fallback when no employee-specific approver
- **No Approver**: 9 employees need assignment
- **Mixed Groups**: GP HEADS and ACCOUNT SUPERVISOR FOR HOTEL have mixed approvers (correctly handled)

---

_This document should be reviewed quarterly and updated as the organization structure evolves._
