/**
 * Comprehensive Payslip Integration Test for All Employee Roles
 * 
 * Tests the complete flow from time entries to payslip calculations:
 * 1. Time Clock Entries → Weekly Attendance
 * 2. Weekly Attendance → Payslip Calculations
 * 
 * Tests all employee types:
 * - Rank and File (Office-based)
 * - Account Supervisors (Client-based)
 * - Account Supervisors (Office-based)
 * - Supervisory (Office-based)
 * - Managerial (Office-based)
 * 
 * Run with: npx tsx scripts/test-payslip-integration-all-roles.ts
 */

import { generateTimesheetFromClockEntries } from "../lib/timesheet-auto-generator";
import { calculateWeeklyPayroll } from "../utils/payroll-calculator";
import { normalizeHolidays } from "../utils/holidays";

// Mock holidays data
const holidays2025 = [
  { holiday_date: "2025-12-24", holiday_type: "non-working", name: "Christmas Eve" },
  { holiday_date: "2025-12-25", holiday_type: "regular", name: "Christmas Day" },
  { holiday_date: "2025-12-30", holiday_type: "regular", name: "Rizal Day" },
  { holiday_date: "2025-12-31", holiday_type: "non-working", name: "New Year's Eve" },
];

const ratePerHour = 100;

// Helper function to calculate fixed allowances (simulating payslip logic)
function calculateFixedAllowances(
  attendanceData: any[],
  isClientBased: boolean,
  isAccountSupervisor: boolean,
  isEligibleForAllowances: boolean
): number {
  let totalFixedAllowances = 0;

  attendanceData.forEach((day: any) => {
    const dayType = day.dayType || "regular";
    const overtimeHours = typeof day.overtimeHours === "string"
      ? parseFloat(day.overtimeHours)
      : day.overtimeHours || 0;

    // Regular OT allowance
    if (dayType === "regular" && overtimeHours > 0) {
      // Client-based employees and Office-based Supervisory/Managerial: First 2 hours = ₱200, then ₱100 per succeeding hour
      if (isClientBased || isEligibleForAllowances) {
        if (overtimeHours >= 2) {
          // First 2 hours = ₱200, then ₱100 per succeeding hour
          totalFixedAllowances += 200 + Math.max(0, overtimeHours - 2) * 100;
        }
      }
    }

    // Holiday/Rest Day OT allowance
    const isHolidayOrRestDay =
      dayType === "sunday" ||
      dayType === "regular-holiday" ||
      dayType === "non-working-holiday" ||
      dayType === "sunday-special-holiday" ||
      dayType === "sunday-regular-holiday";

    if (isHolidayOrRestDay && overtimeHours > 0) {
      if (overtimeHours >= 8) {
        totalFixedAllowances += 700;
      } else if (overtimeHours >= 4) {
        totalFixedAllowances += 350;
      }
    }
  });

  return totalFixedAllowances;
}

// Helper function to recalculate gross pay for Account Supervisors/Supervisory
function recalculateGrossPayForAllowances(
  attendanceData: any[],
  ratePerHour: number,
  isClientBased: boolean,
  isAccountSupervisor: boolean,
  isEligibleForAllowances: boolean
): number {
  let basicPay = 0;
  let holidayRestDayPay = 0;

  attendanceData.forEach((day: any) => {
    const dayType = day.dayType || "regular";
    const regularHours = day.regularHours || 0;
    const hoursToPay = regularHours > 0 ? regularHours : 8;

    if (dayType === "regular") {
      basicPay += hoursToPay * ratePerHour;
    } else if (
      dayType === "regular-holiday" ||
      dayType === "non-working-holiday" ||
      dayType === "sunday" ||
      dayType === "sunday-special-holiday" ||
      dayType === "sunday-regular-holiday"
    ) {
      // For Account Supervisors/Supervisory: Daily rate only (1.0x)
      if (isClientBased || isEligibleForAllowances) {
        if (regularHours > 0 || dayType === "sunday") {
          // Only pay if they worked (or for Sunday if rank and file)
          holidayRestDayPay += hoursToPay * ratePerHour;
        }
      } else {
        // Rank and File: Standard multipliers
        if (dayType === "regular-holiday") {
          holidayRestDayPay += regularHours > 0 ? hoursToPay * ratePerHour * 2.0 : hoursToPay * ratePerHour;
        } else if (dayType === "non-working-holiday") {
          holidayRestDayPay += regularHours > 0 ? hoursToPay * ratePerHour * 1.3 : hoursToPay * ratePerHour;
        } else if (dayType === "sunday") {
          holidayRestDayPay += hoursToPay * ratePerHour * 1.3;
        }
      }
    }
  });

  return basicPay + holidayRestDayPay;
}

