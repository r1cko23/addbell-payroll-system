import { computeDaysWork, WEEKLY_MAX_CUTOFF_HOURS } from "../attendance-cutoff";

describe("computeDaysWork", () => {
  test("rank-and-file: uses max(basePayHours, actualTotalBH)", () => {
    const result = computeDaysWork({
      basePayHours: 56,
      actualTotalBH: 48,
      renderedSpecialBH: 0,
      excludeWorkedSpecialDayFromDaysWork: false,
    });
    expect(result.totalBHForDaysWork).toBe(56);
    expect(result.daysWorked).toBe(7);
  });

  test("managerial: uses base minus rendered special hours", () => {
    const result = computeDaysWork({
      basePayHours: 64,
      actualTotalBH: 43,
      renderedSpecialBH: 8,
      excludeWorkedSpecialDayFromDaysWork: true,
    });
    expect(result.totalBHForDaysWork).toBe(56);
    expect(result.daysWorked).toBe(7);
  });

  test(`caps at ${WEEKLY_MAX_CUTOFF_HOURS} hours per weekly cutoff`, () => {
    const result = computeDaysWork({
      basePayHours: 80,
      actualTotalBH: 90,
      renderedSpecialBH: 0,
      excludeWorkedSpecialDayFromDaysWork: false,
    });
    expect(result.totalBHForDaysWork).toBe(WEEKLY_MAX_CUTOFF_HOURS);
  });
});
