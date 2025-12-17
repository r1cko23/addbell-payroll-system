/**
 * Payroll Calculator
 * All formulas based on Philippine labor law
 */

export type DayType =
  | 'regular'
  | 'sunday'
  | 'non-working-holiday'
  | 'regular-holiday'
  | 'sunday-special-holiday'
  | 'sunday-regular-holiday';

export interface DailyAttendance {
  date: string;
  dayType: DayType;
  regularHours: number;
  overtimeHours: number;
  nightDiffHours: number;
}

export interface PayCalculation {
  regularPay: number;
  overtimePay: number;
  nightDiffPay: number;
  total: number;
  description: string;
  multiplier: number;
}

/**
 * Calculate Regular Overtime
 * Formula: HRS × RATE/HR × 1.25
 */
export function calculateRegularOT(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.25;
}

/**
 * Calculate Sunday/Rest Day Pay
 * Formula: HRS × RATE/HR × 1.3
 */
export function calculateSundayRestDay(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.3;
}

/**
 * Calculate Sunday/Rest Day Overtime
 * Formula: (HRS × RATE/HR × 1.3) × 1.3
 */
export function calculateSundayRestDayOT(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.3 * 1.3;
}

/**
 * Calculate Sunday + Special Holiday
 * Formula: HRS × RATE/HR × 1.5
 */
export function calculateSundaySpecialHoliday(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.5;
}

/**
 * Calculate Sunday + Special Holiday OT
 * Formula: (HRS × RATE/HR × 1.5) × 1.3
 */
export function calculateSundaySpecialHolidayOT(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.5 * 1.3;
}

/**
 * Calculate Sunday + Regular Holiday
 * Formula: HRS × RATE/HR × 2.6
 */
export function calculateSundayRegularHoliday(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 2.6;
}

/**
 * Calculate Sunday + Regular Holiday OT
 * Formula: (HRS × RATE/HR × 2.6) × 1.3
 */
export function calculateSundayRegularHolidayOT(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 2.6 * 1.3;
}

/**
 * Calculate Non-Working Holiday
 * Formula: HRS × RATE/HR × 1.3
 */
export function calculateNonWorkingHoliday(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.3;
}

/**
 * Calculate Non-Working Holiday OT
 * Formula: (HRS × RATE/HR × 1.3) × 1.3
 */
export function calculateNonWorkingHolidayOT(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 1.3 * 1.3;
}

/**
 * Calculate Regular Holiday
 * Formula: HRS × RATE/HR × 2
 */
export function calculateRegularHoliday(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 2;
}

/**
 * Calculate Regular Holiday OT
 * Formula: (HRS × RATE/HR × 2) × 1.3
 */
export function calculateRegularHolidayOT(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 2 * 1.3;
}

/**
 * Calculate Night Differential
 * Formula: HRS × RATE/HR × 0.1
 */
export function calculateNightDiff(hours: number, ratePerHour: number): number {
  return hours * ratePerHour * 0.1;
}

/**
 * Calculate Regular Pay
 * Formula: HRS × RATE/HR
 */
export function calculateRegularPay(hours: number, ratePerHour: number): number {
  return hours * ratePerHour;
}

/**
 * Calculate pay for a single day based on day type
 */
