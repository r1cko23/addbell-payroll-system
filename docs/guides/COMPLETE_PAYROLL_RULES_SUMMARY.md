# Complete Payroll Calculation Rules Summary

## Employee Classification

### 1. Client-Based Employees (Account Supervisors)

- **Identification**: `employee_type === "client-based"` OR position includes "ACCOUNT SUPERVISOR"
- **Display**: OT items in **Other Pay** section

### 2. Office-Based Supervisory Employees

- **Identification**: `employee_type === "office-based"` AND position includes:
  - "PAYROLL SUPERVISOR"
  - "ACCOUNT RECEIVABLE SUPERVISOR"
  - "HR OPERATIONS SUPERVISOR"
  - "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT"
  - "HR SUPERVISOR - LABOR RELATIONS"
  - "HR SUPERVISOR - EMPLOYEE ENGAGEMENT"
- **Display**: OT items in **Other Pay** section

### 3. Office-Based Managerial Employees

- **Identification**: `employee_type === "office-based"` AND `job_level === "MANAGERIAL"`
- **Display**: OT items in **Other Pay** section

### 4. Office-Based Rank and File Employees

- **Identification**: `employee_type === "office-based"` AND NOT supervisory AND NOT managerial
- **Display**: All earnings in **Earnings Breakdown Table**

---

## Base Pay (All Employee Types)

### Basic Salary

- **Formula**: `Regular Hours × Hourly Rate`
- **Regular Hours**: 8 hours per day (8AM-5PM)
- **Hourly Rate**: `Daily Rate ÷ 8` or `Monthly Rate ÷ (22 days × 8 hours)`
- **Multiplier**: 1.0x
- **Display**: Earnings Breakdown Table → Basic Salary

---

## Regular Overtime (OT) Calculations

### Client-Based Employees (Account Supervisors)

- **Formula**: Fixed allowance
  - **3-4 hours OT**: ₱500 (fixed)
  - **> 4 hours OT**: ₱500 (still fixed at ₱500)
  - **< 3 hours OT**: ₱0
- **Display**: Other Pay → Regular OT Allowance
- **Examples**:
  - 3 hours OT = ₱500
  - 5 hours OT = ₱500
  - 2 hours OT = ₱0

### Office-Based Supervisory/Managerial Employees

- **Formula**: `₱200 (first 2 hours) + ₱100 × (additional hours)`
  - **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
  - **< 2 hours**: ₱0
- **Display**: Other Pay → Regular OT Allowance
- **Examples**:
  - 2 hours OT = ₱200
  - 3 hours OT = ₱300
  - 5 hours OT = ₱500

### Office-Based Rank and File Employees

- **Formula**: `OT Hours × Hourly Rate × 1.25`
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

- **Formula**: `ND Hours × Hourly Rate × 0.1`
- **Display**: Earnings Breakdown Table → Night Differential
- **Example**: 2 hours × ₱125/hour × 0.1 = ₱25

### Client-Based, Supervisory, and Managerial Employees

- **Night Differential**: **NO ND** (they have OT allowance already)

---

## Holiday & Rest Day Calculations

### "1 Day Before" Rule (Policy)

**For Supervisory/Managerial Employees Only**:

- If an employee plans to **NOT work on a holiday**, they **must work the day before the holiday** to be eligible for the daily rate on that holiday.
- **Application**: Legal Holidays and Special Holidays
- **Validation**: Employee must have worked (regularHours ≥ 8) on the day immediately preceding the holiday.

**Note**: This rule does NOT apply to Rank and File employees.

---

### Regular Holiday (Legal Holiday)

#### Regular Hours Pay

| Employee Type                    | Formula                       | Multiplier | Display                                   |
| -------------------------------- | ----------------------------- | ---------- | ----------------------------------------- |
| **Supervisory/Managerial** | `Hours × Rate/Hour × 1.0` | 1.0x       | Earnings Breakdown Table → Legal Holiday |
| **Rank and File**          | `Hours × Rate/Hour × 2.0` | 2.0x       | Earnings Breakdown Table → Legal Holiday |

