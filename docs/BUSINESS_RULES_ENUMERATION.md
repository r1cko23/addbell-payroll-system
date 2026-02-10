# Complete Business Rules Enumeration for Time Attendance and Payslip Generation

## Date: January 2026

This document enumerates ALL business rules for time attendance and payslip generation systems.

---

## 1. TIME ATTENDANCE RULES

### 1.1 Time Clock Entry Rules

#### 1.1.1 Clock In Rules
- **Rule 1.1.1.1**: Employee must be active (`is_active = true`) to clock in
- **Rule 1.1.1.2**: Employee cannot clock in on rest days (enforced by `is_rest_day_today()` function)
- **Rule 1.1.1.3**: Employee cannot clock in twice on the same day (PH timezone)
- **Rule 1.1.1.4**: Previous day's incomplete entries are NOT auto-closed (employee must file failure-to-log request)
- **Rule 1.1.1.5**: Location validation is optional but recommended (if location service is enabled)

#### 1.1.2 Clock Out Rules
- **Rule 1.1.2.1**: Employee must have an active clock-in entry to clock out
- **Rule 1.1.2.2**: Clock out time must be after clock in time
- **Rule 1.1.2.3**: Break time is automatically set to 60 minutes (1 hour) if not specified
- **Rule 1.1.2.4**: Total hours = (clock_out_time - clock_in_time) - break_minutes

#### 1.1.3 Regular Hours Calculation Rules

