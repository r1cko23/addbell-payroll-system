# Jericko Razal - Comprehensive Test Data Scenarios

## Employee Information

- **Name**: Jericko A. Razal
- **Employee ID**: 2025001
- **Database ID**: 00eae364-a755-4846-8d77-b72dfff422f1
- **Position**: ACCOUNT SUPERVISOR
- **Employee Type**: office-based
- **Job Level**: SUPERVISORY
- **Classification**: Office-based Account Supervisor (eligible for allowances)

## Test Periods

1. **Nov 16-30, 2024** (Period 1)
2. **Dec 1-15, 2024** (Period 2)
3. **Dec 16-31, 2024** (Period 3)

## Holidays Created

- **Nov 30**: Bonifacio Day (Legal Holiday)
- **Dec 8**: Special Non-Working Holiday (Sunday)
- **Dec 25**: Special Non-Working Holiday (Christmas)
- **Dec 30**: Rizal Day (Legal Holiday)

---

## Period 1: Nov 16-30, 2024

### Regular Days with OT

**Nov 16**: Regular day with 3h OT

- Regular Hours: 8h
- OT Hours: 3h
- **Expected OT Allowance**: ₱300 (₱200 + (3-2)×₱100)
- **Scenario**: Regular OT allowance calculation

**Nov 17**: Regular day with 5h OT

- Regular Hours: 8h
- OT Hours: 5h
- **Expected OT Allowance**: ₱500 (₱200 + (5-2)×₱100)
- **Scenario**: Regular OT allowance calculation

**Nov 18**: Regular day with 1h OT

- Regular Hours: 8h
- OT Hours: 1h
- **Expected OT Allowance**: ₱0 (<2h threshold)
- **Scenario**: Regular OT below minimum threshold

**Nov 19-28**: Regular days, 8h each, no OT

- Regular Hours: 8h each
- OT Hours: 0h
- **Scenario**: Standard regular days

**Nov 24**: Sunday (Rest Day)

- Regular Hours: 0h
- OT Hours: 0h
- **Scenario**: Rest day, didn't work

### Holiday Scenario

**Nov 29**: Day before holiday (MUST WORK ≥8h)

- Regular Hours: 8h
- OT Hours: 0h
- **Scenario**: Ensures eligibility for Nov 30 holiday

**Nov 30**: Legal Holiday - **Scenario 4** (Worked day before + Worked on holiday)

- Regular Hours: 8h
- OT Hours: 5h
- **Expected Pay**:
  - Daily Rate: ₱1,000 (8h × ₱125 × 1.0)
  - OT Allowance: ₱350 (5h ≥4h threshold)
  - **Total**: ₱1,350
- **Scenario**: Legal Holiday with OT - worked day before and worked on holiday

---

## Period 2: Dec 1-15, 2024

### Regular Days

**Dec 1-6**: Regular days, 8h each, no OT

- Regular Hours: 8h each
- OT Hours: 0h
- **Scenario**: Standard regular days

**Dec 7**: Day before holiday (Sunday + Special Holiday)

- Regular Hours: 8h
- OT Hours: 0h
- **Scenario**: Ensures eligibility for Dec 8 holiday

### Holiday Scenario

