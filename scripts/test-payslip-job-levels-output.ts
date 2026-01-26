/**
 * Test Payslip Output by Job Level
 *
 * Same attendance for all: 13 days work (12 regular + 1 legal holiday with 8h worked).
 * Shows: Days Work, Basic, Legal Holiday (hours, amount), Legal Holiday Allowance, Gross.
 *
 * Run: npx tsx scripts/test-payslip-job-levels-output.ts
 */

type DayType = "regular" | "regular-holiday" | "non-working-holiday";
type Day = {
  date: string;
  dayType: DayType;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
  clockInTime?: string;
  clockOutTime?: string;
};

const ratePerDay = 1307.69;
const ratePerHour = 163.46;

// Same attendance for everyone: 12 regular (8h) + 1 legal holiday (8h worked)
const attendanceData: Day[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    date: `2026-01-${String(i + 1).padStart(2, "0")}`,
    dayType: "regular" as DayType,
    regularHours: 8,
    overtimeHours: 0,
    nightDiffHours: 0,
    clockInTime: "08:00",
    clockOutTime: "17:00",
  })),
  {
    date: "2026-01-13",
    dayType: "regular-holiday" as DayType,
    regularHours: 8,
    overtimeHours: 0,
    nightDiffHours: 0,
    clockInTime: "08:00",
    clockOutTime: "17:00",
  },
];

// Eligible when worked on holiday (regularHours>0) or worked 8h on a regular day before
function isEligibleForHolidayPay(
  _date: string,
  regularHours: number,
  _attendanceData: Day[]
): boolean {
  if (regularHours > 0) return true;
  return true; // day-before exists in our scenarios
}

// Allowance for supervisory/managerial/AS: 8h=700, 4h=350
function holidayAllowance(hours: number): number {
  if (hours >= 8) return 700;
  if (hours >= 4) return 350;
  return 0;
}

type Profile = {
  name: string;
  isClientBased: boolean;
  isAccountSupervisor: boolean;
  isEligibleForAllowances: boolean;
  isRankAndFile: boolean;
};

const profiles: Profile[] = [
  {
    name: "RANK AND FILE (Office-based)",
    isClientBased: false,
    isAccountSupervisor: false,
    isEligibleForAllowances: false,
    isRankAndFile: true,
  },
  {
    name: "SUPERVISORY (Office-based)",
    isClientBased: false,
    isAccountSupervisor: false,
    isEligibleForAllowances: true,
    isRankAndFile: false,
  },
  {
    name: "MANAGERIAL (Office-based)",
    isClientBased: false,
    isAccountSupervisor: false,
    isEligibleForAllowances: true,
    isRankAndFile: false,
  },
  {
    name: "Account Supervisor (Client-based)",
    isClientBased: true,
    isAccountSupervisor: true,
    isEligibleForAllowances: true,
    isRankAndFile: false,
  },
];

