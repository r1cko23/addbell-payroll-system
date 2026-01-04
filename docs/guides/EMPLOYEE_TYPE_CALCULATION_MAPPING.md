# Employee Type Calculation Mapping

This document maps each employee type to their specific payroll calculation rules.

---

## 1. Client-Based Employees (Account Supervisors)

### Identification

- `employee_type === "client-based"` OR
- Position includes "ACCOUNT SUPERVISOR" (case-insensitive)

### Calculation Rules Applied

#### Base Pay

- **Basic Salary**: `Regular Hours × Hourly Rate × 1.0`
- **Regular Days**: Standard 1.0x multiplier

#### Regular Overtime (OT)

- **Formula**: Fixed allowance
  - **3-4 hours OT**: ₱500 (fixed)
  - **> 4 hours OT**: ₱500 (still fixed at ₱500)
  - **< 3 hours OT**: ₱0
- **Display**: Other Pay → Regular OT Allowance

#### Night Differential (ND)

- **NO ND** (they have OT allowance already)

#### Holidays & Rest Days

**Regular Hours Pay**:

- **Legal Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Special Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rest Day**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Sunday + Special Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Sunday + Legal Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Display**: Earnings Breakdown Table

**OT Allowance** (for all holiday/rest day types):

- **≥ 8 hours OT**: ₱700
- **≥ 4 hours OT**: ₱350
- **< 4 hours OT**: ₱0
- **Display**: Other Pay → [Holiday/Rest Day Type] OT Allowance

**Night Differential**:

- **NO ND** on any day type

#### "1 Day Before" Rule

- **Applies**: YES (to all employee types)
- Must work day before holiday to get daily rate if not working on holiday
- If worked on holiday itself, get daily rate regardless

---

## 2. Office-Based Supervisory Employees

### Identification

- `employee_type === "office-based"` AND
- Position includes one of:
  - "PAYROLL SUPERVISOR"
  - "ACCOUNT RECEIVABLE SUPERVISOR"
  - "HR OPERATIONS SUPERVISOR"
  - "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT"
  - "HR SUPERVISOR - LABOR RELATIONS"
  - "HR SUPERVISOR - EMPLOYEE ENGAGEMENT"

### Calculation Rules Applied

#### Base Pay

- **Basic Salary**: `Regular Hours × Hourly Rate × 1.0`
- **Regular Days**: Standard 1.0x multiplier

#### Regular Overtime (OT)

- **Formula**: `₱200 (first 2 hours) + ₱100 × (additional hours)`
  - **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
  - **< 2 hours**: ₱0
- **Display**: Other Pay → Regular OT Allowance

#### Night Differential (ND)

- **NO ND** (they have OT allowance already)

#### Holidays & Rest Days

**Regular Hours Pay**:

- **Legal Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Special Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rest Day**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Sunday + Special Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Sunday + Legal Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Display**: Earnings Breakdown Table

**OT Allowance** (for all holiday/rest day types):

- **≥ 8 hours OT**: ₱700
- **≥ 4 hours OT**: ₱350
- **< 4 hours OT**: ₱0
- **Display**: Other Pay → [Holiday/Rest Day Type] OT Allowance

**Night Differential**:

- **NO ND** on any day type

#### "1 Day Before" Rule

- **Applies**: YES (to all employee types)
- Must work day before holiday to get daily rate if not working on holiday
- If worked on holiday itself, get daily rate regardless

---

## 3. Office-Based Managerial Employees

### Identification

- `employee_type === "office-based"` AND
- `job_level === "MANAGERIAL"`

### Calculation Rules Applied

#### Base Pay

- **Basic Salary**: `Regular Hours × Hourly Rate × 1.0`
- **Regular Days**: Standard 1.0x multiplier

#### Regular Overtime (OT)

- **Formula**: `₱200 (first 2 hours) + ₱100 × (additional hours)`
  - **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
  - **< 2 hours**: ₱0
