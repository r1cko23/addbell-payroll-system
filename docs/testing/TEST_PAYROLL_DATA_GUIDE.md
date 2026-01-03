# Test Payroll Data Guide - Dec 1-15, 2025

## Overview

This document describes the comprehensive test data created to verify payroll calculation logic across all employee types.

## Test Employees Created

### 1. TEST001 - Juan P. Dela Cruz (Rank and File)

- **Position:** DATA ENCODER
- **Employee Type:** office-based
- **Job Level:** RANK AND FILE
- **Daily Rate:** ₱1,200.00
- **Hourly Rate:** ₱150.00/hour
- **Monthly Rate:** ₱26,400.00
- **OT Calculation:** Standard 1.25x multiplier
- **ND Calculation:** Standard 0.1x multiplier
- **Holiday Pay:** Standard multipliers (2.0x regular, 1.3x special)
- **Display:** All earnings in Earnings Breakdown Table

### 2. TEST002 - Maria R. Santos (Supervisory Client-based)

- **Position:** ACCOUNT SUPERVISOR
- **Employee Type:** client-based
- **Job Level:** SUPERVISORY
- **Daily Rate:** ₱2,000.00
- **Hourly Rate:** ₱250.00/hour
- **Monthly Rate:** ₱44,000.00
- **OT Calculation:** Fixed allowances
  - 3-4 hours OT: ₱500
  - > 4 hours OT: ₱500
  - <3 hours OT: ₱0
- **ND:** NO ND (has OT allowance)
- **Holiday Pay:** Daily rate only (1.0x), no multiplier
- **Holiday OT:** Fixed ₱350 (≥4h), ₱600 (≥8h)
- **Display:** OT items in Other Pay section

### 3. TEST003 - Pedro M. Garcia (Supervisory Office-based)

- **Position:** HR OPERATIONS SUPERVISOR
- **Employee Type:** office-based
- **Job Level:** SUPERVISORY
- **Daily Rate:** ₱1,800.00
- **Hourly Rate:** ₱225.00/hour
- **Monthly Rate:** ₱39,600.00
- **OT Calculation:** ₱200 + ₱100 × (hours - 2)
  - ≥2 hours: ₱200 + (hours - 2) × ₱100
  - <2 hours: ₱0
- **ND:** NO ND (has OT allowance)
- **Holiday Pay:** Daily rate only (1.0x), no multiplier
- **Holiday OT:** Fixed ₱350 (≥4h), ₱600 (≥8h)
- **Display:** OT items in Other Pay section

### 4. TEST004 - Ana L. Reyes (Managerial)

- **Position:** HR MANAGER
- **Employee Type:** office-based
- **Job Level:** MANAGERIAL
- **Daily Rate:** ₱2,500.00
- **Hourly Rate:** ₱312.50/hour
- **Monthly Rate:** ₱55,000.00
- **OT Calculation:** ₱200 + ₱100 × (hours - 2)
  - Same as Supervisory Office-based
- **ND:** NO ND (has OT allowance)
- **Holiday Pay:** Daily rate only (1.0x), no multiplier
- **Holiday OT:** Fixed ₱350 (≥4h), ₱600 (≥8h)
- **Display:** OT items in Other Pay section

### 5. 2025001 - Jericko A. Razal (Account Supervisor - Current Issue)

- **Position:** ACCOUNT SUPERVISOR
- **Employee Type:** office-based
- **Daily Rate:** ₱1,600.00
- **Hourly Rate:** ₱200.00/hour
- **Monthly Rate:** ₱41,600.00

## Time Entries Summary (Dec 1-15, 2025)

### Rest Days (No Work Expected)

- **Dec 1 (Mon)** - Rest day (day_off = true)
- **Dec 7 (Sun)** - Rest day (day_off = true)
- **Dec 14 (Sun)** - Rest day (day_off = true)

### Special Holiday

- **Dec 8 (Mon)** - Feast of the Immaculate Conception (Special Non-Working Day)

### Test Scenarios Covered

#### TEST001 (Rank and File)

- Dec 2: Regular day, 8 hours, no OT
- Dec 3: Regular day, 8 hours + 2 hours OT + 1 hour ND
- Dec 4: Regular day, 8 hours + 4 hours OT (no ND)
- Dec 5: Regular day, 8 hours, no OT
- Dec 6: Half day, 4 hours
- **Dec 8: Special Holiday, 8 hours worked**
- Dec 9: Regular day, 8 hours + 3 hours OT + 2 hours ND
- Dec 10: Regular day, 8 hours, no OT
- Dec 11: Regular day, 8 hours + 1 hour OT
- Dec 13: Half day, 4 hours
- Dec 15: Regular day, 8 hours, no OT

**Expected Calculations:**

- Basic Salary: 11 days × ₱1,200 = ₱13,200
- Special Holiday: 8 hours × ₱150 × 1.3 = ₱1,560
- Regular OT: Various calculations at 1.25x
- ND: Various calculations at 0.1x

#### TEST002 (Client-based Account Supervisor)