**Examples**:

- Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000 (if worked day before)
- Rank and File: 8 hours × ₱125/hour × 2.0 = ₱2,000

#### OT on Regular Holiday

| Employee Type                                 | Formula                                                                                                    | Display                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Rank and File**                       | `OT Hours × Rate/Hour × 2.6`                                                                           | Earnings Breakdown Table → Legal Holiday OT |
| **Client-Based/Supervisory/Managerial** | Fixed allowance:`<br>`• ≥ 8 hours OT: ₱700`<br>`• ≥ 4 hours OT: ₱350`<br>`• < 4 hours OT: ₱0 | Other Pay → Legal Holiday OT Allowance      |

#### ND on Regular Holiday

| Employee Type                                 | Formula                          | Display                                      |
| --------------------------------------------- | -------------------------------- | -------------------------------------------- |
| **Rank and File**                       | `ND Hours × Rate/Hour × 0.1` | Earnings Breakdown Table → Legal Holiday ND |
| **Client-Based/Supervisory/Managerial** | **NO ND**                  | -                                            |

---

### Special Holiday (Non-Working Holiday)

#### Regular Hours Pay

| Employee Type                    | Formula                       | Multiplier | Display                                     |
| -------------------------------- | ----------------------------- | ---------- | ------------------------------------------- |
| **Supervisory/Managerial** | `Hours × Rate/Hour × 1.0` | 1.0x       | Earnings Breakdown Table → Special Holiday |
| **Rank and File**          | `Hours × Rate/Hour × 1.3` | 1.3x       | Earnings Breakdown Table → Special Holiday |

**Examples**:

- Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000 (if worked day before)
- Rank and File: 8 hours × ₱125/hour × 1.3 = ₱1,300

#### OT on Special Holiday

| Employee Type                                 | Formula                                                                                                    | Display                                        |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| **Rank and File**                       | `OT Hours × Rate/Hour × 1.69`                                                                          | Earnings Breakdown Table → Special Holiday OT |
| **Client-Based/Supervisory/Managerial** | Fixed allowance:`<br>`• ≥ 8 hours OT: ₱700`<br>`• ≥ 4 hours OT: ₱350`<br>`• < 4 hours OT: ₱0 | Other Pay → Special Holiday OT Allowance      |

#### ND on Special Holiday

| Employee Type                                 | Formula                          | Display                                        |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| **Rank and File**                       | `ND Hours × Rate/Hour × 0.1` | Earnings Breakdown Table → Special Holiday ND |
| **Client-Based/Supervisory/Managerial** | **NO ND**                  | -                                              |

---

### Rest Day (Sunday or Scheduled Rest Day)

**Rest Day Detection**: `day_off: true` in employee schedule OR is Sunday

#### Regular Hours Pay

| Employee Type                    | Formula                       | Multiplier | Display                              |
| -------------------------------- | ----------------------------- | ---------- | ------------------------------------ |
| **Supervisory/Managerial** | `Hours × Rate/Hour × 1.0` | 1.0x       | Earnings Breakdown Table → Rest Day |
| **Rank and File**          | `Hours × Rate/Hour × 1.3` | 1.3x       | Earnings Breakdown Table → Rest Day |

**Examples**:

- Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000
- Rank and File: 8 hours × ₱125/hour × 1.3 = ₱1,300

#### OT on Rest Day

| Employee Type                                 | Formula                                                                                                    | Display                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Rank and File**                       | `OT Hours × Rate/Hour × 1.69`                                                                          | Earnings Breakdown Table → Rest Day OT |
| **Client-Based/Supervisory/Managerial** | Fixed allowance:`<br>`• ≥ 8 hours OT: ₱700`<br>`• ≥ 4 hours OT: ₱350`<br>`• < 4 hours OT: ₱0 | Other Pay → Rest Day OT Allowance      |

