# Dec 1-15 Payslip Calculation Issue Analysis

## Problem

Jericko Razal's payslip for Dec 1-15, 2025 shows:

- **Special Holiday: 16 hours** (should be 9 hours from Dec 8 only)
- **Rest Day: 16 hours** (should be 0 hours - no rest days were worked)

## Actual Time Entries (Dec 1-15)

- Dec 2 (Tue) - 9 hours - Regular day
- Dec 3 (Wed) - 9.08 hours - Regular day
- Dec 4 (Thu) - 9 hours - Regular day
- Dec 5 (Fri) - 9.08 hours - Regular day
- Dec 6 (Sat) - 4 hours - Regular day (half day)
- **Dec 8 (Mon) - 9 hours - Special Holiday** (Feast of the Immaculate Conception)
- Dec 9 (Tue) - 9.08 hours - Regular day
- Dec 10 (Wed) - 9 hours - Regular day
- Dec 11 (Thu) - 9.08 hours - Regular day
- Dec 13 (Sat) - 4 hours - Regular day (half day)
- Dec 15 (Mon) - 9 hours - Regular day

## Rest Days (No Work)

- Dec 1 (Mon) - Rest day (day_off = true) - No work
- Dec 7 (Sun) - Rest day (day_off = true) - No work
- Dec 14 (Sun) - Rest day (day_off = true) - No work

## Holiday Classification

- **Dec 8** - Feast of the Immaculate Conception of Mary - **Special (Non-Working) Day** (`is_regular = false`)

## Day Type Classification (Expected)

Based on `determineDayType()` function:

- Dec 1 (Mon) - `sunday` (rest day from schedule)
- Dec 2-6, 9-13, 15 - `regular`
- Dec 7 (Sun) - `sunday` (Sunday rest day)
- **Dec 8 (Mon) - `non-working-holiday`** (Special Holiday, NOT a rest day)
- Dec 14 (Sun) - `sunday` (Sunday rest day)

## Root Cause Analysis

### Issue 1: Special Holiday Hours (16 hours instead of 9)

**Expected:** Dec 8 should contribute 9 hours to Special Holiday
**Actual:** 16 hours shown

**Possible Causes:**

1. **Double counting:** Dec 8 might be processed twice

   - Once with `regular_hours = 8.0` from database
   - Once recalculated from clock times = 9 hours
   - Total = 17 hours (close to 16)

2. **Incorrect day type:** Dec 8 might be classified as both `non-working-holiday` AND `sunday-special-holiday`

   - If classified as `sunday-special-holiday`, it would add to `breakdown.specialHoliday.hours` (line 695)
   - If also classified as `non-working-holiday`, it would add again (line 577)
   - But Dec 8 is Monday, not Sunday, so this shouldn't happen

3. **Hours recalculation issue:**
   - Database shows `regular_hours = 8.0` for Dec 8
   - Clock entry shows 9 hours (8:00 AM to 5:00 PM)
   - Code recalculates from clock times if `clockInTime && clockOutTime && !isLeaveDayWithFullHours` (line 376)
   - If both values are being used, that could cause double counting

### Issue 2: Rest Day Hours (16 hours instead of 0)

**Expected:** 0 hours (no rest days were worked)
**Actual:** 16 hours shown

**Possible Causes:**

1. **Rest days being counted even without work:**

   - Dec 1, 7, 14 are rest days but have no time entries
   - Code at line 630-646 adds `regularHours` to `breakdown.restDay.hours` if `dayType === "sunday"`
   - If `regularHours` is somehow > 0 for these days, they would be counted
   - But rest days should have `regularHours = 0` if no work was done

2. **Incorrect day type classification:**

   - If Dec 8 is incorrectly classified as `sunday` instead of `non-working-holiday`, it would add 9 hours to rest day
   - But Dec 8 is Monday, not Sunday, so this shouldn't happen

3. **Hours from another period:**
   - Maybe hours from a different period are being included

## Code Flow Analysis

### Special Holiday Calculation (lines 547-627)

```typescript
if (dayType === "non-working-holiday") {
  const eligibleForHolidayPay = isEligibleForHolidayPay(...);
  if (eligibleForHolidayPay) {
    const hoursToPay = regularHours > 0 ? regularHours : 8;
    // For Rank and File:
    if (regularHours > 0) {
      breakdown.specialHoliday.hours += regularHours; // Line 577
    }
  }
}
```

### Rest Day Calculation (lines 629-686)

```typescript
if (dayType === "sunday") {
  // Adds regularHours to breakdown.restDay.hours (line 636 or 644)
  breakdown.restDay.hours += regularHours;
}
```

### Hours Recalculation (lines 368-391)

```typescript
let regularHours = dayRegularHours; // From attendance_data
if (clockInTime && clockOutTime && !isLeaveDayWithFullHours) {
  const calculated = calculateHoursFromClockTimes(...);
  regularHours = calculated.regularHours; // Override with calculated value
}
```

## Recommendations

1. **Check attendance_data generation:**

   - Verify that Dec 8 has correct `dayType = "non-working-holiday"`
   - Verify that Dec 1, 7, 14 have `regularHours = 0`
   - Verify that Dec 8 has `regularHours = 9` (not 8)

2. **Check for duplicate processing:**

   - Ensure each day is only processed once in the loop
   - Check if `calculateHoursFromClockTimes` is being called multiple times

3. **Verify day type determination:**

   - Ensure `determineDayType()` is correctly identifying Dec 8 as `non-working-holiday` (not `sunday-special-holiday`)
   - Ensure rest days (Dec 1, 7, 14) are correctly identified as `sunday` but have `regularHours = 0`

4. **Add debugging:**
   - Log `dayType` and `regularHours` for each day in the calculation
   - Log when hours are added to `breakdown.specialHoliday.hours` and `breakdown.restDay.hours`

## Expected Correct Calculation

- **Special Holiday:** 9 hours (Dec 8 only)

  - Amount: 9 hours × ₱200/hour × 1.3 = ₱2,340 (Rank & File)
  - OR: 9 hours × ₱200/hour × 1.0 = ₱1,800 (Supervisory)

- **Rest Day:** 0 hours (no rest days worked)

- **Days Work:** 11 days (excluding rest days Dec 1, 7, 14)

- **Basic Salary:** 11 days × ₱1,600/day = ₱17,600





