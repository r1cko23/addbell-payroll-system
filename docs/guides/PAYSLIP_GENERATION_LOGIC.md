# Payslip Generation & Time Attendance Logic Breakdown

## Overview

This document explains how payslip generation and time attendance logic works, including data sources, calculations, and display logic.

---

## 1. Data Sources

### 1.1 Time Clock Entries (`time_clock_entries`)

**What it contains:**

- `clock_in_time`: When employee clocked in
- `clock_out_time`: When employee clocked out
- `regular_hours`: Hours worked during regular schedule (8AM-5PM), auto-calculated by database trigger
- `total_hours`: Total hours worked (minus breaks)
- `total_night_diff_hours`: Night differential hours calculated from clock times (5PM-6AM), auto-calculated by database trigger
- `status`: Entry status (`auto_approved`, `approved`, `clocked_out`, etc.)

**Important Notes:**

- `regular_hours` is calculated automatically based on employee schedule
- `total_night_diff_hours` is calculated automatically but **NOT used in payslip** (see section 2.3)
- Only entries with status `approved`, `auto_approved`, or `clocked_out` are counted

### 1.2 Overtime Requests (`overtime_requests`)

**What it contains:**

- `ot_date`: Date of overtime
- `end_date`: End date (if OT spans midnight)
- `start_time`: Start time of OT
- `end_time`: End time of OT
- `total_hours`: Total OT hours
- `status`: Request status (`pending`, `approved`, `rejected`)

**Important Notes:**

- **Only `approved` requests are used** in payslip calculation
- OT hours come from `total_hours` field
- Night differential is **calculated from `start_time` and `end_time`** (not from clock entries)

### 1.3 Leave Requests (`leave_requests`)

**What it contains:**

- `leave_type`: Type of leave (SIL, LWOP, CTO, OB, etc.)
- `start_date`: Start date of leave
- `end_date`: End date of leave
- `selected_dates`: Array of specific dates (for multi-day leaves)
- `status`: Request status (`approved_by_manager`, `approved_by_hr`)

**Important Notes:**

- **Only approved leaves** (`approved_by_manager` or `approved_by_hr`) are counted
- **SIL (Sick Leave)** counts as 8 hours working day
- **All other leave types** (LWOP, CTO, OB, etc.) do NOT count as working days

### 1.4 Holidays (`holidays`)

**What it contains:**

- `holiday_date`: Date of holiday
- `is_regular`: Boolean indicating if it's a regular holiday (true) or special holiday (false)

**Day Types:**

- `regular`: Normal working day
- `regular-holiday`: Regular holiday (paid 2x)
- `non-working-holiday`: Special holiday (paid 1.3x)
- `sunday`: Sunday/Rest day (paid 1.3x)
- `sunday-regular-holiday`: Sunday + Regular holiday (paid 2.6x)
- `sunday-special-holiday`: Sunday + Special holiday (paid 1.5x)

### 1.5 Employee Schedules (`employee_week_schedules`)

**What it contains:**

- `schedule_date`: Date
- `start_time`: Start time (nullable for rest days)
- `end_time`: End time (nullable for rest days)
- `day_off`: Boolean indicating if it's a rest day
- `tasks`: Tasks for the day (nullable for rest days)

**How it works:**