#### ND on Rest Day

| Employee Type                                 | Formula                          | Display                                 |
| --------------------------------------------- | -------------------------------- | --------------------------------------- |
| **Rank and File**                       | `ND Hours × Rate/Hour × 0.1` | Earnings Breakdown Table → Rest Day ND |
| **Client-Based/Supervisory/Managerial** | **NO ND**                  | -                                       |

---

### Sunday + Special Holiday

#### Regular Hours Pay

| Employee Type                    | Formula                       | Multiplier | Display                                     |
| -------------------------------- | ----------------------------- | ---------- | ------------------------------------------- |
| **Supervisory/Managerial** | `Hours × Rate/Hour × 1.0` | 1.0x       | Earnings Breakdown Table → Special Holiday |
| **Rank and File**          | `Hours × Rate/Hour × 1.5` | 1.5x       | Earnings Breakdown Table → Special Holiday |

**Examples**:

- Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000
- Rank and File: 8 hours × ₱125/hour × 1.5 = ₱1,500

#### OT on Sunday + Special Holiday

| Employee Type                                 | Formula                                                                                                    | Display                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Rank and File**                       | `OT Hours × Rate/Hour × 1.95`                                                                          | Earnings Breakdown Table → Special Holiday on Rest Day OT |
| **Client-Based/Supervisory/Managerial** | Fixed allowance:`<br>`• ≥ 8 hours OT: ₱700`<br>`• ≥ 4 hours OT: ₱350`<br>`• < 4 hours OT: ₱0 | Other Pay → Special Holiday on Rest Day OT Allowance      |

#### ND on Sunday + Special Holiday

| Employee Type                                 | Formula                          | Display                                        |
| --------------------------------------------- | -------------------------------- | ---------------------------------------------- |
| **Rank and File**                       | `ND Hours × Rate/Hour × 0.1` | Earnings Breakdown Table → Special Holiday ND |
| **Client-Based/Supervisory/Managerial** | **NO ND**                  | -                                              |

---

### Sunday + Regular Holiday

#### Regular Hours Pay

| Employee Type                    | Formula                       | Multiplier | Display                                   |
| -------------------------------- | ----------------------------- | ---------- | ----------------------------------------- |
| **Supervisory/Managerial** | `Hours × Rate/Hour × 1.0` | 1.0x       | Earnings Breakdown Table → Legal Holiday |
| **Rank and File**          | `Hours × Rate/Hour × 2.6` | 2.6x       | Earnings Breakdown Table → Legal Holiday |

**Examples**:

- Supervisory/Managerial: 8 hours × ₱125/hour × 1.0 = ₱1,000
- Rank and File: 8 hours × ₱125/hour × 2.6 = ₱2,600

#### OT on Sunday + Regular Holiday

| Employee Type                                 | Formula                                                                                                    | Display                                                  |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **Rank and File**                       | `OT Hours × Rate/Hour × 3.38`                                                                          | Earnings Breakdown Table → Legal Holiday on Rest Day OT |
| **Client-Based/Supervisory/Managerial** | Fixed allowance:`<br>`• ≥ 8 hours OT: ₱700`<br>`• ≥ 4 hours OT: ₱350`<br>`• < 4 hours OT: ₱0 | Other Pay → Legal Holiday on Rest Day OT Allowance      |

#### ND on Sunday + Regular Holiday

| Employee Type                                 | Formula                          | Display                                      |
| --------------------------------------------- | -------------------------------- | -------------------------------------------- |
| **Rank and File**                       | `ND Hours × Rate/Hour × 0.1` | Earnings Breakdown Table → Legal Holiday ND |
| **Client-Based/Supervisory/Managerial** | **NO ND**                  | -                                            |

---

## Regular Night Differential OT (NDOT)

**Definition**: Overlap of OT hours and ND hours on regular days

### Office-Based Rank and File Employees

