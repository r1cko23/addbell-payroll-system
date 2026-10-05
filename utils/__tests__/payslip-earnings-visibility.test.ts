import {
  employeeHasPayableRate,
  shouldShowPayslipEarningsBreakdown,
} from "@/lib/payslip-display";

describe("shouldShowPayslipEarningsBreakdown", () => {
  test("shows hours when attendance exists and every rate is zero", () => {
    expect(
      shouldShowPayslipEarningsBreakdown({
        attendanceDayCount: 5,
        perDay: null,
        ratePerDay: null,
        ratePerHour: null,
      })
    ).toBe(true);
  });

  test("hides the breakdown when the cutoff has no attendance days", () => {
    expect(
      shouldShowPayslipEarningsBreakdown({
        attendanceDayCount: 0,
        perDay: 576.92,
        ratePerDay: 576.92,
        ratePerHour: 72.12,
      })
    ).toBe(false);
  });

  test("shows the breakdown for one attendance day with a daily rate", () => {
    expect(
      shouldShowPayslipEarningsBreakdown({
        attendanceDayCount: 1,
        perDay: 500,
        ratePerDay: 500,
        ratePerHour: 62.5,
      })
    ).toBe(true);
  });
});

describe("employeeHasPayableRate", () => {
  test("monthly base rate of zero is not payable", () => {
    expect(
      employeeHasPayableRate({
        salaryBasis: "monthly",
        baseRate: 0,
        monthlyRate: null,
        perDay: null,
        ratePerDay: null,
        ratePerHour: null,
      })
    ).toBe(false);
  });

  test("a monthly base rate is payable", () => {
    expect(
      employeeHasPayableRate({
        salaryBasis: "monthly",
        baseRate: 15000,
        monthlyRate: 15000,
        perDay: 15000 / 26,
        ratePerDay: 15000 / 26,
        ratePerHour: 15000 / 26 / 8,
      })
    ).toBe(true);
  });

  test("a daily rate alone is payable", () => {
    expect(
      employeeHasPayableRate({
        salaryBasis: "daily",
        baseRate: 500,
        perDay: 500,
      })
    ).toBe(true);
  });

  test("an hourly rate alone is payable", () => {
    expect(
      employeeHasPayableRate({
        ratePerHour: 80,
      })
    ).toBe(true);
  });
});