- **Display**: Other Pay → Regular OT Allowance

#### Night Differential (ND)

- **NO ND** (they have OT allowance already)

#### Holidays & Rest Days

**Regular Hours Pay**:

- **Legal Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Special Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rest Day**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Sunday + Special Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Sunday + Legal Holiday**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Display**: Earnings Breakdown Table

**OT Allowance** (for all holiday/rest day types):

- **≥ 8 hours OT**: ₱700
- **≥ 4 hours OT**: ₱350
- **< 4 hours OT**: ₱0
- **Display**: Other Pay → [Holiday/Rest Day Type] OT Allowance

**Night Differential**:

- **NO ND** on any day type

#### "1 Day Before" Rule

- **Applies**: YES (to all employee types)
- Must work day before holiday to get daily rate if not working on holiday
- If worked on holiday itself, get daily rate regardless

---

## 4. Office-Based Rank and File Employees

### Identification

- `employee_type === "office-based"` AND
- NOT supervisory (doesn't match supervisory position titles) AND
- NOT managerial (`job_level !== "MANAGERIAL"`)

### Calculation Rules Applied

#### Base Pay

- **Basic Salary**: `Regular Hours × Hourly Rate × 1.0`
- **Regular Days**: Standard 1.0x multiplier

#### Regular Overtime (OT)

- **Formula**: `OT Hours × Hourly Rate × 1.25`
- **Multiplier**: 1.25x
- **Display**: Earnings Breakdown Table → Regular Overtime

#### Night Differential (ND)

- **Formula**: `ND Hours × Hourly Rate × 0.1`
- **Multiplier**: 0.1x (10% of hourly rate)
- **Time Period**: 5PM (17:00) to 6AM (06:00) next day
- **Source**: Calculated from approved OT requests
- **Display**: Earnings Breakdown Table → Night Differential

#### Holidays & Rest Days

**Regular Hours Pay**:

- **Legal Holiday**: `Hours × Rate/Hour × 2.0` (2.0x multiplier)
- **Special Holiday**: `Hours × Rate/Hour × 1.3` (1.3x multiplier)
- **Rest Day**: `Hours × Rate/Hour × 1.3` (1.3x multiplier)
- **Sunday + Special Holiday**: `Hours × Rate/Hour × 1.5` (1.5x multiplier)
- **Sunday + Legal Holiday**: `Hours × Rate/Hour × 2.6` (2.6x multiplier)
- **Display**: Earnings Breakdown Table

**OT Pay**:

- **Legal Holiday OT**: `OT Hours × Rate/Hour × 2.6` (2.0 × 1.3)
- **Special Holiday OT**: `OT Hours × Rate/Hour × 1.69` (1.3 × 1.3)
- **Rest Day OT**: `OT Hours × Rate/Hour × 1.69` (1.3 × 1.3)
- **Sunday + Special Holiday OT**: `OT Hours × Rate/Hour × 1.95` (1.5 × 1.3)
- **Sunday + Legal Holiday OT**: `OT Hours × Rate/Hour × 3.38` (2.6 × 1.3)
- **Display**: Earnings Breakdown Table

**Night Differential**:

- **Legal Holiday ND**: `ND Hours × Rate/Hour × 0.1`
- **Special Holiday ND**: `ND Hours × Rate/Hour × 0.1`
- **Rest Day ND**: `ND Hours × Rate/Hour × 0.1`
- **Sunday + Special Holiday ND**: `ND Hours × Rate/Hour × 0.1`
- **Sunday + Legal Holiday ND**: `ND Hours × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table

#### Regular Night Differential OT (NDOT)

- **Formula**: `min(OT Hours, ND Hours) × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Regular Night Differential OT

#### "1 Day Before" Rule

- **Applies**: YES (to all employee types)
- Must work day before holiday to get daily rate if not working on holiday
- If worked on holiday itself, get daily rate regardless

---

## Summary Table: Calculation Methods by Employee Type

| Component                   | Client-Based                    | Office-Based Supervisory        | Office-Based Managerial         | Office-Based Rank and File           |
| --------------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ------------------------------------ |
| **Regular OT**              | Fixed: ₱500 if ≥3h, ₱0 if <3h   | Fixed: ₱200 + (h-2)×₱100 if ≥2h | Fixed: ₱200 + (h-2)×₱100 if ≥2h | Calculated: Hours × Rate × 1.25      |
| **Night Differential**      | NO ND                           | NO ND                           | NO ND                           | Calculated: Hours × Rate × 0.1       |
| **Legal Holiday Regular**   | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 2.0x                                 |
| **Legal Holiday OT**        | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Calculated: Hours × Rate × 2.6       |
| **Legal Holiday ND**        | NO ND                           | NO ND                           | NO ND                           | Calculated: Hours × Rate × 0.1       |
| **Special Holiday Regular** | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.3x                                 |
| **Special Holiday OT**      | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Calculated: Hours × Rate × 1.69      |
| **Special Holiday ND**      | NO ND                           | NO ND                           | NO ND                           | Calculated: Hours × Rate × 0.1       |
| **Rest Day Regular**        | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.3x                                 |
| **Rest Day OT**             | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Calculated: Hours × Rate × 1.69      |
| **Rest Day ND**             | NO ND                           | NO ND                           | NO ND                           | Calculated: Hours × Rate × 0.1       |
| **Sunday+SH Regular**       | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.5x                                 |
| **Sunday+SH OT**            | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Calculated: Hours × Rate × 1.95      |
| **Sunday+SH ND**            | NO ND                           | NO ND                           | NO ND                           | Calculated: Hours × Rate × 0.1       |
| **Sunday+LH Regular**       | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 1.0x (Daily rate)               | 2.6x                                 |
| **Sunday+LH OT**            | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Fixed: ₱700/₱350/₱0             | Calculated: Hours × Rate × 3.38      |
| **Sunday+LH ND**            | NO ND                           | NO ND                           | NO ND                           | Calculated: Hours × Rate × 0.1       |
| **NDOT**                    | NO NDOT                         | NO NDOT                         | NO NDOT                         | Calculated: min(OT, ND) × Rate × 0.1 |
| **"1 Day Before" Rule**     | YES                             | YES                             | YES                             | YES                                  |
| **Display Location**        | Basic in Table, OT in Other Pay | Basic in Table, OT in Other Pay | Basic in Table, OT in Other Pay | All in Earnings Table                |

**Legend**:

- **Fixed**: Fixed allowance amounts (not calculated by multiplier)
- **Calculated**: Formula-based calculation using multipliers
- **NO ND**: No night differential applies
- **NO NDOT**: No night differential OT applies

---

## Quick Reference: Which Rules Apply to Which Employees

### Fixed Allowances (Not Multipliers)

- ✅ Client-Based (Account Supervisors)
- ✅ Office-Based Supervisory
- ✅ Office-Based Managerial
- ❌ Office-Based Rank and File

### Standard Philippine Labor Code Calculations

- ❌ Client-Based (Account Supervisors)
- ❌ Office-Based Supervisory
- ❌ Office-Based Managerial
- ✅ Office-Based Rank and File

### Night Differential

- ❌ Client-Based (Account Supervisors)
- ❌ Office-Based Supervisory
- ❌ Office-Based Managerial
- ✅ Office-Based Rank and File

### "1 Day Before" Rule

- ✅ Client-Based (Account Supervisors)
- ✅ Office-Based Supervisory
- ✅ Office-Based Managerial
- ✅ Office-Based Rank and File

### Daily Rate (1.0x) on Holidays/Rest Days

- ✅ Client-Based (Account Supervisors)
- ✅ Office-Based Supervisory
- ✅ Office-Based Managerial
- ❌ Office-Based Rank and File (uses multipliers: 2.0x, 1.3x, etc.)
