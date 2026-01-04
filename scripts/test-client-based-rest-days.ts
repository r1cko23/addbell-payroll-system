/**
 * Test Client-Based Account Supervisor Rest Day Logic
 *
 * Verifies:
 * 1. Client-based Account Supervisors can have 2 rest days (flexible)
 * 2. Only 1 rest day gets paid at regular rate (like Saturday for office-based)
 * 3. The other rest day only gets paid if worked (like Sunday for office-based)
 *
 * Run with: npx tsx scripts/test-client-based-rest-days.ts
 */

import { generateTimesheetFromClockEntries } from "../lib/timesheet-auto-generator";

const holidays2025: Array<{ holiday_date: string; holiday_type: string }> = [];

console.log("=".repeat(80));
console.log("CLIENT-BASED ACCOUNT SUPERVISOR REST DAY LOGIC TEST");
console.log("=".repeat(80));
console.log();

// Test Case 1: Client-based Account Supervisor with 2 rest days
// Rest Day 1 (Monday) - Should be treated like Saturday (paid even if not worked)
// Rest Day 2 (Tuesday) - Should be treated like Sunday (only paid if worked)
console.log("TEST 1: Client-based Account Supervisor with 2 rest days");
console.log("  Rest Day 1 (Monday): Should be paid even if not worked (like Saturday)");
console.log("  Rest Day 2 (Tuesday): Only paid if worked (like Sunday)");
console.log("-".repeat(80));

// Create rest days map: Monday and Tuesday are rest days
const restDaysMap = new Map<string, boolean>();
restDaysMap.set("2025-12-22", true); // Monday - Rest Day 1
restDaysMap.set("2025-12-23", true); // Tuesday - Rest Day 2

// No clock entries (didn't work on rest days)
const noWorkEntries: any[] = [];

const timesheetNoWork = generateTimesheetFromClockEntries(
  noWorkEntries,
  new Date("2025-12-22"),
  new Date("2025-12-23"),
  holidays2025,
  restDaysMap,
  true,
  false,
  true // isClientBasedAccountSupervisor
);

console.log("Rest Days Map:", Array.from(restDaysMap.keys()));
console.log("Attendance Data (No work on rest days):");
timesheetNoWork.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const mondayDay = timesheetNoWork.attendance_data.find(d => d.date === "2025-12-22");
const tuesdayDay = timesheetNoWork.attendance_data.find(d => d.date === "2025-12-23");

if (mondayDay) {
  console.log(`\nMonday (Rest Day 1):`);
  console.log(`  Regular Hours: ${mondayDay.regularHours}`);
  console.log(`  Expected: 8 hours (paid even if not worked - like Saturday)`);
  if (mondayDay.regularHours === 8) {
    console.log(`  ✓ PASS: Correctly paid 8 hours even if not worked`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${mondayDay.regularHours}`);
  }
}

if (tuesdayDay) {
  console.log(`\nTuesday (Rest Day 2):`);
  console.log(`  Regular Hours: ${tuesdayDay.regularHours}`);
  console.log(`  Expected: 0 hours (only paid if worked - like Sunday)`);
  if (tuesdayDay.regularHours === 0) {
    console.log(`  ✓ PASS: Correctly NOT paid (didn't work)`);
  } else {
    console.log(`  ✗ FAIL: Expected 0 hours, got ${tuesdayDay.regularHours}`);
  }
}
console.log();

// Test Case 2: Client-based Account Supervisor worked on Rest Day 2
console.log("TEST 2: Client-based Account Supervisor worked on Rest Day 2 (Tuesday)");
console.log("-".repeat(80));

const workedRestDay2Entries = [
  {
    id: "1",
    employee_id: "client-as-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T17:00:00Z",
    regular_hours: 8,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const timesheetWorkedRestDay2 = generateTimesheetFromClockEntries(
  workedRestDay2Entries as any,
  new Date("2025-12-22"),
  new Date("2025-12-23"),
  holidays2025,
  restDaysMap,
  true,
  false,
  true // isClientBasedAccountSupervisor
);

console.log("Attendance Data (Worked on Rest Day 2):");
timesheetWorkedRestDay2.attendance_data.forEach((day) => {
  console.log(`  ${day.date} (${day.dayType}): ${day.regularHours}h regular`);
});

const mondayDay2 = timesheetWorkedRestDay2.attendance_data.find(d => d.date === "2025-12-22");
const tuesdayDay2 = timesheetWorkedRestDay2.attendance_data.find(d => d.date === "2025-12-23");

if (mondayDay2) {
  console.log(`\nMonday (Rest Day 1):`);
  console.log(`  Regular Hours: ${mondayDay2.regularHours}`);
  console.log(`  Expected: 8 hours (paid even if not worked - like Saturday)`);
  if (mondayDay2.regularHours === 8) {
    console.log(`  ✓ PASS: Correctly paid 8 hours even if not worked`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${mondayDay2.regularHours}`);
  }
}

if (tuesdayDay2) {
  console.log(`\nTuesday (Rest Day 2):`);
  console.log(`  Regular Hours: ${tuesdayDay2.regularHours}`);
  console.log(`  Expected: 8 hours (worked on rest day)`);
  if (tuesdayDay2.regularHours === 8) {
    console.log(`  ✓ PASS: Correctly paid for hours worked`);
  } else {
    console.log(`  ✗ FAIL: Expected 8 hours, got ${tuesdayDay2.regularHours}`);
  }
}
console.log();

// Summary
console.log("=".repeat(80));
console.log("TEST SUMMARY");
console.log("=".repeat(80));
console.log();
console.log("Client-based Account Supervisor Rest Day Rules:");
console.log("1. Can have 2 rest days (flexible, declared in schedule)");
console.log("2. Rest Day 1 (first chronologically): Paid even if not worked (like Saturday)");
console.log("3. Rest Day 2 (second chronologically): Only paid if worked (like Sunday)");
console.log();
console.log("=".repeat(80));