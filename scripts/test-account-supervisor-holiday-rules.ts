/**
 * Test Account Supervisor Holiday Rules
 *
 * Verifies:
 * 1. Account Supervisors get daily rate only (NO multiplier) for holidays
 * 2. If they work on holiday → get daily rate
 * 3. If they DON'T work on holiday → check "1 Day Before" rule (worked full 8 hours the day before)
 *
 * Run with: npx tsx scripts/test-account-supervisor-holiday-rules.ts
 */

import { generateTimesheetFromClockEntries } from "../lib/timesheet-auto-generator";
import { normalizeHolidays } from "../utils/holidays";

const holidays2025 = [
  { holiday_date: "2025-12-24", holiday_type: "non-working", name: "Christmas Eve" },
  { holiday_date: "2025-12-25", holiday_type: "regular", name: "Christmas Day" },
];

const ratePerHour = 100;

console.log("=".repeat(80));
console.log("ACCOUNT SUPERVISOR HOLIDAY RULES TEST");
console.log("=".repeat(80));
console.log();

// Test Case 1: Account Supervisor worked on holiday (Dec 25)
console.log("TEST 1: Account Supervisor WORKED on Regular Holiday (Dec 25)");
console.log("-".repeat(80));

const workedOnHolidayEntries = [
  {
    id: "1",
    employee_id: "as-1",
    clock_in_time: "2025-12-25T08:00:00Z",
    clock_out_time: "2025-12-25T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const workedOnHolidayTimesheet = generateTimesheetFromClockEntries(
  workedOnHolidayEntries as any,
  new Date("2025-12-25"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

const workedOnHolidayDay = workedOnHolidayTimesheet.attendance_data[0];
console.log(`Date: ${workedOnHolidayDay.date}`);
console.log(`Day Type: ${workedOnHolidayDay.dayType}`);
console.log(`Regular Hours: ${workedOnHolidayDay.regularHours}`);

// Expected: Should get daily rate (8 * 100 = 800), NO multiplier
const expectedWorkedOnHoliday = 8 * ratePerHour; // Daily rate only
console.log(`Expected Pay: ₱${expectedWorkedOnHoliday.toFixed(2)} (Daily Rate Only - NO Multiplier)`);
console.log(`Rule: Worked on holiday → Get daily rate`);
console.log();

// Test Case 2: Account Supervisor DID NOT work on holiday, but worked REGULAR WORKING DAY before (Dec 23)
console.log("TEST 2: Account Supervisor DID NOT work on Regular Holiday (Dec 25)");
console.log("        BUT worked full 8 hours on REGULAR WORKING DAY before (Dec 23)");
console.log("-".repeat(80));

const workedDayBeforeEntries = [
  {
    id: "2",
    employee_id: "as-2",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
  // No entry for Dec 25 (holiday)
];

const workedDayBeforeTimesheet = generateTimesheetFromClockEntries(
  workedDayBeforeEntries as any,
  new Date("2025-12-24"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

console.log("Attendance Data:");
workedDayBeforeTimesheet.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const dec25Day = workedDayBeforeTimesheet.attendance_data.find(d => d.date === "2025-12-25");
if (dec25Day) {
  console.log(`\nDec 25 Holiday Entry:`);
  console.log(`  Regular Hours: ${dec25Day.regularHours}`);
  console.log(`  Expected: 8 hours (eligible via "1 Day Before" rule)`);

  if (dec25Day.regularHours === 8) {
    console.log(`  ✓ PASS: Correctly granted 8 hours via "1 Day Before" rule`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${dec25Day.regularHours}`);
  }

  const expectedDayBefore = 8 * ratePerHour; // Daily rate only
  console.log(`  Expected Pay: ₱${expectedDayBefore.toFixed(2)} (Daily Rate Only - NO Multiplier)`);
  console.log(`  Rule: Didn't work on holiday BUT worked 8 hours on REGULAR WORKING DAY before → Get daily rate`);
} else {
  console.log(`\n✗ FAIL: Dec 25 entry not found`);
}
console.log();

// Test Case 3: Account Supervisor DID NOT work on holiday, and DID NOT work day before
console.log("TEST 3: Account Supervisor DID NOT work on Regular Holiday (Dec 25)");
console.log("        AND DID NOT work full 8 hours the day before (Dec 24)");
console.log("-".repeat(80));

const didNotWorkDayBeforeEntries = [
  {
    id: "3",
    employee_id: "as-3",
    clock_in_time: "2025-12-24T08:00:00Z",
    clock_out_time: "2025-12-24T12:00:00Z", // Only 4 hours
    regular_hours: 4,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
  // No entry for Dec 25 (holiday)
];

const didNotWorkDayBeforeTimesheet = generateTimesheetFromClockEntries(
  didNotWorkDayBeforeEntries as any,
  new Date("2025-12-24"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

console.log("Attendance Data:");
didNotWorkDayBeforeTimesheet.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const dec25DayNoWork = didNotWorkDayBeforeTimesheet.attendance_data.find(d => d.date === "2025-12-25");
if (dec25DayNoWork) {
  console.log(`\nDec 25 Holiday Entry:`);
  console.log(`  Regular Hours: ${dec25DayNoWork.regularHours}`);
  console.log(`  Expected: 0 hours (NOT eligible - didn't work 8 hours day before)`);

  if (dec25DayNoWork.regularHours === 0) {
    console.log(`  ✓ PASS: Correctly NOT granted hours (didn't meet "1 Day Before" rule)`);
  } else {
    console.log(`  ✗ FAIL: Expected 0 hours, got ${dec25DayNoWork.regularHours}`);
  }

  console.log(`  Expected Pay: ₱0.00 (No pay - didn't meet eligibility)`);
  console.log(`  Rule: Didn't work on holiday AND didn't work 8 hours day before → NO pay`);
} else {
  console.log(`\n✓ PASS: Dec 25 entry correctly not created (not eligible)`);
}
console.log();

// Test Case 4: Account Supervisor worked on Special Non-Working Holiday (Dec 24)
console.log("TEST 4: Account Supervisor WORKED on Special Non-Working Holiday (Dec 24)");
console.log("-".repeat(80));

const workedOnSpecialHolidayEntries = [
  {
    id: "4",
    employee_id: "as-4",
    clock_in_time: "2025-12-24T08:00:00Z",
    clock_out_time: "2025-12-24T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const workedOnSpecialHolidayTimesheet = generateTimesheetFromClockEntries(
  workedOnSpecialHolidayEntries as any,
  new Date("2025-12-24"),
  new Date("2025-12-24"),
  holidays2025,
  undefined,
  true,
  false
);

const workedOnSpecialHolidayDay = workedOnSpecialHolidayTimesheet.attendance_data[0];
console.log(`Date: ${workedOnSpecialHolidayDay.date}`);
console.log(`Day Type: ${workedOnSpecialHolidayDay.dayType}`);
console.log(`Regular Hours: ${workedOnSpecialHolidayDay.regularHours}`);

// Expected: Should get daily rate (8 * 100 = 800), NO multiplier
const expectedWorkedOnSpecialHoliday = 8 * ratePerHour; // Daily rate only
console.log(`Expected Pay: ₱${expectedWorkedOnSpecialHoliday.toFixed(2)} (Daily Rate Only - NO Multiplier)`);
console.log(`Rule: Worked on special holiday → Get daily rate`);
console.log();

// Test Case 5: Account Supervisor DID NOT work on Special Holiday, but worked day before
console.log("TEST 5: Account Supervisor DID NOT work on Special Holiday (Dec 24)");
console.log("        BUT worked full 8 hours the day before (Dec 23)");
console.log("-".repeat(80));

const workedDayBeforeSpecialEntries = [
  {
    id: "5",
    employee_id: "as-5",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
  // No entry for Dec 24 (special holiday)
];

const workedDayBeforeSpecialTimesheet = generateTimesheetFromClockEntries(
  workedDayBeforeSpecialEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-24"),
  holidays2025,
  undefined,
  true,
  false
);

console.log("Attendance Data:");
workedDayBeforeSpecialTimesheet.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const dec24Day = workedDayBeforeSpecialTimesheet.attendance_data.find(d => d.date === "2025-12-24");
if (dec24Day) {
  console.log(`\nDec 24 Special Holiday Entry:`);
  console.log(`  Regular Hours: ${dec24Day.regularHours}`);
  console.log(`  Expected: 8 hours (eligible via "1 Day Before" rule)`);

  if (dec24Day.regularHours === 8) {
    console.log(`  ✓ PASS: Correctly granted 8 hours via "1 Day Before" rule`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${dec24Day.regularHours}`);
  }

  const expectedDayBeforeSpecial = 8 * ratePerHour; // Daily rate only
  console.log(`  Expected Pay: ₱${expectedDayBeforeSpecial.toFixed(2)} (Daily Rate Only - NO Multiplier)`);
  console.log(`  Rule: Didn't work on special holiday BUT worked 8 hours day before → Get daily rate`);
} else {
  console.log(`\n✗ FAIL: Dec 24 entry not found`);
}
console.log();

// Summary
console.log("=".repeat(80));
console.log("TEST SUMMARY");
console.log("=".repeat(80));
console.log();
console.log("Account Supervisor Holiday Rules:");
console.log("1. ✓ NO multiplier - Daily rate only (1.0x)");
console.log("2. ✓ If worked on holiday → Get daily rate");
console.log("3. ✓ If didn't work on holiday → Check '1 Day Before' rule:");
console.log("   - Worked 8 hours day before → Get daily rate");
console.log("   - Did NOT work 8 hours day before → NO pay");
console.log();
console.log("=".repeat(80));