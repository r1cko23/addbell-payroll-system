import { computePayslipHoursDisplay } from "../payslip-hours";

describe("computePayslipHoursDisplay", () => {
  test("rank-and-file: regular row excludes holiday; total matches attendance BH", () => {
    const result = computePayslipHoursDisplay({
      regularHoursWorked: 40,
      actualTotalBH: 44,
      isAllowanceTier: false,
      totalBHForDaysWork: 44,
      basePayHours: 48,
      premiumHolidayHours: 4,
      premiumSpecialHolidayHours: 0,
      premiumRestDayHours: 0,
      otHoursTotal: 0,
      hasPeriod: true,
    });

    expect(result.hoursWorkedRegular).toBe(40);
    expect(result.totalHoursWorked).toBe(44);
  });

  test("does not double-count holiday hours in total", () => {
    const result = computePayslipHoursDisplay({
      regularHoursWorked: 40,
      actualTotalBH: 44,
      isAllowanceTier: false,
      totalBHForDaysWork: 44,
      basePayHours: 48,
      premiumHolidayHours: 4,
      premiumSpecialHolidayHours: 0,
      premiumRestDayHours: 0,
      otHoursTotal: 0,
      hasPeriod: true,
    });

    expect(result.totalHoursWorked).not.toBe(48);
  });
});