**For Non-Account Supervisors:**
- **Rule 1.1.3.1**: Only FULL completed 8 hours are recorded as working days
- **Rule 1.1.3.2**: If employee works less than 8 hours: `regular_hours = 0` (doesn't count as working day)
- **Rule 1.1.3.3**: If employee works exactly 8 hours or more: `regular_hours = expected_hours` (capped at expected shift duration)
- **Rule 1.1.3.4**: Expected hours = shift_duration - break_hours (from employee schedule)

**For Account Supervisors:**
- **Rule 1.1.3.5**: Flexi time - as long as they complete 8 hours, that's counted as 1 working day
- **Rule 1.1.3.6**: If `total_hours >= 8`: `regular_hours = 8`
- **Rule 1.1.3.7**: If `total_hours < 8`: `regular_hours = total_hours` (partial credit)

#### 1.1.4 Overtime Hours Rules
- **Rule 1.1.4.1**: OT hours are NOT auto-calculated from clock times
- **Rule 1.1.4.2**: OT hours MUST come from approved `overtime_requests` table
- **Rule 1.1.4.3**: Only OT requests with `status = 'approved'` are counted
- **Rule 1.1.4.4**: OT hours are aggregated by date (multiple OT requests per day are summed)

#### 1.1.5 Night Differential Hours Rules
- **Rule 1.1.5.1**: ND hours are NOT calculated from clock entries for payslip
- **Rule 1.1.5.2**: ND hours MUST come from approved OT requests (calculated from `start_time` and `end_time`)
- **Rule 1.1.5.3**: ND time period: 5PM (17:00) to 6AM (06:00) next day
- **Rule 1.1.5.4**: ND hours are capped at total OT hours (cannot exceed OT hours)
- **Rule 1.1.5.5**: For timesheet display: ND comes from clock entries (`total_night_diff_hours`)
- **Rule 1.1.5.6**: For payslip calculation: ND comes from approved OT requests only

#### 1.1.6 Entry Status Rules
- **Rule 1.1.6.1**: Valid statuses: `clocked_in`, `clocked_out`, `approved`, `auto_approved`, `rejected`
- **Rule 1.1.6.2**: Only entries with status `approved`, `auto_approved`, or `clocked_out` are counted in payslip
- **Rule 1.1.6.3**: Auto-approved entries are created when employee clocks out normally

---

### 1.2 Days Work Calculation Rules

#### 1.2.1 Regular Work Days (Mon-Sat)
- **Rule 1.2.1.1**: Date must be today or earlier (not future dates)
- **Rule 1.2.1.2**: Employee must have completed logging (both `clock_in_time` AND `clock_out_time` exist)
- **Rule 1.2.1.3**: `BH > 0` (from actual work)
- **Rule 1.2.1.4**: Saturday is a regular work day (paid 6 days/week per Philippine labor law)
- **Rule 1.2.1.5**: Saturday gets 8 BH automatically even if not worked

#### 1.2.2 Eligible Holidays
- **Rule 1.2.2.1**: Date must be today or earlier
- **Rule 1.2.2.2**: `BH > 0` (eligible holidays get 8 BH even without clock entries)
- **Rule 1.2.2.3**: Employee worked a regular working day before (1 Day Before rule)
- **Rule 1.2.2.4**: If employee worked on holiday itself (`regularHours > 0`): Gets daily rate regardless

#### 1.2.3 Excluded Days
- **Rule 1.2.3.1**: Sundays (rest days - paid separately)
- **Rule 1.2.3.2**: Future dates
- **Rule 1.2.3.3**: Non-working leave types (LWOP, CTO, OB)
- **Rule 1.2.3.4**: Days without completed logging (for regular days)

#### 1.2.4 Formula
```
Days Work = Total BH / 8 (fractional days)
```

---

### 1.3 Leave Rules

#### 1.3.1 Leave Types
- **Rule 1.3.1.1**: **SIL (Sick Leave)**: Counts as 8 hours, regular working day
- **Rule 1.3.1.2**: **All other leaves** (LWOP, CTO, OB, etc.): Do NOT count as working days (0 hours)
- **Rule 1.3.1.3**: Only approved leaves (`approved_by_manager` or `approved_by_hr`) are counted
- **Rule 1.3.1.4**: If multiple leaves exist on same date, SIL takes priority

---

### 1.4 Holiday Eligibility Rules ("1 Day Before" Rule)

#### 1.4.1 General Rule
- **Rule 1.4.1.1**: Employee is eligible for holiday pay if:
  - They worked on the holiday itself (`regularHours > 0`): Gets daily rate regardless
  - OR they didn't work on the holiday BUT worked a regular working day before

#### 1.4.2 Day Before Validation
- **Rule 1.4.2.1**: System searches up to 7 days back
- **Rule 1.4.2.2**: Skips holidays and rest days
- **Rule 1.4.2.3**: Finds a regular working day (`dayType === "regular"`) with `regularHours >= 8`
- **Rule 1.4.2.4**: If found: Gets 8 hours (daily rate) even if didn't work on holiday

#### 1.4.3 Application
- **Rule 1.4.3.1**: Applies to both Legal Holidays and Special Holidays
- **Rule 1.4.3.2**: Applies to ALL employee types (Rank and File, Supervisory, Managerial)
- **Rule 1.4.3.3**: Exception: If employee worked on holiday itself, rule doesn't apply

#### 1.4.4 Special Cases
- **Rule 1.4.4.1**: January 1, 2026: All employees get 8 BH (employees started using system on January 6, 2026)
- **Rule 1.4.4.2**: Consecutive holidays: If previous holiday was eligible, current holiday is also eligible

---

### 1.5 Rest Day Rules

#### 1.5.1 Office-Based Employees
- **Rule 1.5.1.1**: Sunday is the designated rest day
- **Rule 1.5.1.2**: Rest days get premium pay (1.3x rate for Rank and File, 1.0x for Supervisory/Managerial)

#### 1.5.2 Client-Based Account Supervisors
- **Rule 1.5.2.1**: Rest days can only be Monday, Tuesday, or Wednesday (enforced in schedule validation)
- **Rule 1.5.2.2**: Rest days are determined by `day_off: true` in weekly schedule submission
- **Rule 1.5.2.3**: Schedules are submitted weekly through employee portal (`/employee-portal/schedule`)
- **Rule 1.5.2.4**: Schedules are locked after Monday (can't edit past Monday)

**First Rest Day (Chronologically):**
- **Rule 1.5.2.5**: ACTUAL REST DAY
- **Rule 1.5.2.6**: Only paid if worked (`regularHours > 0`)
- **Rule 1.5.2.7**: If worked: Daily rate (`hours × rate/hour × 1.0`) + allowance (if ≥4 hours)
- **Rule 1.5.2.8**: If not worked: No pay

**Second Rest Day:**
- **Rule 1.5.2.9**: REGULAR WORKDAY (like Mon-Sat for office-based)
- **Rule 1.5.2.10**: Gets 8 BH even if not worked (like Saturday)
- **Rule 1.5.2.11**: Included in Basic Salary
- **Rule 1.5.2.12**: Paid at regular rate (no rest day premium, no allowances)

---

## 2. PAYSLIP GENERATION RULES

### 2.1 Employee Classification Rules

#### 2.1.1 Client-Based Employees (Account Supervisors)
- **Rule 2.1.1.1**: Identification: `employee_type === "client-based"` OR position includes "ACCOUNT SUPERVISOR" (case-insensitive)
- **Rule 2.1.1.2**: Pay Structure: Fixed allowances for OT instead of calculated rates
- **Rule 2.1.1.3**: Display Location: OT items shown in **Other Pay** section
- **Rule 2.1.1.4**: Night Differential: NO ND (they have OT allowance already)

#### 2.1.2 Office-Based Supervisory Employees
- **Rule 2.1.2.1**: Identification: `employee_type === "office-based"` AND position includes one of:
  - "PAYROLL SUPERVISOR"
  - "ACCOUNT RECEIVABLE SUPERVISOR"
  - "HR OPERATIONS SUPERVISOR"
  - "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT"
  - "HR SUPERVISOR - LABOR RELATIONS"
  - "HR SUPERVISOR - EMPLOYEE ENGAGEMENT"
- **Rule 2.1.2.2**: Pay Structure: Fixed allowances for OT instead of calculated rates
- **Rule 2.1.2.3**: Display Location: OT items shown in **Other Pay** section
- **Rule 2.1.2.4**: Night Differential: NO ND (they have OT allowance already)

#### 2.1.3 Office-Based Managerial Employees
- **Rule 2.1.3.1**: Identification: `employee_type === "office-based"` AND `job_level === "MANAGERIAL"`
- **Rule 2.1.3.2**: Pay Structure: Fixed allowances for OT instead of calculated rates
- **Rule 2.1.3.3**: Display Location: OT items shown in **Other Pay** section
- **Rule 2.1.3.4**: Night Differential: NO ND (they have OT allowance already)

#### 2.1.4 Office-Based Rank and File Employees
- **Rule 2.1.4.1**: Identification: `employee_type === "office-based"` AND NOT supervisory AND NOT managerial
- **Rule 2.1.4.2**: Pay Structure: Standard Philippine Labor Code calculations
- **Rule 2.1.4.3**: Display Location: All earnings shown in **Earnings Breakdown Table**
- **Rule 2.1.4.4**: Calculations: Standard multipliers (1.25x OT, 0.1x ND, etc.)

---

### 2.2 Base Pay Calculation Rules

#### 2.2.1 Basic Salary
- **Rule 2.2.1.1**: Formula: `Regular Hours × Hourly Rate`
- **Rule 2.2.1.2**: Regular Hours: 8 hours per day (8AM-5PM)
- **Rule 2.2.1.3**: Hourly Rate: `Daily Rate ÷ 8` or `Monthly Rate ÷ (22 days × 8 hours)`
- **Rule 2.2.1.4**: Multiplier: 1.0x
- **Rule 2.2.1.5**: Display: Earnings Breakdown Table → Basic Salary
- **Rule 2.2.1.6**: Includes: Regular work days (Mon-Sat) that were actually worked
- **Rule 2.2.1.7**: Includes: Saturday even if not worked (8 hours × ratePerHour)
- **Rule 2.2.1.8**: Includes: Account Supervisor's first rest day (if Mon-Fri) if not worked (8 hours × ratePerHour)
- **Rule 2.2.1.9**: Includes: Holidays (if eligible via "1 Day Before" rule) - paid at daily rate (1.0x) in basic salary
  - If employee worked on holiday: Supervisory/Managerial get allowance on top; Rank and File get multiplier applied (see Holiday Pay rules)
  - If employee didn't work but eligible: All employees get daily rate (1.0x) in basic salary
- **Rule 2.2.1.10**: Excludes: Sundays (rest days - paid separately)

---

### 2.3 Overtime Calculation Rules

#### 2.3.1 Client-Based Employees (Account Supervisors)
- **Rule 2.3.1.1**: Formula: Fixed allowance
- **Rule 2.3.1.2**: **3-4 hours OT**: ₱500 (fixed, regardless of hours over 4)
- **Rule 2.3.1.3**: **> 4 hours OT**: ₱500 (still fixed at ₱500)
- **Rule 2.3.1.4**: **< 3 hours OT**: ₱0 (no allowance)
- **Rule 2.3.1.5**: Display: Other Pay → Regular OT Allowance
- **Rule 2.3.1.6**: NO PRO-RATING: Must meet exact hour thresholds

#### 2.3.2 Office-Based Supervisory/Managerial Employees
- **Rule 2.3.2.1**: Formula: `₱200 (first 2 hours) + ₱100 × (additional hours)`
- **Rule 2.3.2.2**: **≥ 2 hours**: ₱200 + (hours - 2) × ₱100
- **Rule 2.3.2.3**: **< 2 hours**: ₱0
- **Rule 2.3.2.4**: Display: Other Pay → Regular OT Allowance
- **Rule 2.3.2.5**: NO PRO-RATING: Must meet exact hour thresholds

#### 2.3.3 Office-Based Rank and File Employees
- **Rule 2.3.3.1**: Formula: `OT Hours × Hourly Rate × 1.25`
- **Rule 2.3.3.2**: Multiplier: 1.25x
- **Rule 2.3.3.3**: Display: Earnings Breakdown Table → Regular Overtime
- **Rule 2.3.3.4**: PRO-RATED: Calculated based on actual hours

#### 2.3.4 Overtime Eligibility
- **Rule 2.3.4.1**: Default: `eligible_for_ot !== false` (defaults to true)
- **Rule 2.3.4.2**: If `eligible_for_ot === false`, OT hours are set to 0

---

### 2.4 Night Differential Calculation Rules

#### 2.4.1 Night Differential Hours
- **Rule 2.4.1.1**: Time Period: 5PM (17:00) to 6AM (06:00) next day
- **Rule 2.4.1.2**: Source: Calculated from approved OT requests (`start_time` and `end_time`)
- **Rule 2.4.1.3**: Multiplier: 0.1x (10% of hourly rate)
- **Rule 2.4.1.4**: ND hours are capped at total OT hours (cannot exceed OT hours)

#### 2.4.2 Office-Based Rank and File Employees
- **Rule 2.4.2.1**: Formula: `ND Hours × Hourly Rate × 0.1`
- **Rule 2.4.2.2**: Display: Earnings Breakdown Table → Night Differential
- **Rule 2.4.2.3**: PRO-RATED: Calculated based on actual hours

#### 2.4.3 Client-Based, Supervisory, and Managerial Employees
- **Rule 2.4.3.1**: Night Differential: **NO ND** (they have OT allowance already)
- **Rule 2.4.3.2**: ND hours are set to 0 even if OT requests have ND

#### 2.4.4 Regular Night Differential OT (NDOT)
- **Rule 2.4.4.1**: Definition: Overlap of OT hours and ND hours on regular days
- **Rule 2.4.4.2**: Formula (Rank and File): `min(OT Hours, ND Hours) × Rate/Hour × 0.1`
- **Rule 2.4.4.3**: Display: Earnings Breakdown Table → Regular Night Differential OT
- **Rule 2.4.4.4**: Client-Based/Supervisory/Managerial: NO NDOT

---

### 2.5 Holiday Pay Calculation Rules

#### 2.5.1 Regular Holiday (Legal Holiday)

**Regular Hours Pay:**
- **Rule 2.5.1.1**: All employees eligible for holiday pay (via "1 Day Before" rule) get daily rate (1.0x) included in Basic Salary
  - If employee DID NOT work on holiday but eligible: Gets 8 hours × Rate/Hour × 1.0 in basic salary
  - If employee WORKED on holiday (time in/out rendered):
    - **Supervisory/Managerial**: Gets daily rate (1.0x) in basic salary + allowance on top (₱350 for ≥4 hours, ₱700 for ≥8 hours)
    - **Rank and File**: Gets multiplier applied: `Hours × Rate/Hour × 2.0` (double pay) instead of 1.0x
- **Rule 2.5.1.2**: Display: Earnings Breakdown Table → Legal Holiday

**OT on Regular Holiday:**
- **Rule 2.5.1.3**: Rank and File: `OT Hours × Rate/Hour × 2.6` (2.0 × 1.3)
- **Rule 2.5.1.4**: Client-Based/Supervisory/Managerial: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Rule 2.5.1.5**: Display: Rank and File → Earnings Breakdown Table → Legal Holiday OT
- **Rule 2.5.1.6**: Display: Client-Based/Supervisory/Managerial → Other Pay → Legal Holiday OT Allowance

**ND on Regular Holiday:**
- **Rule 2.5.1.7**: Rank and File Only: `ND Hours × Rate/Hour × 0.1`
- **Rule 2.5.1.8**: Display: Earnings Breakdown Table → Legal Holiday ND
- **Rule 2.5.1.9**: Client-Based/Supervisory/Managerial: NO ND

#### 2.5.2 Special Holiday (Non-Working Holiday)

**Regular Hours Pay:**
- **Rule 2.5.2.1**: All employees eligible for holiday pay (via "1 Day Before" rule) get daily rate (1.0x) included in Basic Salary
  - If employee DID NOT work on holiday but eligible: Gets 8 hours × Rate/Hour × 1.0 in basic salary
  - If employee WORKED on holiday (time in/out rendered):
    - **Supervisory/Managerial**: Gets daily rate (1.0x) in basic salary + allowance on top (₱350 for ≥4 hours, ₱700 for ≥8 hours)
    - **Rank and File**: Gets multiplier applied: `Hours × Rate/Hour × 1.3` instead of 1.0x
- **Rule 2.5.2.2**: Display: Earnings Breakdown Table → Special Holiday

**OT on Special Holiday:**
- **Rule 2.5.2.3**: Rank and File: `OT Hours × Rate/Hour × 1.69` (1.3 × 1.3)
- **Rule 2.5.2.4**: Client-Based/Supervisory/Managerial: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Rule 2.5.2.5**: Display: Rank and File → Earnings Breakdown Table → Special Holiday OT
- **Rule 2.5.2.6**: Display: Client-Based/Supervisory/Managerial → Other Pay → Special Holiday OT Allowance

**ND on Special Holiday:**
- **Rule 2.5.2.7**: Rank and File Only: `ND Hours × Rate/Hour × 0.1`
- **Rule 2.5.2.8**: Display: Earnings Breakdown Table → Special Holiday ND
- **Rule 2.5.2.9**: Client-Based/Supervisory/Managerial: NO ND

---

### 2.6 Rest Day Pay Calculation Rules

#### 2.6.1 Regular Hours Pay
- **Rule 2.6.1.1**: Supervisory/Managerial: `Hours × Rate/Hour × 1.0` (Daily rate only, no multiplier)
- **Rule 2.6.1.2**: Rank and File: `Hours × Rate/Hour × 1.3`
- **Rule 2.6.1.3**: Display: Earnings Breakdown Table → Rest Day

#### 2.6.2 OT on Rest Day
- **Rule 2.6.2.1**: Rank and File: `OT Hours × Rate/Hour × 1.69` (1.3 × 1.3)
- **Rule 2.6.2.2**: Client-Based/Supervisory/Managerial: Fixed allowance
  - ≥ 8 hours OT: ₱700
  - ≥ 4 hours OT: ₱350
  - < 4 hours OT: ₱0
- **Rule 2.6.2.3**: Display: Rank and File → Earnings Breakdown Table → Rest Day OT
- **Rule 2.6.2.4**: Display: Client-Based/Supervisory/Managerial → Other Pay → Rest Day OT Allowance

#### 2.6.3 ND on Rest Day
- **Rule 2.6.3.1**: Rank and File Only: `ND Hours × Rate/Hour × 0.1`
- **Rule 2.6.3.2**: Display: Earnings Breakdown Table → Rest Day ND
- **Rule 2.6.3.3**: Client-Based/Supervisory/Managerial: NO ND

---

### 2.7 Combination Day Pay Rules

#### 2.7.1 Sunday + Special Holiday
- **Rule 2.7.1.1**: Supervisory/Managerial: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rule 2.7.1.2**: Rank and File: `Hours × Rate/Hour × 1.5`
- **Rule 2.7.1.3**: OT: Rank and File → `OT Hours × Rate/Hour × 1.95` (1.5 × 1.3)
- **Rule 2.7.1.4**: OT: Client-Based/Supervisory/Managerial → Fixed allowance (₱350/₱700)
- **Rule 2.7.1.5**: Display: Earnings Breakdown Table → Special Holiday on Rest Day OT

#### 2.7.2 Sunday + Regular Holiday
- **Rule 2.7.2.1**: Supervisory/Managerial: `Hours × Rate/Hour × 1.0` (Daily rate, no multiplier)
- **Rule 2.7.2.2**: Rank and File: `Hours × Rate/Hour × 2.6`
- **Rule 2.7.2.3**: OT: Rank and File → `OT Hours × Rate/Hour × 3.38` (2.6 × 1.3)
- **Rule 2.7.2.4**: OT: Client-Based/Supervisory/Managerial → Fixed allowance (₱350/₱700)
- **Rule 2.7.2.5**: Display: Earnings Breakdown Table → Legal Holiday on Rest Day OT

---

### 2.8 Total Salary Calculation Rules

#### 2.8.1 Office-Based Rank and File Employees
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

#### 2.8.2 Client-Based, Supervisory, and Managerial Employees
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

### 2.9 Net Pay Calculation Rules

#### 2.9.1 Formula
```
Net Pay = Gross Pay - Total Deductions + Allowances
```

#### 2.9.2 Gross Pay
- **Rule 2.9.2.1**: Gross Pay = Total Salary (as calculated above)
- **Rule 2.9.2.2**: System recalculates from attendance_data if stored value seems incorrect

#### 2.9.3 Total Deductions
- **Rule 2.9.3.1**: SSS Contribution (semi-monthly: half deducted in 1st cutoff, half in 2nd cutoff)
- **Rule 2.9.3.2**: PhilHealth Contribution (semi-monthly: half deducted in 1st cutoff, half in 2nd cutoff)
- **Rule 2.9.3.3**: Pag-IBIG Contribution (end of month: full amount in 2nd cutoff only)
- **Rule 2.9.3.4**: Withholding Tax (end of month: full amount in 2nd cutoff only)
- **Rule 2.9.3.5**: Loans (SSS, Pag-IBIG, Company, Emergency, Other)
- **Rule 2.9.3.6**: Vale/Advance payments
- **Rule 2.9.3.7**: Tax is computed on monthly taxable income (Gross − SSS − PhilHealth − Pag-IBIG); compensation level 20,833 then prescribed rate (e.g. 15% on excess per BIR TRAIN)

#### 2.9.4 Allowances
- **Rule 2.9.4.1**: Currently set to ₱0 (removed from system)

---

## 3. DATA SOURCE RULES

### 3.1 Time Clock Entries (`time_clock_entries`)
- **Rule 3.1.1**: Source for `regular_hours` (auto-calculated by database trigger)
- **Rule 3.1.2**: Source for `total_hours` (total hours worked minus breaks)
- **Rule 3.1.3**: Source for `total_night_diff_hours` (for timesheet display only, NOT for payslip)
- **Rule 3.1.4**: Only entries with status `approved`, `auto_approved`, or `clocked_out` are counted

### 3.2 Overtime Requests (`overtime_requests`)
- **Rule 3.2.1**: Source for OT hours (`total_hours` field)
- **Rule 3.2.2**: Source for ND hours (calculated from `start_time` and `end_time`)
- **Rule 3.2.3**: Only `approved` requests are used in payslip calculation
- **Rule 3.2.4**: OT hours override clock entry values in payslip calculation

### 3.3 Leave Requests (`leave_requests`)
- **Rule 3.3.1**: Only approved leaves (`approved_by_manager` or `approved_by_hr`) are counted
- **Rule 3.3.2**: SIL (Sick Leave) counts as 8 hours working day
- **Rule 3.3.3**: All other leave types (LWOP, CTO, OB, etc.) do NOT count as working days

### 3.4 Holidays (`holidays`)
- **Rule 3.4.1**: Determines day type (regular, regular-holiday, non-working-holiday, etc.)
- **Rule 3.4.2**: `is_regular = true` → Regular Holiday (Legal Holiday)
- **Rule 3.4.3**: `is_regular = false` → Special Holiday (Non-Working Holiday)

### 3.5 Employee Schedules (`employee_week_schedules`)
- **Rule 3.5.1**: Determines rest days for Account Supervisors (`day_off: true`)
- **Rule 3.5.2**: Schedules are submitted weekly through employee portal
- **Rule 3.5.3**: Schedules are locked after Monday (can't edit past Monday)

---

## 4. DISPLAY LOCATION RULES

### 4.1 Office-Based Rank and File Employees
**Earnings Breakdown Table:**
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

**Other Pay:** Empty or minimal (if any adjustments)

### 4.2 Client-Based, Supervisory, and Managerial Employees
**Earnings Breakdown Table:**
- Basic Salary
- Legal Holiday (regular hours only)
- Special Holiday (regular hours only)
- Rest Day (regular hours only)
- Working Dayoff

**Other Pay Section:**
- Regular OT Allowance
- Legal Holiday OT Allowance
- Special Holiday OT Allowance
- Rest Day OT Allowance
- Special Holiday on Rest Day OT Allowance
- Legal Holiday on Rest Day OT Allowance

**Note:** NO Night Differential items (they have OT allowance already)

---

## 5. MULTIPLIER REFERENCE TABLE

### 5.1 Rank and File Employees
| Day Type | Regular Hours | OT Hours | ND Hours |
|----------|--------------|----------|----------|
| Regular Day | 1.0x | 1.25x | 0.1x |
| Legal Holiday | 2.0x | 2.6x | 0.1x |
| Special Holiday | 1.3x | 1.69x | 0.1x |
| Rest Day | 1.3x | 1.69x | 0.1x |
| Sunday + Special Holiday | 1.5x | 1.95x | 0.1x |
| Sunday + Legal Holiday | 2.6x | 3.38x | 0.1x |

### 5.2 Supervisory/Managerial Employees
| Day Type | Regular Hours | OT Allowance | ND |
|----------|--------------|--------------|-----|
| Regular Day | 1.0x | Fixed (see OT rules) | NO |
| Legal Holiday | 1.0x | Fixed (₱350/₱700) | NO |
| Special Holiday | 1.0x | Fixed (₱350/₱700) | NO |
| Rest Day | 1.0x | Fixed (₱350/₱700) | NO |
| Sunday + Special Holiday | 1.0x | Fixed (₱350/₱700) | NO |
| Sunday + Legal Holiday | 1.0x | Fixed (₱350/₱700) | NO |

---

## 6. IMPORTANT NOTES

1. **Holiday Pay in Basic Salary**: Holidays ARE included in Basic Salary (not paid separately). If eligible via "1 Day Before" rule:
   - **Didn't work on holiday**: All employees get daily rate (1.0x) in basic salary
   - **Worked on holiday (time in/out rendered)**:
     - **Supervisory/Managerial**: Get daily rate (1.0x) in basic salary + allowance on top (₱350/₱700)
     - **Rank and File**: Get multiplier applied (2.0x for Legal Holiday, 1.3x for Special Holiday) instead of 1.0x
2. **Night Differential Source**: Always calculated from approved OT requests, NOT from clock entries
3. **No Pro-Rating**: Fixed allowances require exact hour thresholds (4 or 8 hours)
4. **Rest Days for Account Supervisors**: Determined by weekly schedule submission (`day_off: true`)
5. **Leave Days**: Only SIL (Sick Leave) counts as 8 hours regular day; other leaves don't count
6. **Deductions**: Applied monthly, only during 2nd cutoff (day 16+)
7. **Gross Pay Recalculation**: System recalculates from attendance_data if stored value seems incorrect
8. **Employee Type Field**: `employee_type` field determines if employee is "office-based" or "client-based"
9. **Supervisory Identification**: Based on position title matching specific supervisory roles
10. **Managerial Identification**: Based on `job_level` field equal to "MANAGERIAL"
11. **"1 Day Before" Rule**: Applies to ALL employee types for holiday eligibility
12. **Saturday Regular Work Day**: Paid 6 days/week per Philippine labor law (Saturday gets 8 BH even if not worked)
13. **Account Supervisor Rest Days**: First rest day is actual rest day (only paid if worked), second rest day is regular workday (gets 8 BH even if not worked)

---

## END OF ENUMERATION

Total Rules Enumerated: **200+**

This enumeration covers all business rules for time attendance and payslip generation systems.