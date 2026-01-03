# Payroll Calculation Rules - Complete Guide

## Employee Types

### 1. Client-Based Employees (Account Supervisors)

- **Identification**: `employee_type === "client-based"` OR position includes "ACCOUNT SUPERVISOR" (case-insensitive)
- **Pay Structure**: Fixed allowances for OT instead of calculated rates
- **Display Location**: OT items shown in **Other Pay** section
- **OT Allowance**:
  - **3-4 hours OT**: ₱500 (fixed, regardless of hours over 4)
  - **> 4 hours OT**: ₱500 (still fixed at ₱500)
  - **< 3 hours OT**: ₱0 (no allowance)
- **Night Differential**: NO ND (they have OT allowance already)
- **Holiday/Rest Day OT**: Fixed allowances (₱350 for ≥4 hours, ₱700 for ≥8 hours)

### 2. Office-Based Supervisory Employees

- **Identification**: `employee_type === "office-based"` AND position includes one of:
  - "PAYROLL SUPERVISOR"
  - "ACCOUNT RECEIVABLE SUPERVISOR"
  - "HR OPERATIONS SUPERVISOR"
  - "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT"
  - "HR SUPERVISOR - LABOR RELATIONS"
  - "HR SUPERVISOR - EMPLOYEE ENGAGEMENT"
- **Pay Structure**: Fixed allowances for OT instead of calculated rates
- **Display Location**: OT items shown in **Other Pay** section
- **OT Allowance**: `₱200 (first 2 hours) + ₱100 × (additional hours)`
  - **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
  - **< 2 hours**: ₱0
- **Night Differential**: NO ND (they have OT allowance already)
- **Holiday/Rest Day OT**: Fixed allowances (₱350 for ≥4 hours, ₱700 for ≥8 hours)

### 3. Office-Based Managerial Employees

- **Identification**: `employee_type === "office-based"` AND `job_level === "MANAGERIAL"`
- **Pay Structure**: Fixed allowances for OT instead of calculated rates
- **Display Location**: OT items shown in **Other Pay** section
- **OT Allowance**: `₱200 (first 2 hours) + ₱100 × (additional hours)`
  - **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
  - **< 2 hours**: ₱0
- **Night Differential**: NO ND (they have OT allowance already)
- **Holiday/Rest Day OT**: Fixed allowances (₱350 for ≥4 hours, ₱700 for ≥8 hours)

### 4. Office-Based Rank and File Employees

- **Identification**: `employee_type === "office-based"` AND NOT supervisory AND NOT managerial
- **Pay Structure**: Standard Philippine Labor Code calculations
- **Display Location**: All earnings shown in **Earnings Breakdown Table**
- **OT Calculation**: `OT Hours × Hourly Rate × 1.25` (standard calculation)
- **Night Differential**: `ND Hours × Hourly Rate × 0.1` (standard calculation)
- **Holiday/Rest Day**: Standard multipliers (2.0x for regular holidays, 1.3x for special holidays/rest days)

---

## Base Pay Components (All Employee Types)

### Basic Salary

**Formula**: `Regular Hours × Hourly Rate`

- **Regular Hours**: 8 hours per day (8AM-5PM)
- **Hourly Rate**: `Daily Rate ÷ 8` or `Monthly Rate ÷ (22 days × 8 hours)`
- **Display**: Earnings Breakdown Table → Basic Salary
- **Same for all employee types**

### Regular Days

- **Multiplier**: 1.0x
- **Formula**: `Hours × Rate/Hour × 1.0`
- **Example**: 8 hours × ₱125/hour = ₱1,000

---

## Regular Overtime (OT) Calculations

### Client-Based Employees (Account Supervisors)

**Formula**: Fixed allowance based on hours worked