**Dec 8**: Sunday + Special Holiday - **Scenario 1** (Worked day before + Didn't work)

- Regular Hours: 0h (didn't work, but eligible)
- OT Hours: 0h
- **Expected Pay**:
  - Daily Rate: ₱1,000 (8h × ₱125 × 1.0) - entitlement because worked Dec 7
- **Scenario**: Eligible for holiday pay even though didn't work on holiday

**Dec 9-14**: Regular days, 8h each, no OT

- Regular Hours: 8h each
- OT Hours: 0h
- **Scenario**: Standard regular days

**Dec 15**: Regular day with 2h OT

- Regular Hours: 8h
- OT Hours: 2h
- **Expected OT Allowance**: ₱200 (exactly 2h threshold)
- **Scenario**: Regular OT at minimum threshold

---

## Period 3: Dec 16-31, 2024

### Regular Days

**Dec 16**: Regular day with 3h OT (Monday - End of week rush)

- Regular Hours: 8h
- OT Hours: 3h
- **Expected OT Allowance**: ₱300 (₱200 + (3-2)×₱100)
- **Reason**: End of week account reconciliation
- **Scenario**: Regular OT allowance calculation

**Dec 17**: Sick Leave (SIL)

- Regular Hours: 8h (paid leave)
- OT Hours: 0h
- **Leave Type**: SIL (Sick Leave)
- **Reason**: Medical appointment
- **Scenario**: Paid leave counts as 8h regular work

**Dec 18**: Regular day with 4h OT (Wednesday - Project deadline)

- Regular Hours: 8h
- OT Hours: 4h
- **Expected OT Allowance**: ₱400 (₱200 + (4-2)×₱100)
- **Reason**: Client report deadline
- **Scenario**: Regular OT allowance calculation

**Dec 19**: Leave Without Pay (LWOP)

- Regular Hours: 0h (unpaid leave)
- OT Hours: 0h
- **Leave Type**: LWOP
- **Reason**: Personal matters
- **Scenario**: Unpaid leave, no hours counted

**Dec 20**: Regular day with 6h OT (Friday - Pre-holiday rush)

- Regular Hours: 8h
- OT Hours: 6h
- **Expected OT Allowance**: ₱600 (₱200 + (6-2)×₱100)
- **Reason**: Pre-Christmas account closing
- **Scenario**: Regular OT allowance calculation

**Dec 21**: Partial day (Late arrival, early departure)

- Regular Hours: 4.5h
- OT Hours: 0h
- **Reason**: Late arrival due to traffic, early departure for personal appointment
- **Scenario**: Partial work day, no OT

**Dec 23**: Regular day with 2h OT (Monday - Year-end prep)

- Regular Hours: 8h
- OT Hours: 2h
- **Expected OT Allowance**: ₱200 (exactly 2h threshold)
- **Reason**: Finalizing year-end reports
- **Scenario**: Regular OT at minimum threshold

**Dec 22**: Sunday (Rest Day)

- Regular Hours: 0h
- OT Hours: 0h
- **Scenario**: Rest day, didn't work

**Dec 24**: Day before holiday (Special Holiday - Christmas)

- Regular Hours: 8h
- OT Hours: 0h
- **Scenario**: Ensures eligibility for Dec 25 holiday

### Holiday Scenarios

**Dec 25**: Special Holiday - **Scenario 4** (Worked day before + Worked on holiday)

- Regular Hours: 8h
- OT Hours: 4h
- **Expected Pay**:
  - Daily Rate: ₱1,000 (8h × ₱125 × 1.0)
  - OT Allowance: ₱350 (4h ≥4h threshold)
  - **Total**: ₱1,350
- **Reason**: Emergency client support
- **Scenario**: Special Holiday with OT - worked day before and worked on holiday

**Dec 26**: Regular day with 5h OT (Thursday - Post-holiday catch-up)

- Regular Hours: 8h
- OT Hours: 5h
- **Expected OT Allowance**: ₱500 (₱200 + (5-2)×₱100)
- **Reason**: Catching up on pending accounts
- **Scenario**: Regular OT allowance calculation

**Dec 27**: Regular day, 8h, no OT

- Regular Hours: 8h
- OT Hours: 0h
- **Scenario**: Standard regular day

**Dec 28**: Absent (No work, no leave)

- Regular Hours: 0h
- OT Hours: 0h
- **Scenario**: Absent without leave - no pay, testing Scenario 3 for Dec 30 (didn't work day before)

**Dec 29**: Day before holiday (Legal Holiday - Rizal Day)

- Regular Hours: 8h
- OT Hours: 0h
- **Scenario**: Ensures eligibility for Dec 30 holiday (even though Dec 28 wasn't worked)

**Dec 30**: Legal Holiday - **Scenario 1** (Worked day before + Didn't work)

- Regular Hours: 0h (didn't work, but eligible)
- OT Hours: 0h
- **Expected Pay**:
  - Daily Rate: ₱1,000 (8h × ₱125 × 1.0) - entitlement because worked Dec 29
- **Scenario**: Eligible for holiday pay even though didn't work on holiday

**Dec 31**: Regular day with 8h OT (New Year's Eve - Year-end closing)

- Regular Hours: 8h
- OT Hours: 8h
- **Expected OT Allowance**: ₱800 (₱200 + (8-2)×₱100)
- **Reason**: Year-end financial closing
- **Scenario**: Maximum regular OT allowance

---

## Summary of Test Scenarios Covered

### Regular OT Scenarios

- ✅ 1h OT: ₱0 (below threshold) - Dec 27
- ✅ 2h OT: ₱200 (minimum threshold) - Dec 15, Dec 23
- ✅ 3h OT: ₱300 - Nov 16, Dec 16
- ✅ 4h OT: ₱400 - Dec 18
- ✅ 5h OT: ₱500 - Nov 17, Dec 26
- ✅ 6h OT: ₱600 - Dec 20
- ✅ 8h OT: ₱800 (maximum tested) - Dec 31

### Holiday Scenarios

- ✅ **Scenario 1**: Worked day before, didn't work on holiday (Dec 8, Dec 30)
  - Expected: Daily rate entitlement (₱1,000)
- ✅ **Scenario 4**: Worked day before, worked on holiday (Nov 30, Dec 25)
  - Expected: Daily rate (₱1,000) + OT allowance (₱350)

### Holiday Types Tested

- ✅ Legal Holiday (Nov 30, Dec 30)
- ✅ Special Holiday (Dec 25)
- ✅ Sunday + Special Holiday (Dec 8)

### OT Allowance Scenarios

- ✅ Regular OT: Various hours (1h, 2h, 3h, 5h, 8h)
- ✅ Holiday/Rest Day OT: 4h OT (₱350), 5h OT (₱350)

### Rest Day Scenarios

- ✅ Sunday: Didn't work (Nov 24, Dec 22)
- ✅ Sunday + Special Holiday: Eligible but didn't work (Dec 8)

### Leave Scenarios

- ✅ Sick Leave (SIL): Dec 17 - Paid 8h
- ✅ Leave Without Pay (LWOP): Dec 19 - Unpaid, 0h
- ✅ Partial Day: Dec 21 - 4.5h worked (late arrival, early departure)
- ✅ Absent: Dec 28 - No leave, 0h (unpaid)

### Employee Deductions

- ✅ Created for Dec 31 (end of month):
  - SSS: ₱500
  - PhilHealth: ₱300
  - Pag-IBIG: ₱100
  - Vale: ₱1,000

---

## Expected Calculations Summary

### Period 1 (Nov 16-30)

- **Basic Salary**: 120h × ₱125 = ₱15,000
- **Regular OT Allowance**: ₱300 + ₱500 + ₱0 = ₱800
- **Legal Holiday Pay**: ₱1,000 (Nov 30)
- **Legal Holiday OT Allowance**: ₱350 (Nov 30)
- **Total Gross**: ₱17,150

### Period 2 (Dec 1-15)

- **Basic Salary**: 112h × ₱125 = ₱14,000
- **Regular OT Allowance**: ₱200 (Dec 15)
- **Sunday + Special Holiday Pay**: ₱1,000 (Dec 8 - entitlement)
- **Total Gross**: ₱15,200

### Period 3 (Dec 16-31)

- **Basic Salary**: 108.5h × ₱125 = ₱13,562.50
  - Regular days: 8h × 11 days = 88h
  - Partial day (Dec 21): 4.5h
  - Sick Leave (Dec 17): 8h (paid)
  - LWOP (Dec 19): 0h (unpaid)
  - Absent (Dec 28): 0h (unpaid)
- **Regular OT Allowance**: ₱300 + ₱400 + ₱600 + ₱200 + ₱500 + ₱800 = ₱2,800
  - Dec 16: ₱300 (3h)
  - Dec 18: ₱400 (4h)
  - Dec 20: ₱600 (6h)
  - Dec 23: ₱200 (2h)
  - Dec 26: ₱500 (5h)
  - Dec 31: ₱800 (8h)
- **Special Holiday Pay**: ₱1,000 (Dec 25)
- **Special Holiday OT Allowance**: ₱350 (Dec 25 - 4h)
- **Legal Holiday Pay**: ₱1,000 (Dec 30 - entitlement)
- **Total Gross**: ₱18,712.50
- **Deductions**: ₱1,900 (SSS + PhilHealth + Pag-IBIG + Vale)
- **Net Pay**: ₱16,812.50

---

## Data Created

- ✅ **4 Holidays**: Nov 30, Dec 8, Dec 25, Dec 30
- ✅ **41 Time Clock Entries**: Covering all days in three periods
- ✅ **7 OT Requests**: For various OT scenarios
- ✅ **3 Weekly Attendance Records**: One for each period with complete attendance_data
- ✅ **4 Employee Deductions**: For end of month (Dec 31)

All test data has been created and is ready for payslip generation and testing!