- Dec 2: Regular day, 8 hours, no OT
- Dec 3: Regular day, 8 hours + 2 hours OT (should get ₱0 - <3 hours)
- Dec 4: Regular day, 8 hours + 3 hours OT (should get ₱500)
- Dec 5: Regular day, 8 hours + 5 hours OT (should get ₱500)
- Dec 6: Half day, 4 hours
- **Dec 8: Special Holiday, 8 hours + 4 hours OT (should get ₱350 holiday OT allowance)**
- Dec 9: Regular day, 8 hours, no OT
- Dec 10: Regular day, 8 hours + 8 hours OT (should get ₱500)
- Dec 11: Regular day, 8 hours, no OT
- Dec 13: Half day, 4 hours
- Dec 15: Regular day, 8 hours, no OT

**Expected Calculations:**

- Basic Salary: 11 days × ₱2,000 = ₱22,000
- Special Holiday: 8 hours × ₱250 × 1.0 = ₱2,000 (daily rate only)
- Regular OT Allowance: ₱500 (for days with ≥3 hours OT)
- Special Holiday OT Allowance: ₱350 (Dec 8)

#### TEST003 (Supervisory Office-based)

- Dec 2: Regular day, 8 hours, no OT
- Dec 3: Regular day, 8 hours + 1 hour OT (should get ₱0 - <2 hours)
- Dec 4: Regular day, 8 hours + 2 hours OT (should get ₱200)
- Dec 5: Regular day, 8 hours + 3 hours OT (should get ₱300)
- Dec 6: Half day, 4 hours
- **Dec 8: Special Holiday, 8 hours + 2 hours OT (should get ₱200 holiday OT allowance)**
- Dec 9: Regular day, 8 hours + 5 hours OT (should get ₱500)
- Dec 10: Regular day, 8 hours, no OT
- Dec 11: Regular day, 8 hours, no OT
- Dec 13: Half day, 4 hours
- Dec 15: Regular day, 8 hours, no OT

**Expected Calculations:**

- Basic Salary: 11 days × ₱1,800 = ₱19,800
- Special Holiday: 8 hours × ₱225 × 1.0 = ₱1,800 (daily rate only)
- Regular OT Allowance: ₱200 + ₱100 × (hours - 2)
- Special Holiday OT Allowance: ₱200 (Dec 8)

#### TEST004 (Managerial)

- Dec 2: Regular day, 8 hours, no OT
- Dec 3: Regular day, 8 hours + 2 hours OT (should get ₱200)
- Dec 4: Regular day, 8 hours + 4 hours OT (should get ₱400)
- Dec 5: Regular day, 8 hours, no OT
- Dec 6: Half day, 4 hours
- **Dec 8: Special Holiday, 8 hours + 8 hours OT (should get ₱600 holiday OT allowance)**
- Dec 9: Regular day, 8 hours, no OT
- Dec 10: Regular day, 8 hours + 3 hours OT (should get ₱300)
- Dec 11: Regular day, 8 hours, no OT
- Dec 13: Half day, 4 hours
- Dec 15: Regular day, 8 hours, no OT

**Expected Calculations:**

- Basic Salary: 11 days × ₱2,500 = ₱27,500
- Special Holiday: 8 hours × ₱312.50 × 1.0 = ₱2,500 (daily rate only)
- Regular OT Allowance: ₱200 + ₱100 × (hours - 2)
- Special Holiday OT Allowance: ₱600 (Dec 8)

## Verification Checklist

### For Each Test Employee:

- [ ] Basic salary calculation (regular days only)
- [ ] Special holiday pay (Dec 8)
- [ ] Regular OT calculation/allowance
- [ ] Holiday OT calculation/allowance
- [ ] Night differential (Rank and File only)
- [ ] Days Work count (should exclude rest days and holidays)
- [ ] Total earnings breakdown
- [ ] Other Pay section (for supervisory/managerial)

### Specific Issues to Check:

- [ ] **Jericko Razal:** Special Holiday shows 16 hours instead of 9 hours
- [ ] **Jericko Razal:** Rest Day shows 16 hours instead of 0 hours
- [ ] All employees: Rest days (Dec 1, 7, 14) should not have hours if no work
- [ ] All employees: Dec 8 should be classified as `non-working-holiday`, not `sunday-special-holiday`

## How to Use This Test Data

1. **Navigate to Payslips page**
2. **Select each test employee** (TEST001-TEST004 and Jericko)
3. **Select period:** Dec 1-15, 2025
4. **Generate payslip** and verify calculations match expected values
5. **Check Earnings Breakdown** for each employee type
6. **Check Other Pay section** for supervisory/managerial employees
7. **Compare with expected calculations** listed above

## Expected Results Summary

| Employee | Basic Salary | Special Holiday | Regular OT | Holiday OT | Total Expected |
| -------- | ------------ | --------------- | ---------- | ---------- | -------------- |
| TEST001  | ₱13,200      | ₱1,560          | Various    | -          | ~₱15,000+      |
| TEST002  | ₱22,000      | ₱2,000          | ₱1,500     | ₱350       | ~₱25,850       |
| TEST003  | ₱19,800      | ₱1,800          | ₱1,000     | ₱200       | ~₱22,800       |
| TEST004  | ₱27,500      | ₱2,500          | ₱900       | ₱600       | ~₱31,500       |
| Jericko  | ₱17,600      | ₱2,340          | -          | -          | ~₱19,940       |

_Note: Totals are approximate and depend on exact OT/ND calculations_