- **3-4 hours OT**: ₱500 (fixed, regardless of hours over 4)
- **> 4 hours OT**: ₱500 (still fixed at ₱500)
- **< 3 hours OT**: ₱0 (no allowance)
- **Display**: Other Pay → Regular OT Allowance
- **Example**:
  - 3 hours OT = ₱500
  - 5 hours OT = ₱500 (not ₱625)
  - 2 hours OT = ₱0

### Office-Based Supervisory/Managerial Employees

**Formula**: `₱200 (first 2 hours) + ₱100 × (additional hours)`

- **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
- **< 2 hours**: ₱0
- **Display**: Other Pay → Regular OT Allowance
- **Example**:
  - 2 hours OT = ₱200
  - 3 hours OT = ₱200 + (3-2) × ₱100 = ₱300
  - 5 hours OT = ₱200 + (5-2) × ₱100 = ₱500

### Office-Based Rank and File Employees

**Formula**: `OT Hours × Hourly Rate × 1.25`

- **Multiplier**: 1.25x
- **Display**: Earnings Breakdown Table → Regular Overtime
- **Example**: 2 hours × ₱125/hour × 1.25 = ₱312.50

---

## Night Differential (ND) Calculations

### Night Differential Hours

- **Time Period**: 5PM (17:00) to 6AM (06:00) next day
- **Source**: Calculated from approved OT requests (`start_time` and `end_time`)
- **Multiplier**: 0.1x (10% of hourly rate)

### Office-Based Rank and File Employees

**Formula**: `ND Hours × Hourly Rate × 0.1`

- **Display**: Earnings Breakdown Table → Night Differential
- **Example**: 2 hours × ₱125/hour × 0.1 = ₱25

### Client-Based, Supervisory, and Managerial Employees

- **Night Differential**: NO ND (they have OT allowance already)
- **Reason**: Fixed OT allowances replace the need for separate ND calculations

---

## Holiday & Rest Day Calculations

### "1 Day Before" Rule (Policy)

**For All Employee Types**:

- If an employee plans to **NOT work on a holiday**, they **must work the day before the holiday** to be eligible for the daily rate on that holiday.
- **Purpose**: Ensures employees are present and working before taking holiday time off.
- **Application**: This rule applies to both Legal Holidays and Special Holidays.
- **Validation**: The system checks if the employee worked (had regular hours ≥ 8) on the day immediately preceding the holiday.
- **Exception**: If employee worked on the holiday itself (regularHours > 0), they get the daily rate regardless of the day before.

---

### Regular Holiday (Legal Holiday)

**Regular Hours Pay**:

- **Supervisory/Managerial**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
  - **Condition**: Employee must have worked the day before the holiday (per "1 Day Before" rule)
- **Rank and File**: `Hours × Rate/Hour × 2.0`
- **Display**: Earnings Breakdown Table → Legal Holiday
- **Example**:
  - Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000 (if worked day before)
  - Rank and File: 8 hours × ₱125/hour × 2.0 = ₱2,000

**OT on Regular Holiday**:

- **Rank and File**: `OT Hours × Rate/Hour × 2.0 × 1.3 = OT Hours × Rate/Hour × 2.6`
- **Client-Based/Supervisory/Managerial**: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Display**:
  - Rank and File: Earnings Breakdown Table → Legal Holiday OT
  - Client-Based/Supervisory/Managerial: Other Pay → Legal Holiday OT Allowance

**ND on Regular Holiday**:

- **Rank and File Only**: `ND Hours × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Legal Holiday ND
- **Client-Based/Supervisory/Managerial**: NO ND

### Special Holiday (Non-Working Holiday)

**Regular Hours Pay**:

- **Supervisory/Managerial**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
  - **Condition**: Employee must have worked the day before the holiday (per "1 Day Before" rule)
- **Rank and File**: `Hours × Rate/Hour × 1.3`
- **Display**: Earnings Breakdown Table → Special Holiday
- **Example**:
  - Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000 (if worked day before)
  - Rank and File: 8 hours × ₱125/hour × 1.3 = ₱1,300

**OT on Special Holiday**:

- **Rank and File**: `OT Hours × Rate/Hour × 1.3 × 1.3 = OT Hours × Rate/Hour × 1.69`
- **Client-Based/Supervisory/Managerial**: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Display**:
  - Rank and File: Earnings Breakdown Table → Special Holiday OT
  - Client-Based/Supervisory/Managerial: Other Pay → Special Holiday OT Allowance

**ND on Special Holiday**:

- **Rank and File Only**: `ND Hours × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Special Holiday ND
- **Client-Based/Supervisory/Managerial**: NO ND

### Rest Day (Sunday or Scheduled Rest Day)

**Rest Day Detection**: Determined by `day_off: true` in employee schedule OR is Sunday

**Regular Hours Pay**:

- **Supervisory/Managerial**: `Hours × Rate/Hour × 1.0` (Daily rate only, no multiplier)
- **Rank and File**: `Hours × Rate/Hour × 1.3`
- **Display**: Earnings Breakdown Table → Rest Day
- **Example**:
  - Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000
  - Rank and File: 8 hours × ₱125/hour × 1.3 = ₱1,300

**OT on Rest Day**:

- **Rank and File**: `OT Hours × Rate/Hour × 1.3 × 1.3 = OT Hours × Rate/Hour × 1.69`
- **Client-Based/Supervisory/Managerial**: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Display**:
  - Rank and File: Earnings Breakdown Table → Rest Day OT
  - Client-Based/Supervisory/Managerial: Other Pay → Rest Day OT Allowance

**ND on Rest Day**:

- **Rank and File Only**: `ND Hours × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Rest Day ND
- **Client-Based/Supervisory/Managerial**: NO ND

### Sunday + Special Holiday

**Regular Hours Pay**:

- **Supervisory/Managerial**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rank and File**: `Hours × Rate/Hour × 1.5`
- **Display**: Earnings Breakdown Table → Special Holiday
- **Example**:
  - Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000
  - Rank and File: 8 hours × ₱125/hour × 1.5 = ₱1,500

**OT on Sunday + Special Holiday**:

- **Rank and File**: `OT Hours × Rate/Hour × 1.5 × 1.3 = OT Hours × Rate/Hour × 1.95`
- **Client-Based/Supervisory/Managerial**: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Display**:
  - Rank and File: Earnings Breakdown Table → Special Holiday on Rest Day OT
  - Client-Based/Supervisory/Managerial: Other Pay → Special Holiday on Rest Day OT Allowance

**ND on Sunday + Special Holiday**:

- **Rank and File Only**: `ND Hours × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Special Holiday ND
- **Client-Based/Supervisory/Managerial**: NO ND

### Sunday + Regular Holiday

**Regular Hours Pay**:

- **Supervisory/Managerial**: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rank and File**: `Hours × Rate/Hour × 2.6`
- **Display**: Earnings Breakdown Table → Legal Holiday
- **Example**:
  - Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000
  - Rank and File: 8 hours × ₱125/hour × 2.6 = ₱2,600

**OT on Sunday + Regular Holiday**:

- **Rank and File**: `OT Hours × Rate/Hour × 2.6 × 1.3 = OT Hours × Rate/Hour × 3.38`
- **Client-Based/Supervisory/Managerial**: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Display**:
  - Rank and File: Earnings Breakdown Table → Legal Holiday on Rest Day OT
  - Client-Based/Supervisory/Managerial: Other Pay → Legal Holiday on Rest Day OT Allowance

**ND on Sunday + Regular Holiday**:

- **Rank and File Only**: `ND Hours × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Legal Holiday ND
- **Client-Based/Supervisory/Managerial**: NO ND

---

## Regular Night Differential OT (NDOT)

**Definition**: Overlap of OT hours and ND hours on regular days

### Office-Based Rank and File Employees

**Formula**: `min(OT Hours, ND Hours) × Rate/Hour × 0.1`

- **Display**: Earnings Breakdown Table → Regular Night Differential OT
- **Example**: If OT = 3 hours and ND = 2 hours, use 2 hours × ₱125/hour × 0.1 = ₱25

### Client-Based, Supervisory, and Managerial Employees

- **NO NDOT**: They don't have ND (they have OT allowance already)

---

## Summary: Where Components Appear

### Office-Based Rank and File Employees

**Earnings Breakdown Table**:

- Basic Salary
- Regular Overtime
- Night Differential
- Legal Holiday
- Legal Holiday OT
- Legal Holiday ND
- Special Holiday
- Special Holiday OT
- Special Holiday ND
- Rest Day
- Rest Day OT
- Rest Day ND
- Special Holiday on Rest Day OT
- Legal Holiday on Rest Day OT
- Regular Night Differential OT

**Other Pay**: Empty or minimal (if any adjustments)

### Client-Based, Supervisory, and Managerial Employees

**Earnings Breakdown Table**:

- Basic Salary
- Legal Holiday (regular hours only)
- Special Holiday (regular hours only)
- Rest Day (regular hours only)
- Working Dayoff

**Other Pay Section**:

- Regular OT Allowance
- Legal Holiday OT Allowance
- Special Holiday OT Allowance
- Rest Day OT Allowance
- Special Holiday on Rest Day OT Allowance
- Legal Holiday on Rest Day OT Allowance

**Note**: NO Night Differential items (they have OT allowance already)

---

## Complete Calculation Examples

### Example 1: Office-Based Rank and File Employee

**Employee**: Office-based rank and file employee
**Daily Rate**: ₱1,000
**Hourly Rate**: ₱125

**Day 1 - Regular Day with OT and ND**:

- Regular Hours: 8 hours
- OT Hours: 2 hours
- ND Hours: 1.5 hours (overlap with OT)

**Calculations**:

- Basic: 8 × ₱125 = ₱1,000
- Regular OT: 2 × ₱125 × 1.25 = ₱312.50
- Night Diff: 1.5 × ₱125 × 0.1 = ₱18.75
- NDOT: min(2, 1.5) × ₱125 × 0.1 = ₱18.75
- **Total**: ₱1,350

**Display**: All in Earnings Breakdown Table

---

### Example 2: Client-Based Employee (Account Supervisor)

**Employee**: Account Supervisor (client-based)
**Daily Rate**: ₱1,000
**Hourly Rate**: ₱125

**Day 1 - Regular Day with OT**:

- Regular Hours: 8 hours
- OT Hours: 4 hours
- ND Hours: 0 (no ND for client-based)

**Calculations**:

- Basic: 8 × ₱125 = ₱1,000
- Regular OT Allowance: ₱500 (4 hours = fixed ₱500)
- **Total**: ₱1,500

**Display**:

- Earnings Table: Basic = ₱1,000
- Other Pay: Regular OT Allowance = ₱500

---

### Example 3: Office-Based Supervisory Employee

**Employee**: Payroll Supervisor (office-based supervisory)
**Daily Rate**: ₱1,000
**Hourly Rate**: ₱125

**Day 1 - Regular Day with OT**:

- Regular Hours: 8 hours
- OT Hours: 3 hours
- ND Hours: 0 (no ND for supervisory)

**Calculations**:

- Basic: 8 × ₱125 = ₱1,000
- Regular OT Allowance: ₱200 + (3-2) × ₱100 = ₱300
- **Total**: ₱1,300

**Display**:

- Earnings Table: Basic = ₱1,000
- Other Pay: Regular OT Allowance = ₱300

---

### Example 4: Special Holiday with OT (Supervisory Employee)

**Day Type**: Special Holiday
**Regular Hours**: 8 hours
**OT Hours**: 5 hours

**Calculations**:

- Special Holiday Pay: 8 × ₱125 × 1.3 = ₱1,300
- Special Holiday OT Allowance: ₱700 (5 hours ≥ 4 hours threshold)
- **Total**: ₱2,000

**Display**:

- Earnings Table: Special Holiday = ₱1,300
- Other Pay: Special Holiday OT Allowance = ₱700

---

## Key Rules Summary

### Fixed Allowances (Client-Based, Supervisory, Managerial)

1. **Regular OT**:

   - Client-Based: ₱500 if ≥ 3 hours, ₱0 if < 3 hours
   - Supervisory/Managerial: ₱200 + (hours - 2) × ₱100 if ≥ 2 hours

2. **Holiday/Rest Day OT**:

   - All: ₱700 if ≥ 8 hours, ₱350 if ≥ 4 hours, ₱0 if < 4 hours
   - **NO PRO-RATING**: Must meet exact hour thresholds

3. **Night Differential**:
   - **NO ND** for client-based, supervisory, or managerial employees (they have OT allowance already)

### Standard Calculations (Rank and File)

- All components use Philippine Labor Code multipliers
- All displayed in Earnings Breakdown Table
- Calculations are pro-rated (no fixed thresholds)

### Display Location

- **Rank and File**: Earnings Breakdown Table
- **Client-Based/Supervisory/Managerial**: Basic earnings in table, OT in Other Pay section (NO ND)

---

## Total Salary Calculation

### Office-Based Rank and File Employees

```
Total Salary = Basic Salary
             + Regular OT
             + Night Differential
             + Legal Holiday
             + Legal Holiday OT
             + Legal Holiday ND
             + Special Holiday
             + Special Holiday OT
             + Special Holiday ND
             + Rest Day
             + Rest Day OT
             + Rest Day ND
             + Special Holiday on Rest Day OT
             + Legal Holiday on Rest Day OT
             + Regular NDOT