console.log("=".repeat(80));
console.log("COMPREHENSIVE PAYSLIP INTEGRATION TEST - ALL EMPLOYEE ROLES");
console.log("=".repeat(80));
console.log();

// Test Case 1: Rank and File - Regular Day with OT and ND
console.log("TEST 1: Rank and File Employee - Regular Day with OT and ND");
console.log("-".repeat(80));

const rankAndFileEntries = [
  {
    id: "1",
    employee_id: "rank-file-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 3,
    total_night_diff_hours: 2,
    status: "approved",
  },
];

const rankAndFileTimesheet = generateTimesheetFromClockEntries(
  rankAndFileEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-23"),
  holidays2025,
  undefined,
  true,
  true
);

const rankAndFilePayroll = calculateWeeklyPayroll(
  rankAndFileTimesheet.attendance_data,
  ratePerHour
);

console.log("Attendance Data:", JSON.stringify(rankAndFileTimesheet.attendance_data, null, 2));
console.log("Payroll Calculation:");
console.log(`  Regular Pay: ₱${rankAndFilePayroll.totals.regularPay.toFixed(2)}`);
console.log(`  OT Pay: ₱${rankAndFilePayroll.totals.overtimePay.toFixed(2)}`);
console.log(`  ND Pay: ₱${rankAndFilePayroll.totals.nightDiffPay.toFixed(2)}`);
console.log(`  Gross Pay: ₱${rankAndFilePayroll.grossPay.toFixed(2)}`);