function runScenario(attendance: Day[], scenarioName: string) {
  console.log("\n" + "=".repeat(90));
  console.log(`SCENARIO: ${scenarioName}`);
  console.log("=".repeat(90));

  // actualTotalBH: regular + eligible holidays (worked: actual h, else 8)
  const actualTotalBH = attendance.reduce((sum, d) => {
    if (d.dayType === "regular") return sum + d.regularHours;
    if (d.dayType === "regular-holiday" || d.dayType === "non-working-holiday") {
      if (isEligibleForHolidayPay(d.date, d.regularHours, attendance))
        return sum + (d.regularHours > 0 ? d.regularHours : 8);
    }
    return sum;
  }, 0);
  const daysWorked = actualTotalBH / 8;
  const basicSalary = Math.round(daysWorked * ratePerDay * 100) / 100;

  for (const p of profiles) {
    // Legal Holiday: only when regularHours > 0
    const legalDay = attendance.find((d) => d.dayType === "regular-holiday");
    const legalHours =
      legalDay && legalDay.regularHours > 0
        ? p.isClientBased || p.isEligibleForAllowances ? 8 : legalDay.regularHours
        : 0;
    const legalAmount =
      legalHours > 0 ? (legalHours / 8) * ratePerDay : 0;
    const legalAllowance =
      legalDay &&
      legalDay.regularHours >= 4 &&
      (p.isClientBased || p.isEligibleForAllowances) &&
      legalDay.clockInTime
        ? holidayAllowance(legalDay.regularHours)
        : 0;

    // Special Holiday: only when regularHours > 0. R&F: 0.3x; Allowance: (h/8)*ratePerDay
    const specialDay = attendance.find((d) => d.dayType === "non-working-holiday");
    const specialHours =
      specialDay && specialDay.regularHours > 0
        ? p.isClientBased || p.isEligibleForAllowances ? 8 : specialDay.regularHours
        : 0;
    const specialAmount =
      specialHours > 0
        ? p.isClientBased || p.isEligibleForAllowances
          ? (specialHours / 8) * ratePerDay
          : specialDay!.regularHours * ratePerHour * 0.3
        : 0;
    const specialAllowance =
      specialDay &&
      specialDay.regularHours >= 4 &&
      (p.isClientBased || p.isEligibleForAllowances) &&
      specialDay.clockInTime
        ? holidayAllowance(specialDay.regularHours)
        : 0;

    // Gross: R&F = Basic + OT/ND + Legal Holiday + Special Holiday (when worked); Supervisory/AS = Basic + allowances
    const gross =
      basicSalary +
      (p.isClientBased || p.isEligibleForAllowances
        ? legalAllowance + specialAllowance
        : legalAmount + specialAmount);

    console.log("\n" + "-".repeat(90));
    console.log(`  ${p.name}`);
    console.log("-".repeat(90));
    console.log(`  Days Work           : ${daysWorked.toFixed(2)}`);
    console.log(`  Basic Salary        : ₱${basicSalary.toFixed(2)}`);
    const legalNote = p.isRankAndFile ? "in Gross" : "display only";
    const specialNote = p.isRankAndFile ? "in Gross" : "display only";
    console.log(`  Legal Holiday       : #${legalHours.toFixed(2)} hrs   Amount: ₱${legalAmount.toFixed(2)} (${legalNote})`);
    if (legalHours > 0 && (p.isClientBased || p.isEligibleForAllowances)) {
      console.log(`  Legal Hol Allowance : ₱${legalAllowance.toFixed(2)}`);
    }
    console.log(`  Special Holiday     : #${specialHours.toFixed(2)} hrs   Amount: ₱${specialAmount.toFixed(2)} (${specialNote})`);
    if (specialHours > 0 && (p.isClientBased || p.isEligibleForAllowances)) {
      console.log(`  Special Hol Allowance: ₱${specialAllowance.toFixed(2)}`);
    }
    console.log(`  Gross Pay           : ₱${gross.toFixed(2)}`);
  }
}

// Scenario A: 13 days, 1 legal holiday WORKED 8h
runScenario(attendanceData, "13 days work (12 regular + 1 Legal Holiday with 8h worked)");

// Scenario B: 13 days, 1 legal holiday ELIGIBLE but DID NOT WORK (0h)
const attendanceNoWork: Day[] = attendanceData.map((d) =>
  d.dayType === "regular-holiday" ? { ...d, regularHours: 0, clockInTime: undefined, clockOutTime: undefined } : d
);
runScenario(attendanceNoWork, "13 days work (12 regular + 1 Legal Holiday eligible but 0h worked)");

// Scenario C: 12 regular + 1 Special Holiday 8h worked
const attendanceSpecial: Day[] = [
  ...attendanceData.filter((d) => d.dayType === "regular"),
  {
    date: "2026-01-13",
    dayType: "non-working-holiday" as DayType,
    regularHours: 8,
    overtimeHours: 0,
    nightDiffHours: 0,
    clockInTime: "08:00",
    clockOutTime: "17:00",
  },
];
runScenario(attendanceSpecial, "13 days work (12 regular + 1 Special Holiday with 8h worked)");

// Scenario D: 12 regular + 1 Legal (8h) + 1 Special (8h) = 14 days
const attendanceBoth: Day[] = [
  ...attendanceData.filter((d) => d.dayType === "regular"),
  {
    date: "2026-01-13",
    dayType: "regular-holiday" as DayType,
    regularHours: 8,
    overtimeHours: 0,
    nightDiffHours: 0,
    clockInTime: "08:00",
    clockOutTime: "17:00",
  },
  {
    date: "2026-01-14",
    dayType: "non-working-holiday" as DayType,
    regularHours: 8,
    overtimeHours: 0,
    nightDiffHours: 0,
    clockInTime: "08:00",
    clockOutTime: "17:00",
  },
];
runScenario(attendanceBoth, "14 days work (12 regular + 1 Legal Holiday 8h + 1 Special Holiday 8h)");

console.log("\n" + "=".repeat(90));
console.log("SUMMARY BY JOB LEVEL");
console.log("=".repeat(90));
console.log(`
  • RANK AND FILE: Legal/Special Holiday row shows hours and amount (extra 1x or 0.3x) only when they RENDERED WORK.
    Gross = Basic + OT/ND + Legal Holiday + Special Holiday (when worked).

  • SUPERVISORY / MANAGERIAL: Legal/Special Holiday row shows hours when worked; amount for display.
    Gross = Basic + Legal Holiday Allowance (₱700 for 8h, ₱350 for 4h) + other OT allowances.

  • Account Supervisor (Client-based): Same as Supervisory/Managerial (allowances).

  • Days Work: Includes all eligible days (regular + legal + special); when didn't work on a holiday, 8h is still counted if eligible.
`);
