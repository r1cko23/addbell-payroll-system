/**
 * Test "1 Day Before" Rule - Must be a WORKING DAY
 * 
 * Verifies that the "1 Day Before" rule checks for a REGULAR WORKING DAY,
 * not just any day (holidays don't count as "working day before")
 * 
 * Run with: npx tsx scripts/test-1-day-before-rule-working-day.ts
 */

import { generateTimesheetFromClockEntries } from "../lib/timesheet-auto-generator";
import { determineDayType, normalizeHolidays } from "../utils/holidays";

const holidays2025 = [
  { holiday_date: "2025-12-24", holiday_type: "non-working", name: "Christmas Eve" },
  { holiday_date: "2025-12-25", holiday_type: "regular", name: "Christmas Day" },
];

console.log("=".repeat(80));
console.log("'1 DAY BEFORE' RULE - WORKING DAY VERIFICATION");
console.log("=".repeat(80));
console.log();

// Test Case 1: Worked on Dec 23 (regular day) → Should be eligible for Dec 25
console.log("TEST 1: Worked on Dec 23 (Regular Working Day) → Eligible for Dec 25?");
console.log("-".repeat(80));

const workedRegularDayBeforeEntries = [
  {
    id: "1",
    employee_id: "test-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const workedRegularDayBeforeTimesheet = generateTimesheetFromClockEntries(
  workedRegularDayBeforeEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

console.log("Attendance Data:");
workedRegularDayBeforeTimesheet.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const dec25Entry1 = workedRegularDayBeforeTimesheet.attendance_data.find(d => d.date === "2025-12-25");
if (dec25Entry1) {
  console.log(`\nDec 25 Entry:`);
  console.log(`  Regular Hours: ${dec25Entry1.regularHours}`);
  if (dec25Entry1.regularHours === 8) {
    console.log(`  ✓ PASS: Eligible (worked regular day Dec 23)`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${dec25Entry1.regularHours}`);
  }
} else {
  console.log(`\n✗ FAIL: Dec 25 entry not found`);
}
console.log();

// Test Case 2: Worked on Dec 24 (holiday) but NOT Dec 23 → Should NOT be eligible for Dec 25
console.log("TEST 2: Worked on Dec 24 (Holiday) but NOT Dec 23 (Regular Day) → Eligible for Dec 25?");
console.log("-".repeat(80));

const workedHolidayButNotRegularDayEntries = [
  {
    id: "2",
    employee_id: "test-2",
    clock_in_time: "2025-12-24T08:00:00Z",
    clock_out_time: "2025-12-24T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
  // No entry for Dec 23
];

const workedHolidayButNotRegularDayTimesheet = generateTimesheetFromClockEntries(
  workedHolidayButNotRegularDayEntries as any,
  new Date("2025-12-24"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

console.log("Attendance Data:");
workedHolidayButNotRegularDayTimesheet.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const dec25Entry2 = workedHolidayButNotRegularDayTimesheet.attendance_data.find(d => d.date === "2025-12-25");
if (dec25Entry2) {
  console.log(`\nDec 25 Entry:`);
  console.log(`  Regular Hours: ${dec25Entry2.regularHours}`);
  console.log(`  Expected: 0 hours (Dec 24 is a holiday, not a regular working day)`);
  if (dec25Entry2.regularHours === 0) {
    console.log(`  ✓ PASS: Correctly NOT eligible (Dec 24 is holiday, not regular working day)`);
  } else {
    console.log(`  ✗ FAIL: Expected 0 hours, got ${dec25Entry2.regularHours}`);
    console.log(`  ⚠️  ISSUE: The rule should check for a REGULAR WORKING DAY, not just any day`);
  }
} else {
  console.log(`\n✓ PASS: Dec 25 entry correctly not created (not eligible)`);
}
console.log();

// Test Case 3: Worked on Dec 22 (regular day) → Should be eligible for Dec 25
console.log("TEST 3: Worked on Dec 22 (Regular Working Day) → Eligible for Dec 25?");
console.log("-".repeat(80));

const workedDec22Entries = [
  {
    id: "3",
    employee_id: "test-3",
    clock_in_time: "2025-12-22T08:00:00Z",
    clock_out_time: "2025-12-22T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const workedDec22Timesheet = generateTimesheetFromClockEntries(
  workedDec22Entries as any,
  new Date("2025-12-22"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

console.log("Attendance Data:");
workedDec22Timesheet.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const dec25Entry3 = workedDec22Timesheet.attendance_data.find(d => d.date === "2025-12-25");
if (dec25Entry3) {
  console.log(`\nDec 25 Entry:`);
  console.log(`  Regular Hours: ${dec25Entry3.regularHours}`);
  console.log(`  Note: Dec 24 is between Dec 22 and Dec 25, but Dec 24 is a holiday`);
  console.log(`  The rule should check the IMMEDIATELY PRECEDING WORKING DAY`);
  if (dec25Entry3.regularHours === 8) {
    console.log(`  ✓ PASS: Eligible (worked regular day Dec 22)`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${dec25Entry3.regularHours}`);
  }
} else {
  console.log(`\n✗ FAIL: Dec 25 entry not found`);
}
console.log();

// Summary
console.log("=".repeat(80));
console.log("VERIFICATION SUMMARY");
console.log("=".repeat(80));
console.log();
console.log("'1 Day Before' Rule Requirements:");
console.log("1. Must be a REGULAR WORKING DAY (not a holiday)");
console.log("2. Must have worked FULL 8 HOURS");
console.log("3. Should check the IMMEDIATELY PRECEDING WORKING DAY");
console.log();
console.log("Current Implementation:");
console.log("- Checks if previous day has regular_hours >= 8");
console.log("- Does NOT verify if previous day is a regular working day");
console.log("- ⚠️  May need update to check for regular working day specifically");
console.log();
console.log("=".repeat(80));