const expectedRankAndFile = 800 + 375 + 20; // Regular: 800, OT: 375, ND: 20
console.log(`  Expected: ₱${expectedRankAndFile.toFixed(2)}`);
const rankAndFileMatch = Math.abs(rankAndFilePayroll.grossPay - expectedRankAndFile) < 0.01;
console.log(`  Match: ${rankAndFileMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 2: Account Supervisor (Client-based) - Regular Day with OT
console.log("TEST 2: Account Supervisor (Client-based) - Regular Day with OT");
console.log("-".repeat(80));

const clientBasedASEntries = [
  {
    id: "2",
    employee_id: "client-as-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 4,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const clientBasedASTimesheet = generateTimesheetFromClockEntries(
  clientBasedASEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-23"),
  holidays2025,
  undefined,
  true,
  false
);

const clientBasedASPayroll = calculateWeeklyPayroll(
  clientBasedASTimesheet.attendance_data,
  ratePerHour
);

// Recalculate for Account Supervisors
const clientBasedASBasicPay = recalculateGrossPayForAllowances(
  clientBasedASTimesheet.attendance_data,
  ratePerHour,
  true,  // isClientBased
  true,  // isAccountSupervisor
  true   // isEligibleForAllowances
);

const clientBasedASFixedAllowances = calculateFixedAllowances(
  clientBasedASTimesheet.attendance_data,
  true,  // isClientBased
  true,  // isAccountSupervisor
  true   // isEligibleForAllowances
);

console.log("Attendance Data:", JSON.stringify(clientBasedASTimesheet.attendance_data, null, 2));
console.log("Payroll Calculation:");
console.log(`  Basic Pay: ₱${clientBasedASBasicPay.toFixed(2)}`);
console.log(`  OT Allowance (Fixed): ₱${clientBasedASFixedAllowances.toFixed(2)}`);
console.log(`  Total Gross Pay: ₱${(clientBasedASBasicPay + clientBasedASFixedAllowances).toFixed(2)}`);

const expectedClientBasedAS = 800 + 400; // Basic: 800, OT Allowance: 400 (200 + (4-2)*100)
console.log(`  Expected: ₱${expectedClientBasedAS.toFixed(2)}`);
const clientBasedASMatch = Math.abs((clientBasedASBasicPay + clientBasedASFixedAllowances) - expectedClientBasedAS) < 0.01;
console.log(`  Match: ${clientBasedASMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 3: Account Supervisor (Office-based) - Regular Day with OT
console.log("TEST 3: Account Supervisor (Office-based) - Regular Day with OT");
console.log("-".repeat(80));

const officeBasedASEntries = [
  {
    id: "3",
    employee_id: "office-as-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 3,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const officeBasedASTimesheet = generateTimesheetFromClockEntries(
  officeBasedASEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-23"),
  holidays2025,
  undefined,
  true,
  false
);

const officeBasedASBasicPay = recalculateGrossPayForAllowances(
  officeBasedASTimesheet.attendance_data,
  ratePerHour,
  false, // isClientBased
  true,  // isAccountSupervisor
  true   // isEligibleForAllowances
);

const officeBasedASFixedAllowances = calculateFixedAllowances(
  officeBasedASTimesheet.attendance_data,
  false, // isClientBased
  true,  // isAccountSupervisor
  true   // isEligibleForAllowances
);

console.log("Attendance Data:", JSON.stringify(officeBasedASTimesheet.attendance_data, null, 2));
console.log("Payroll Calculation:");
console.log(`  Basic Pay: ₱${officeBasedASBasicPay.toFixed(2)}`);
console.log(`  OT Allowance (Fixed): ₱${officeBasedASFixedAllowances.toFixed(2)}`);
console.log(`  Total Gross Pay: ₱${(officeBasedASBasicPay + officeBasedASFixedAllowances).toFixed(2)}`);

const expectedOfficeBasedAS = 800 + 300; // Basic: 800, OT Allowance: 300 (200 + (3-2)*100)
console.log(`  Expected: ₱${expectedOfficeBasedAS.toFixed(2)}`);
const officeBasedASMatch = Math.abs((officeBasedASBasicPay + officeBasedASFixedAllowances) - expectedOfficeBasedAS) < 0.01;
console.log(`  Match: ${officeBasedASMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 4: Supervisory Employee - Regular Day with OT
console.log("TEST 4: Supervisory Employee (Office-based) - Regular Day with OT");
console.log("-".repeat(80));

const supervisoryEntries = [
  {
    id: "4",
    employee_id: "supervisory-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 4,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const supervisoryTimesheet = generateTimesheetFromClockEntries(
  supervisoryEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-23"),
  holidays2025,
  undefined,
  true,
  false
);

const supervisoryBasicPay = recalculateGrossPayForAllowances(
  supervisoryTimesheet.attendance_data,
  ratePerHour,
  false, // isClientBased
  false, // isAccountSupervisor
  true   // isEligibleForAllowances (supervisory)
);

const supervisoryFixedAllowances = calculateFixedAllowances(
  supervisoryTimesheet.attendance_data,
  false, // isClientBased
  false, // isAccountSupervisor
  true   // isEligibleForAllowances
);

console.log("Attendance Data:", JSON.stringify(supervisoryTimesheet.attendance_data, null, 2));
console.log("Payroll Calculation:");
console.log(`  Basic Pay: ₱${supervisoryBasicPay.toFixed(2)}`);
console.log(`  OT Allowance (Fixed): ₱${supervisoryFixedAllowances.toFixed(2)}`);
console.log(`  Total Gross Pay: ₱${(supervisoryBasicPay + supervisoryFixedAllowances).toFixed(2)}`);

const expectedSupervisory = 800 + 400; // Basic: 800, OT Allowance: 400 (200 + (4-2)*100)
console.log(`  Expected: ₱${expectedSupervisory.toFixed(2)}`);
const supervisoryMatch = Math.abs((supervisoryBasicPay + supervisoryFixedAllowances) - expectedSupervisory) < 0.01;
console.log(`  Match: ${supervisoryMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 5: Managerial Employee - Regular Day with OT
console.log("TEST 5: Managerial Employee (Office-based) - Regular Day with OT");
console.log("-".repeat(80));

const managerialEntries = [
  {
    id: "5",
    employee_id: "managerial-1",
    clock_in_time: "2025-12-23T08:00:00Z",
    clock_out_time: "2025-12-23T20:00:00Z",
    regular_hours: 8,
    overtime_hours: 5,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const managerialTimesheet = generateTimesheetFromClockEntries(
  managerialEntries as any,
  new Date("2025-12-23"),
  new Date("2025-12-23"),
  holidays2025,
  undefined,
  true,
  false
);

const managerialBasicPay = recalculateGrossPayForAllowances(
  managerialTimesheet.attendance_data,
  ratePerHour,
  false, // isClientBased
  false, // isAccountSupervisor
  true   // isEligibleForAllowances (managerial)
);

const managerialFixedAllowances = calculateFixedAllowances(
  managerialTimesheet.attendance_data,
  false, // isClientBased
  false, // isAccountSupervisor
  true   // isEligibleForAllowances
);

console.log("Attendance Data:", JSON.stringify(managerialTimesheet.attendance_data, null, 2));
console.log("Payroll Calculation:");
console.log(`  Basic Pay: ₱${managerialBasicPay.toFixed(2)}`);
console.log(`  OT Allowance (Fixed): ₱${managerialFixedAllowances.toFixed(2)}`);
console.log(`  Total Gross Pay: ₱${(managerialBasicPay + managerialFixedAllowances).toFixed(2)}`);

const expectedManagerial = 800 + 500; // Basic: 800, OT Allowance: 500 (200 + (5-2)*100)
console.log(`  Expected: ₱${expectedManagerial.toFixed(2)}`);
const managerialMatch = Math.abs((managerialBasicPay + managerialFixedAllowances) - expectedManagerial) < 0.01;
console.log(`  Match: ${managerialMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 6: Rank and File - Regular Holiday (Dec 25) with OT
console.log("TEST 6: Rank and File - Regular Holiday (Dec 25) with OT");
console.log("-".repeat(80));

const rankAndFileHolidayEntries = [
  {
    id: "6",
    employee_id: "rank-file-2",
    clock_in_time: "2025-12-25T08:00:00Z",
    clock_out_time: "2025-12-25T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 2,
    total_night_diff_hours: 1,
    status: "approved",
  },
];

const rankAndFileHolidayTimesheet = generateTimesheetFromClockEntries(
  rankAndFileHolidayEntries as any,
  new Date("2025-12-25"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  true
);

const rankAndFileHolidayPayroll = calculateWeeklyPayroll(
  rankAndFileHolidayTimesheet.attendance_data,
  ratePerHour
);

console.log("Day Type:", rankAndFileHolidayTimesheet.attendance_data[0]?.dayType);
console.log("Payroll Calculation:");
console.log(`  Holiday Pay: ₱${rankAndFileHolidayPayroll.totals.regularPay.toFixed(2)}`);
console.log(`  Holiday OT Pay: ₱${rankAndFileHolidayPayroll.totals.overtimePay.toFixed(2)}`);
console.log(`  Holiday ND Pay: ₱${rankAndFileHolidayPayroll.totals.nightDiffPay.toFixed(2)}`);
console.log(`  Gross Pay: ₱${rankAndFileHolidayPayroll.grossPay.toFixed(2)}`);

const expectedRankAndFileHoliday = 1600 + 520 + 10; // Holiday: 1600, OT: 520, ND: 10
console.log(`  Expected: ₱${expectedRankAndFileHoliday.toFixed(2)}`);
const rankAndFileHolidayMatch = Math.abs(rankAndFileHolidayPayroll.grossPay - expectedRankAndFileHoliday) < 0.01;
console.log(`  Match: ${rankAndFileHolidayMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 7: Account Supervisor (Client-based) - Regular Holiday (Dec 25) with OT
console.log("TEST 7: Account Supervisor (Client-based) - Regular Holiday (Dec 25) with OT");
console.log("-".repeat(80));

const clientBasedASHolidayEntries = [
  {
    id: "7",
    employee_id: "client-as-2",
    clock_in_time: "2025-12-25T08:00:00Z",
    clock_out_time: "2025-12-25T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 5,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const clientBasedASHolidayTimesheet = generateTimesheetFromClockEntries(
  clientBasedASHolidayEntries as any,
  new Date("2025-12-25"),
  new Date("2025-12-25"),
  holidays2025,
  undefined,
  true,
  false
);

const clientBasedASHolidayBasicPay = recalculateGrossPayForAllowances(
  clientBasedASHolidayTimesheet.attendance_data,
  ratePerHour,
  true,
  true,
  true
);

const clientBasedASHolidayFixedAllowances = calculateFixedAllowances(
  clientBasedASHolidayTimesheet.attendance_data,
  true,
  true,
  true
);

console.log("Day Type:", clientBasedASHolidayTimesheet.attendance_data[0]?.dayType);
console.log("Payroll Calculation:");
console.log(`  Holiday Pay (Daily Rate): ₱${clientBasedASHolidayBasicPay.toFixed(2)}`);
console.log(`  Holiday OT Allowance (Fixed): ₱${clientBasedASHolidayFixedAllowances.toFixed(2)}`);
console.log(`  Total Gross Pay: ₱${(clientBasedASHolidayBasicPay + clientBasedASHolidayFixedAllowances).toFixed(2)}`);

const expectedClientBasedASHoliday = 800 + 350; // Daily Rate: 800, OT Allowance: 350 (5 hours ≥ 4)
console.log(`  Expected: ₱${expectedClientBasedASHoliday.toFixed(2)}`);
const clientBasedASHolidayMatch = Math.abs((clientBasedASHolidayBasicPay + clientBasedASHolidayFixedAllowances) - expectedClientBasedASHoliday) < 0.01;
console.log(`  Match: ${clientBasedASHolidayMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Test Case 8: Account Supervisor (Client-based) - Special Non-Working Holiday (Dec 24) with OT
console.log("TEST 8: Account Supervisor (Client-based) - Special Non-Working Holiday (Dec 24) with OT");
console.log("-".repeat(80));

const clientBasedASSpecialHolidayEntries = [
  {
    id: "8",
    employee_id: "client-as-3",
    clock_in_time: "2025-12-24T08:00:00Z",
    clock_out_time: "2025-12-24T19:00:00Z",
    regular_hours: 8,
    overtime_hours: 4,
    total_night_diff_hours: 0,
    status: "approved",
  },
];

const clientBasedASSpecialHolidayTimesheet = generateTimesheetFromClockEntries(
  clientBasedASSpecialHolidayEntries as any,
  new Date("2025-12-24"),
  new Date("2025-12-24"),
  holidays2025,
  undefined,
  true,
  false
);

const clientBasedASSpecialHolidayBasicPay = recalculateGrossPayForAllowances(
  clientBasedASSpecialHolidayTimesheet.attendance_data,
  ratePerHour,
  true,
  true,
  true
);

const clientBasedASSpecialHolidayFixedAllowances = calculateFixedAllowances(
  clientBasedASSpecialHolidayTimesheet.attendance_data,
  true,
  true,
  true
);

console.log("Day Type:", clientBasedASSpecialHolidayTimesheet.attendance_data[0]?.dayType);
console.log("Payroll Calculation:");
console.log(`  Special Holiday Pay (Daily Rate): ₱${clientBasedASSpecialHolidayBasicPay.toFixed(2)}`);
console.log(`  Special Holiday OT Allowance (Fixed): ₱${clientBasedASSpecialHolidayFixedAllowances.toFixed(2)}`);
console.log(`  Total Gross Pay: ₱${(clientBasedASSpecialHolidayBasicPay + clientBasedASSpecialHolidayFixedAllowances).toFixed(2)}`);

const expectedClientBasedASSpecialHoliday = 800 + 350; // Daily Rate: 800, OT Allowance: 350 (4 hours ≥ 4)
console.log(`  Expected: ₱${expectedClientBasedASSpecialHoliday.toFixed(2)}`);
const clientBasedASSpecialHolidayMatch = Math.abs((clientBasedASSpecialHolidayBasicPay + clientBasedASSpecialHolidayFixedAllowances) - expectedClientBasedASSpecialHoliday) < 0.01;
console.log(`  Match: ${clientBasedASSpecialHolidayMatch ? "✓ PASS" : "✗ FAIL"}`);
console.log();

// Summary
console.log("=".repeat(80));
console.log("TEST SUMMARY");
console.log("=".repeat(80));

const allTests = [
  { name: "Rank and File - Regular Day", passed: rankAndFileMatch },
  { name: "Account Supervisor (Client-based) - Regular Day", passed: clientBasedASMatch },
  { name: "Account Supervisor (Office-based) - Regular Day", passed: officeBasedASMatch },
  { name: "Supervisory - Regular Day", passed: supervisoryMatch },
  { name: "Managerial - Regular Day", passed: managerialMatch },
  { name: "Rank and File - Regular Holiday", passed: rankAndFileHolidayMatch },
  { name: "Account Supervisor (Client-based) - Regular Holiday", passed: clientBasedASHolidayMatch },
  { name: "Account Supervisor (Client-based) - Special Holiday", passed: clientBasedASSpecialHolidayMatch },
];

const passed = allTests.filter(t => t.passed).length;
const failed = allTests.filter(t => !t.passed).length;

allTests.forEach(test => {
  console.log(`${test.passed ? "✓" : "✗"} ${test.name}`);
});

console.log();
console.log(`Total: ${allTests.length} tests`);
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed === 0) {
  console.log();
  console.log("✅ ALL TESTS PASSED!");
} else {
  console.log();
  console.log("⚠️  SOME TESTS FAILED - Please review the calculations");
}

console.log();
console.log("=".repeat(80));