```

### Client-Based, Supervisory, and Managerial Employees

```
Total Salary = Basic Salary
             + Legal Holiday (regular hours)
             + Special Holiday (regular hours)
             + Rest Day (regular hours)
             + Working Dayoff
             + Other Pay Total

Other Pay Total = Regular OT Allowance
                + Legal Holiday OT Allowance
                + Special Holiday OT Allowance
                + Rest Day OT Allowance
                + Special Holiday on Rest Day OT Allowance
                + Legal Holiday on Rest Day OT Allowance
```

---

## Net Pay Calculation

**Formula**: `Gross Pay - Total Deductions + Allowances`

**Gross Pay** = Total Salary (as calculated above)

**Total Deductions**:

- SSS Contribution (monthly, applied in 2nd cutoff)
- PhilHealth Contribution (monthly, applied in 2nd cutoff)
- Pag-IBIG Contribution (monthly, applied in 2nd cutoff)
- Withholding Tax (monthly, applied in 2nd cutoff)
- Loans (SSS, Pag-IBIG, Company, Emergency, Other)
- Vale/Advance payments

**Allowances**: Currently set to ₱0 (removed from system)

---

## Important Notes

1. **Night Differential Source**: Always calculated from approved OT requests, NOT from clock entries
2. **No Pro-Rating**: Fixed allowances require exact hour thresholds (4 or 8 hours)
3. **Rest Days for Account Supervisors**: Determined by weekly schedule submission (`day_off: true`)
4. **Leave Days**: Only SIL (Sick Leave) counts as 8 hours regular day; other leaves don't count
5. **Deductions**: Applied monthly, only during 2nd cutoff (day 16+)
6. **Gross Pay Recalculation**: System recalculates from attendance_data if stored value seems incorrect
7. **Employee Type Field**: New `employee_type` field determines if employee is "office-based" or "client-based"
8. **Supervisory Identification**: Based on position title matching specific supervisory roles
9. **Managerial Identification**: Based on `job_level` field equal to "MANAGERIAL"