- **Account Supervisors** submit weekly schedules through the employee portal
- They mark days as `day_off: true` when they're taking a rest day
- Schedules are submitted weekly and locked after Monday (can't edit past Monday)
- Days marked as `day_off: true` are treated as rest days in payslip calculation

**Used for:**

- Determining rest days (for Account Supervisors and flexible schedules)
- Identifying which days are working days vs rest days
- Rest days get premium pay (1.3x rate) instead of regular pay

---

## 2. Payslip Generation Flow

### 2.1 Step 1: Load Existing Attendance Record

**Location:** `app/payslips/page.tsx` lines 333-338

```typescript
// Try to load existing attendance record
const { data: attData } = await supabase
  .from("weekly_attendance")
  .select("*")
  .eq("employee_id", selectedEmployeeId)
  .eq("period_start", periodStartStr)
  .maybeSingle();
```

**If attendance record exists:**

- Use existing `attendance_data` array
- Update leave days (SIL = 8 hours)
- Recalculate totals if needed

**If no attendance record exists:**

- Proceed to Step 2 (generate from clock entries)

### 2.2 Step 2: Load All Data Sources

**Location:** `app/payslips/page.tsx` lines 351-575

#### 2.2.1 Load Leave Requests

```typescript
const { data: leaveData } = await supabase
  .from("leave_requests")
  .select("id, leave_type, start_date, end_date, status, selected_dates")
  .eq("employee_id", selectedEmployeeId)
  .in("status", ["approved_by_manager", "approved_by_hr"]);
```

**Creates:** `leaveDatesMap` - Map of date → { leaveType, status }

- Prioritizes SIL over other leave types if multiple leaves exist on same date

#### 2.2.2 Load Time Clock Entries

```typescript
const { data: clockEntries } = await supabase
  .from("time_clock_entries")
  .select(
    "id, clock_in_time, clock_out_time, regular_hours, total_hours, total_night_diff_hours, status"
  )
  .eq("employee_id", selectedEmployeeId)
  .gte("clock_in_time", periodStartDate)
  .lte("clock_in_time", periodEndDate);
```

**Filters:**

- Converts to Asia/Manila timezone for date comparison
- Only includes entries within the period

#### 2.2.3 Load Holidays

```typescript
const { data: holidaysData } = await supabase
  .from("holidays")
  .select("holiday_date, name, is_regular")
  .gte("holiday_date", periodStartStr)
  .lte("holiday_date", periodEndStr);
```

**Maps to:** Array of `{ holiday_date, holiday_type: "regular" | "non-working" }`

#### 2.2.4 Load Employee Schedules

```typescript
const { data: scheduleData } = await supabase
  .from("employee_week_schedules")
  .select("schedule_date, day_off")
  .eq("employee_id", selectedEmployeeId)
  .gte("schedule_date", periodStartStr)
  .lte("schedule_date", periodEndStr);
```

**Creates:** `restDaysMap` - Map of date → boolean (true if rest day)

### 2.3 Step 3: Process Overtime Requests

**Location:** `app/payslips/page.tsx` lines 587-703

#### 2.3.1 Check Employee Eligibility

```typescript
const isEligibleForOT = selectedEmployee?.eligible_for_ot !== false;
const isAccountSupervisor =
  selectedEmployee?.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") ||
  false;
const isEligibleForNightDiff = !isAccountSupervisor;
```

**Important:**

- Account Supervisors are **NOT eligible for night differential** (flexi time)
- Default eligibility for OT is `true` unless explicitly set to `false`

#### 2.3.2 Load Approved OT Requests

```typescript
const { data: otRequests } = await supabase
  .from("overtime_requests")
  .select("ot_date, end_date, start_time, end_time, total_hours")
  .eq("employee_id", selectedEmployeeId)
  .eq("status", "approved")
  .gte("ot_date", periodStartStr)
  .lte("ot_date", periodEndStr);
```

#### 2.3.3 Calculate OT Hours by Date

**Creates:** `approvedOTByDate` - Map of date → total OT hours

```typescript
otRequests.forEach((ot) => {
  const dateStr = format(ot.ot_date, "yyyy-MM-dd");
  const existingOT = approvedOTByDate.get(dateStr) || 0;
  approvedOTByDate.set(dateStr, existingOT + ot.total_hours);
});
```

#### 2.3.4 Calculate Night Differential from OT Requests

**Creates:** `approvedNDByDate` - Map of date → ND hours

**Calculation Logic:**

- ND applies from **5PM (17:00) to 6AM (06:00)** next day
- Calculated from OT request's `start_time` and `end_time` (NOT from clock entries)

**Same Day OT:**

```typescript
if (startTime >= 5PM) {
  // Entire OT duration counts as ND
  ndHours = (endTime - startTime) / 60;
} else if (endTime >= 5PM) {
  // Only hours after 5PM count as ND
  ndHours = (endTime - 5PM) / 60;
}
```

**OT Spans Midnight:**

```typescript
// Hours from max(start_time, 5PM) to midnight
hoursToMidnight = (24:00 - max(start_time, 5PM)) / 60;
// Plus hours from midnight to min(end_time, 6AM)
hoursFromMidnight = min(end_time, 6AM) / 60;
ndHours = hoursToMidnight + hoursFromMidnight;
```

**Important:** ND hours are capped at `total_hours` (can't exceed OT hours)

### 2.4 Step 4: Map Clock Entries

**Location:** `app/payslips/page.tsx` lines 705-724

**Critical Step:** Override OT and ND from clock entries with values from approved OT requests

```typescript
const mappedClockEntries = filteredClockEntries.map((entry) => {
  const entryDate = entry.clock_in_time?.split("T")[0];

  // Get OT hours from approved OT requests (NOT from clock entry)
  const otHoursFromRequest = approvedOTByDate.get(entryDate) || 0;

  // Get ND hours from approved OT requests (NOT from clock entry)
  const ndHoursFromRequest = approvedNDByDate.get(entryDate) || 0;

  return {
    ...entry,
    overtime_hours: otHoursFromRequest, // Override with OT request value
    night_diff_hours: ndHoursFromRequest, // Override with OT request value
  };
});
```

**Why this is important:**

- Clock entries may have `total_night_diff_hours` calculated automatically
- But payslip should **ONLY use ND from approved OT requests**
- This ensures consistency and proper approval workflow

### 2.5 Step 5: Generate Timesheet Data

**Location:** `app/payslips/page.tsx` lines 729-737

```typescript
const timesheetData = generateTimesheetFromClockEntries(
  mappedClockEntries,
  periodStart,
  periodEnd,
  holidays,
  restDaysMap,
  isEligibleForOT,
  isEligibleForNightDiff
);
```

**Function:** `lib/timesheet-auto-generator.ts`

**Process:**

1. Groups clock entries by date
2. Determines day type (regular, holiday, rest day, etc.)
3. Aggregates hours for each day:
   - `regularHours`: Sum of `regular_hours` from clock entries
   - `overtimeHours`: Sum of `overtime_hours` from mapped entries (from OT requests)
   - `nightDiffHours`: Sum of `night_diff_hours` from mapped entries (from OT requests)
4. Creates `attendance_data` array with one entry per day

**Returns:**

```typescript
{
  attendance_data: DailyAttendance[],
  total_regular_hours: number,
  total_overtime_hours: number,
  total_night_diff_hours: number
}
```

### 2.6 Step 6: Apply Leave Days

**Location:** `app/payslips/page.tsx` lines 742-762

```typescript
timesheetData.attendance_data = timesheetData.attendance_data.map((day) => {
  const leaveInfo = leaveDatesMap.get(day.date);
  if (leaveInfo) {
    if (leaveInfo.leaveType === "SIL") {
      // SIL counts as 8 hours working day
      return {
        ...day,
        regularHours: 8,
        dayType: "regular",
      };
    }
    // Other leave types don't count as working day
  }
  return day;
});
```

**Important:**

- **SIL (Sick Leave)** = 8 hours, counts as regular working day
- **All other leaves** (LWOP, CTO, OB, etc.) = 0 hours, don't count

### 2.7 Step 7: Calculate Gross Pay

**Location:** `app/payslips/page.tsx` lines 773-805

```typescript
const payrollResult = calculateWeeklyPayroll(
  timesheetData.attendance_data,
  ratePerHour
);
grossPay = payrollResult.grossPay;
```

**Function:** `utils/payroll-calculator.ts` → `calculateWeeklyPayroll()`

**Calculates:**

- Basic salary (regular days)
- Overtime pay
- Night differential pay
- Holiday pay (regular and special)
- Rest day pay
- All combinations (holiday + OT, rest day + OT, etc.)

---

## 3. Payslip Display Logic

### 3.1 PayslipDetailedBreakdown Component

**Location:** `components/PayslipDetailedBreakdown.tsx`

**Purpose:** Shows detailed breakdown of earnings

**Process:**

1. Receives `attendanceData` array
2. For each day, calculates earnings based on:
   - Day type (regular, holiday, rest day)
   - Regular hours
   - Overtime hours (from OT requests)
   - Night differential hours (from OT requests)

**Important Note:**

- **DOES NOT recalculate ND from clock times** (fixed in recent update)
- Uses `nightDiffHours` directly from `attendanceData` (which comes from OT requests)

### 3.2 PayslipPrint Component

**Location:** `components/PayslipPrint.tsx`

**Purpose:** Generates printable payslip

**Process:**

1. Processes `attendance_data` array
2. Calculates earnings breakdown:
   - Basic salary (regular days only)
   - Regular overtime
   - Night differential (regular days only)
   - Holiday pay (regular and special)
   - Rest day pay
   - All combinations

**Earnings Categories:**

- Basic Earnings: Regular working days (8AM-5PM)
- Regular Overtime: OT on regular days (1.25x rate)
- Night Differential: ND on regular days (0.1x rate)
- NDOT: Night diff + OT overlap (0.1x rate)
- Legal Holiday: Regular holidays (2x rate)
- Legal Holiday OT: OT on regular holidays (2.6x rate)
- Legal Holiday ND: ND on regular holidays (0.1x rate)
- Special Holiday: Special holidays (1.3x rate)
- Special Holiday OT: OT on special holidays (1.69x rate)
- Special Holiday ND: ND on special holidays (0.1x rate)
- Rest Day: Sunday/rest days (1.3x rate)
- Rest Day OT: OT on rest days (1.69x rate)
- Rest Day ND: ND on rest days (0.1x rate)
- And more combinations...

---

## 4. Key Rules & Exceptions

### 4.1 Account Supervisors

- **NOT eligible for night differential** (flexi time)
- Position check: `position.toUpperCase().includes("ACCOUNT SUPERVISOR")`
- ND hours are set to 0 even if OT requests have ND
- **Rest days** are determined by the days they mark as `day_off: true` in their weekly schedule submission
- They submit schedules weekly through the employee portal (`/employee-portal/schedule`)
- Schedules are locked after Monday (can't edit past Monday)
- Days marked as rest days get premium pay (1.3x rate) instead of regular pay

### 4.2 Overtime Eligibility

- Default: `eligible_for_ot !== false` (defaults to true)
- If `eligible_for_ot === false`, OT hours are set to 0

### 4.3 Night Differential Sources

- **Payslip:** ONLY from approved OT requests (calculated from `start_time` and `end_time`)
- **Timesheet:** From clock entries (`total_night_diff_hours` column)
- **Why different?** Payslip requires approval workflow, timesheet shows actual clock times

### 4.4 Leave Types

- **SIL (Sick Leave):** Counts as 8 hours, regular working day
- **All other leaves:** Do NOT count as working days (LWOP, CTO, OB, etc.)

### 4.5 Day Type Determination

**Priority order:**

1. Check if it's a holiday (regular or special)
2. Check if it's a rest day (Sunday or from schedule)
3. Check if it's a combination (Sunday + Holiday)
4. Default to `regular`

---

## 5. Calculation Formulas

### 5.1 Regular Pay

```
Regular Pay = Regular Hours × Hourly Rate
```

### 5.2 Regular Overtime

```
OT Pay = OT Hours × Hourly Rate × 1.25
```

### 5.3 Night Differential

```
ND Pay = ND Hours × Hourly Rate × 0.1
```

### 5.4 Regular Holiday

**Rank and File:**

- If worked on holiday: `Hours × Hourly Rate × 2.0` (Daily Rate + Premium)
- If eligible but didn't work: `8 hours × Hourly Rate × 1.0` (Daily Rate entitlement)

**Supervisory/Managerial:**

- If worked on holiday: `Hours × Hourly Rate × 1.0` (Daily Rate)
- If eligible but didn't work: `8 hours × Hourly Rate × 1.0` (Daily Rate entitlement)

**Eligibility**: Worked on holiday OR worked day before (≥8 hours)

### 5.5 Special Holiday

**Rank and File:**

- If worked on holiday: `Hours × Hourly Rate × 1.3` (Daily Rate + Premium)
- If eligible but didn't work: `8 hours × Hourly Rate × 1.0` (Daily Rate entitlement)

**Supervisory/Managerial:**

- If worked on holiday: `Hours × Hourly Rate × 1.0` (Daily Rate)
- If eligible but didn't work: `8 hours × Hourly Rate × 1.0` (Daily Rate entitlement)

**Eligibility**: Worked on holiday OR worked day before (≥8 hours)

### 5.6 Rest Day (Sunday)

```
Rest Day Pay = Hours × Hourly Rate × 1.3
```

### 5.7 Combinations

- **Sunday + Regular Holiday:** 2.6x rate
- **Sunday + Special Holiday:** 1.5x rate
- **Holiday + OT:** Holiday rate × 1.3
- **Rest Day + OT:** Rest day rate × 1.3

---

## 6. Data Flow Summary

```
1. Load Data Sources
   ├── Time Clock Entries (for regular hours)
   ├── Approved OT Requests (for OT & ND hours)
   ├── Approved Leave Requests (for leave days)
   ├── Holidays (for day type)
   └── Employee Schedules (for rest days)

2. Process OT Requests
   ├── Group OT hours by date
   └── Calculate ND hours from OT request times

3. Map Clock Entries
   ├── Override OT hours with OT request values
   └── Override ND hours with OT request values

4. Generate Timesheet
   ├── Group entries by date
   ├── Determine day type
   └── Aggregate hours per day

5. Apply Leaves
   ├── SIL = 8 hours, regular day
   └── Other leaves = 0 hours

6. Calculate Payroll
   ├── Basic salary
   ├── Overtime pay
   ├── Night differential pay
   ├── Holiday pay
   └── Rest day pay

7. Display Payslip
   ├── Detailed breakdown
   └── Print view
```

---

## 7. Common Issues & Solutions

### Issue 1: Night Differential Showing When It Shouldn't

**Cause:** ND being recalculated from clock times instead of using OT requests
**Solution:** Fixed in `PayslipDetailedBreakdown.tsx` - now uses ND from `attendanceData` only

### Issue 2: OT Hours Not Showing

**Cause:** No approved OT requests for the period
**Solution:** Ensure OT requests are approved before generating payslip

### Issue 3: Leave Days Not Counting

**Cause:** Leave request not approved or wrong leave type
**Solution:** Only SIL counts as working day; other leaves don't count

### Issue 4: Account Supervisor Getting ND

**Cause:** Position check not working correctly
**Solution:** Verify position field contains "ACCOUNT SUPERVISOR" (case-insensitive)

---

## 8. Database Triggers

### Time Clock Entry Trigger

**Location:** `supabase/migrations/119_remove_auto_ot_calculation.sql`

**What it does:**

- Calculates `regular_hours` based on employee schedule
- Calculates `total_night_diff_hours` from clock times (5PM-6AM)
- Sets `overtime_hours` to 0 (OT must come from approved requests)

**Important:** These calculated values are used in timesheet but **NOT in payslip** (payslip uses OT requests)

---

## 9. Summary

**Key Takeaways:**

1. **Regular hours** come from clock entries (`regular_hours` column)
2. **OT hours** come from approved OT requests (`total_hours` field)
3. **ND hours** come from approved OT requests (calculated from `start_time` and `end_time`)
4. **Leave days** only SIL counts as 8 hours working day
5. **Account Supervisors** don't get night differential
6. **Day types** determine pay multipliers (regular, holiday, rest day, combinations)

**Data Flow:**
Clock Entries → Map with OT Requests → Generate Timesheet → Apply Leaves → Calculate Payroll → Display Payslip