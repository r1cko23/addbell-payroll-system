/**
 * Payslip hours display — regular row vs total credited BH (matches Time Attendance).
 * Holiday/rest-day BH must not be counted twice (regular row + premium row + total).
 */

export function computePayslipHoursDisplay(input: {
  regularHoursWorked: number;
  actualTotalBH: number | null;
  isAllowanceTier: boolean;
  totalBHForDaysWork: number | null;
  basePayHours: number;
  premiumHolidayHours: number;
  premiumSpecialHolidayHours: number;
  premiumRestDayHours: number;
  otHoursTotal: number;
  hasPeriod: boolean;
}): { hoursWorkedRegular: number; totalHoursWorked: number } {
  const hoursWorkedRegular = input.isAllowanceTier
    ? (input.totalBHForDaysWork ??
      (input.hasPeriod ? input.regularHoursWorked : input.basePayHours))
    : input.regularHoursWorked;

  const creditedBhTotal =
    input.actualTotalBH ??
    input.regularHoursWorked +
      input.premiumHolidayHours +
      input.premiumSpecialHolidayHours +
      input.premiumRestDayHours;

  const totalHoursWorked =
    Math.round((creditedBhTotal + input.otHoursTotal) * 100) / 100;

  return { hoursWorkedRegular, totalHoursWorked };
}