- **Formula**: `min(OT Hours, ND Hours) × Rate/Hour × 0.1`
- **Display**: Earnings Breakdown Table → Regular Night Differential OT
- **Example**: If OT = 3 hours and ND = 2 hours, use 2 hours × ₱125/hour × 0.1 = ₱25

### Client-Based, Supervisory, and Managerial Employees

- **NO NDOT**: They don't have ND (they have OT allowance already)

---

## Summary: Display Locations

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

---

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

**Note**: **NO Night Differential items** (they have OT allowance already)

---

## Complete Multiplier Reference Table

### Rank and File Employees

| Day Type                           | Regular Hours | OT Hours | ND Hours |
| ---------------------------------- | ------------- | -------- | -------- |
| **Regular Day**              | 1.0x          | 1.25x    | 0.1x     |
| **Legal Holiday**            | 2.0x          | 2.6x     | 0.1x     |
| **Special Holiday**          | 1.3x          | 1.69x    | 0.1x     |
| **Rest Day**                 | 1.3x          | 1.69x    | 0.1x     |
| **Sunday + Special Holiday** | 1.5x          | 1.95x    | 0.1x     |
| **Sunday + Legal Holiday**   | 2.6x          | 3.38x    | 0.1x     |

### Supervisory/Managerial Employees

| Day Type                           | Regular Hours | OT Allowance         | ND |
| ---------------------------------- | ------------- | -------------------- | -- |
| **Regular Day**              | 1.0x          | Fixed (see OT rules) | NO |
| **Legal Holiday**            | 1.0x          | Fixed (₱350/₱600)  | NO |
| **Special Holiday**          | 1.0x          | Fixed (₱350/₱600)  | NO |
| **Rest Day**                 | 1.0x          | Fixed (₱350/₱600)  | NO |
| **Sunday + Special Holiday** | 1.0x          | Fixed (₱350/₱600)  | NO |
| **Sunday + Legal Holiday**   | 1.0x          | Fixed (₱350/₱600)  | NO |

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

## Key Rules Summary

### Fixed Allowances (Client-Based, Supervisory, Managerial)

1. **Regular OT**:

   - Client-Based: ₱500 if ≥ 3 hours, ₱0 if < 3 hours
   - Supervisory/Managerial: ₱200 + (hours - 2) × ₱100 if ≥ 2 hours
2. **Holiday/Rest Day OT**:

   - All: ₱700 if ≥ 8 hours, ₱350 if ≥ 4 hours, ₱0 if < 4 hours
   - **NO PRO-RATING**: Must meet exact hour thresholds
3. **Night Differential**:

   - **NO ND** for client-based, supervisory, or managerial employees

### Standard Calculations (Rank and File)

- All components use Philippine Labor Code multipliers
- All displayed in Earnings Breakdown Table
- Calculations are pro-rated (no fixed thresholds)

### Display Location

- **Rank and File**: Earnings Breakdown Table
- **Client-Based/Supervisory/Managerial**: Basic earnings in table, OT in Other Pay section (NO ND)

---

## Important Notes

1. **Night Differential Source**: Always calculated from approved OT requests, NOT from clock entries
2. **No Pro-Rating**: Fixed allowances require exact hour thresholds (4 or 8 hours)
3. **Rest Days for Account Supervisors**: Determined by weekly schedule submission (`day_off: true`)
4. **Leave Days**: Only SIL (Sick Leave) counts as 8 hours regular day; other leaves don't count
5. **Deductions**: Applied monthly, only during 2nd cutoff (day 16+)
6. **Gross Pay Recalculation**: System recalculates from attendance_data if stored value seems incorrect
7. **Employee Type Field**: `employee_type` field determines if employee is "office-based" or "client-based"
8. **Supervisory Identification**: Based on position title matching specific supervisory roles
9. **Managerial Identification**: Based on `job_level` field equal to "MANAGERIAL"
10. **"1 Day Before" Rule**: Applies only to Supervisory/Managerial employees for holiday eligibility