export function calculateDailyPay(
  dayType: DayType,
  regularHours: number,
  overtimeHours: number,
  nightDiffHours: number,
  ratePerHour: number
): PayCalculation {
  let regularPay = 0;
  let overtimePay = 0;
  let description = '';
  let multiplier = 1;

  switch (dayType) {
    case 'regular':
      regularPay = calculateRegularPay(regularHours, ratePerHour);
      overtimePay = calculateRegularOT(overtimeHours, ratePerHour);
      description = 'Regular Day';
      multiplier = 1;
      break;

    case 'sunday':
      regularPay = calculateSundayRestDay(regularHours, ratePerHour);
      overtimePay = calculateSundayRestDayOT(overtimeHours, ratePerHour);
      description = 'Sunday/Rest Day';
      multiplier = 1.3;
      break;

    case 'non-working-holiday':
      regularPay = calculateNonWorkingHoliday(regularHours, ratePerHour);
      overtimePay = calculateNonWorkingHolidayOT(overtimeHours, ratePerHour);
      description = 'Non-Working Holiday';
      multiplier = 1.3;
      break;

    case 'regular-holiday':
      regularPay = calculateRegularHoliday(regularHours, ratePerHour);
      overtimePay = calculateRegularHolidayOT(overtimeHours, ratePerHour);
      description = 'Regular Holiday';
      multiplier = 2;
      break;

    case 'sunday-special-holiday':
      regularPay = calculateSundaySpecialHoliday(regularHours, ratePerHour);
      overtimePay = calculateSundaySpecialHolidayOT(overtimeHours, ratePerHour);
      description = 'Sunday + Special Holiday';
      multiplier = 1.5;
      break;

    case 'sunday-regular-holiday':
      regularPay = calculateSundayRegularHoliday(regularHours, ratePerHour);
      overtimePay = calculateSundayRegularHolidayOT(overtimeHours, ratePerHour);
      description = 'Sunday + Regular Holiday';
      multiplier = 2.6;
      break;
  }

  const nightDiffPay = calculateNightDiff(nightDiffHours, ratePerHour);
  const total = regularPay + overtimePay + nightDiffPay;

  return {
    regularPay,
    overtimePay,
    nightDiffPay,
    total,
    description,
    multiplier,
  };
}

/**
 * Calculate weekly payroll
 */
export function calculateWeeklyPayroll(
  dailyAttendance: DailyAttendance[],
  ratePerHour: number
) {
  const breakdown = dailyAttendance.map((day) =>
    calculateDailyPay(
      day.dayType,
      day.regularHours,
      day.overtimeHours,
      day.nightDiffHours,
      ratePerHour
    )
  );

  const totals = breakdown.reduce(
    (acc, day) => ({
      regularPay: acc.regularPay + day.regularPay,
      overtimePay: acc.overtimePay + day.overtimePay,
      nightDiffPay: acc.nightDiffPay + day.nightDiffPay,
      total: acc.total + day.total,
    }),
    { regularPay: 0, overtimePay: 0, nightDiffPay: 0, total: 0 }
  );

  return {
    breakdown,
    totals,
    grossPay: totals.total,
  };
}

/**
 * Calculate net pay after deductions
 */
export function calculateNetPay(
  grossPay: number,
  deductions: {
    vale?: number;
    uniformPPE?: number;
    sssLoan?: number;
    sssCalamityLoan?: number;
    pagibigLoan?: number;
    pagibigCalamityLoan?: number;
    sssContribution?: number;
    philhealthContribution?: number;
    pagibigContribution?: number;
    tax?: number;
    adjustment?: number;
  },
  allowance: number = 0
): {
  netPay: number;
  totalDeductions: number;
  breakdown: Record<string, number>;
} {
  const breakdown: Record<string, number> = {};
  let totalDeductions = 0;

  // Add all deductions
  Object.entries(deductions).forEach(([key, value]) => {
    if (value && value > 0) {
      breakdown[key] = value;
      totalDeductions += value;
    }
  });

  // Handle negative adjustment (additions)
  if (deductions.adjustment && deductions.adjustment < 0) {
    totalDeductions += deductions.adjustment; // This will subtract since adjustment is negative
  }

  const netPay = grossPay - totalDeductions + allowance;

  return {
    netPay,
    totalDeductions,
    breakdown,
  };
}

/**
 * Get day type label
 */
export function getDayTypeLabel(dayType: DayType): string {
  const labels: Record<DayType, string> = {
    regular: 'Regular Day',
    sunday: 'Sunday/Rest Day',
    'non-working-holiday': 'Non-Working Holiday',
    'regular-holiday': 'Regular Holiday',
    'sunday-special-holiday': 'Sunday + Special Holiday',
    'sunday-regular-holiday': 'Sunday + Regular Holiday',
  };
  return labels[dayType];
}

/**
 * Get multiplier for day type
 */
export function getMultiplier(dayType: DayType): number {
  const multipliers: Record<DayType, number> = {
    regular: 1,
    sunday: 1.3,
    'non-working-holiday': 1.3,
    'regular-holiday': 2,
    'sunday-special-holiday': 1.5,
    'sunday-regular-holiday': 2.6,
  };
  return multipliers[dayType];
}

