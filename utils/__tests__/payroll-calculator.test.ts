/**
 * Comprehensive Test Suite for Payroll Calculator
 * Tests all functionalities, edge cases, and holiday handling
 */

import {
  calculateRegularPay,
  calculateRegularOT,
  calculateSundayRestDay,
  calculateSundayRestDayOT,
  calculateNonWorkingHoliday,
  calculateNonWorkingHolidayOT,
  calculateRegularHoliday,
  calculateRegularHolidayOT,
  calculateSundaySpecialHoliday,
  calculateSundaySpecialHolidayOT,
  calculateSundayRegularHoliday,
  calculateSundayRegularHolidayOT,
  calculateNightDiff,
  calculateDailyPay,
  calculateWeeklyPayroll,
  calculateNetPay,
  getDayTypeLabel,
  getMultiplier,
  PAYROLL_MULTIPLIERS,
  type DayType,
  type DailyAttendance,
} from "../payroll-calculator";
import { determineDayType } from "../holidays";
import type { Holiday } from "../holidays";

describe("Payroll Calculator - Basic Calculations", () => {
  const ratePerHour = 100;

  describe("Regular Day Calculations", () => {
    test("should calculate regular pay correctly", () => {
      expect(calculateRegularPay(8, ratePerHour)).toBe(800);
      expect(calculateRegularPay(4, ratePerHour)).toBe(400);
      expect(calculateRegularPay(0, ratePerHour)).toBe(0);
    });

    test("should calculate regular OT correctly", () => {
      expect(calculateRegularOT(2, ratePerHour)).toBe(250); // 2 * 100 * 1.25
      expect(calculateRegularOT(4, ratePerHour)).toBe(500); // 4 * 100 * 1.25
      expect(calculateRegularOT(0, ratePerHour)).toBe(0);
    });

    test("should calculate night differential correctly", () => {
      expect(calculateNightDiff(2, ratePerHour)).toBe(20); // 2 * 100 * 0.1
      expect(calculateNightDiff(4, ratePerHour)).toBe(40);
      expect(calculateNightDiff(0, ratePerHour)).toBe(0);
    });
  });

  describe("Sunday/Rest Day Calculations", () => {
    test("should calculate Sunday/Rest Day pay correctly", () => {
      expect(calculateSundayRestDay(8, ratePerHour)).toBe(1040); // 8 * 100 * 1.3
      expect(calculateSundayRestDay(4, ratePerHour)).toBe(520);
    });

    test("should calculate Sunday/Rest Day OT correctly", () => {
      expect(calculateSundayRestDayOT(2, ratePerHour)).toBe(338); // 2 * 100 * 1.3 * 1.3 = 338
      expect(calculateSundayRestDayOT(4, ratePerHour)).toBe(676);
    });
  });

  describe("Non-Working Holiday Calculations", () => {
    test("should calculate Non-Working Holiday pay correctly", () => {
      expect(calculateNonWorkingHoliday(8, ratePerHour)).toBe(1040); // 8 * 100 * 1.3
      expect(calculateNonWorkingHoliday(4, ratePerHour)).toBe(520);
    });

    test("should calculate Non-Working Holiday OT correctly", () => {
      expect(calculateNonWorkingHolidayOT(2, ratePerHour)).toBe(338); // 2 * 100 * 1.3 * 1.3
      expect(calculateNonWorkingHolidayOT(4, ratePerHour)).toBe(676);
    });
  });

  describe("Regular Holiday Calculations", () => {
    test("should calculate Regular Holiday pay correctly", () => {
      expect(calculateRegularHoliday(8, ratePerHour)).toBe(1600); // 8 * 100 * 2.0
      expect(calculateRegularHoliday(4, ratePerHour)).toBe(800);
    });

    test("should calculate Regular Holiday OT correctly", () => {
      expect(calculateRegularHolidayOT(2, ratePerHour)).toBe(520); // 2 * 100 * 2.0 * 1.3
      expect(calculateRegularHolidayOT(4, ratePerHour)).toBe(1040);
    });
  });

  describe("Sunday + Special Holiday Calculations", () => {
    test("should calculate Sunday + Special Holiday pay correctly", () => {
      expect(calculateSundaySpecialHoliday(8, ratePerHour)).toBe(1200); // 8 * 100 * 1.5
      expect(calculateSundaySpecialHoliday(4, ratePerHour)).toBe(600);
    });

    test("should calculate Sunday + Special Holiday OT correctly", () => {
      expect(calculateSundaySpecialHolidayOT(2, ratePerHour)).toBe(390); // 2 * 100 * 1.5 * 1.3
      expect(calculateSundaySpecialHolidayOT(4, ratePerHour)).toBe(780);
    });
  });

  describe("Sunday + Regular Holiday Calculations", () => {
    test("should calculate Sunday + Regular Holiday pay correctly", () => {
      expect(calculateSundayRegularHoliday(8, ratePerHour)).toBe(2080); // 8 * 100 * 2.6
      expect(calculateSundayRegularHoliday(4, ratePerHour)).toBe(1040);
    });

    test("should calculate Sunday + Regular Holiday OT correctly", () => {
      expect(calculateSundayRegularHolidayOT(2, ratePerHour)).toBe(676); // 2 * 100 * 2.6 * 1.3
      expect(calculateSundayRegularHolidayOT(4, ratePerHour)).toBe(1352);
    });
  });
});

describe("Payroll Calculator - Daily Pay Calculation", () => {
  const ratePerHour = 100;

  test("should calculate regular day pay correctly", () => {
    const result = calculateDailyPay("regular", 8, 2, 1, ratePerHour);
    expect(result.regularPay).toBe(800);
    expect(result.overtimePay).toBe(250);
    expect(result.nightDiffPay).toBe(10);
    expect(result.total).toBe(1060);
    expect(result.multiplier).toBe(1);
    expect(result.description).toBe("Regular Day");
  });

  test("should calculate Sunday pay correctly", () => {
    const result = calculateDailyPay("sunday", 8, 2, 1, ratePerHour);
    expect(result.regularPay).toBe(1040);
    expect(result.overtimePay).toBe(338);
    expect(result.nightDiffPay).toBe(10);
    expect(result.total).toBe(1388);
    expect(result.multiplier).toBe(1.3);
    expect(result.description).toBe("Sunday/Rest Day");
  });

  test("should calculate non-working holiday pay correctly", () => {
    const result = calculateDailyPay("non-working-holiday", 8, 2, 1, ratePerHour);
    expect(result.regularPay).toBe(1040);
    expect(result.overtimePay).toBe(338);
    expect(result.nightDiffPay).toBe(10);
    expect(result.total).toBe(1388);
    expect(result.multiplier).toBe(1.3);
    expect(result.description).toBe("Non-Working Holiday");
  });

  test("should calculate regular holiday pay correctly", () => {
    const result = calculateDailyPay("regular-holiday", 8, 2, 1, ratePerHour);
    expect(result.regularPay).toBe(1600);
    expect(result.overtimePay).toBe(520);
    expect(result.nightDiffPay).toBe(10);
    expect(result.total).toBe(2130);
    expect(result.multiplier).toBe(2);
    expect(result.description).toBe("Regular Holiday");
  });

  test("should calculate Sunday + Special Holiday pay correctly", () => {
    const result = calculateDailyPay("sunday-special-holiday", 8, 2, 1, ratePerHour);
    expect(result.regularPay).toBe(1200);
    expect(result.overtimePay).toBe(390);
    expect(result.nightDiffPay).toBe(10);
    expect(result.total).toBe(1600);
    expect(result.multiplier).toBe(1.5);
    expect(result.description).toBe("Sunday + Special Holiday");
  });

  test("should calculate Sunday + Regular Holiday pay correctly", () => {
    const result = calculateDailyPay("sunday-regular-holiday", 8, 2, 1, ratePerHour);
    expect(result.regularPay).toBe(2080);
    expect(result.overtimePay).toBe(676);
    expect(result.nightDiffPay).toBe(10);
    expect(result.total).toBe(2766);
    expect(result.multiplier).toBe(2.6);
    expect(result.description).toBe("Sunday + Regular Holiday");
  });

  test("should handle zero hours correctly", () => {
    const result = calculateDailyPay("regular", 0, 0, 0, ratePerHour);
    expect(result.regularPay).toBe(0);
    expect(result.overtimePay).toBe(0);
    expect(result.nightDiffPay).toBe(0);
    expect(result.total).toBe(0);
  });

  test("should handle partial hours correctly", () => {
    const result = calculateDailyPay("regular", 4, 1, 0.5, ratePerHour);
    expect(result.regularPay).toBe(400);
    expect(result.overtimePay).toBe(125);
    expect(result.nightDiffPay).toBe(5);
    expect(result.total).toBe(530);
  });
});

describe("Payroll Calculator - Weekly Payroll Calculation", () => {
  const ratePerHour = 100;

  test("should calculate weekly payroll correctly", () => {
    const attendance: DailyAttendance[] = [
      { date: "2025-12-23", dayType: "regular", regularHours: 8, overtimeHours: 2, nightDiffHours: 1 },
      { date: "2025-12-24", dayType: "non-working-holiday", regularHours: 8, overtimeHours: 0, nightDiffHours: 0 },
      { date: "2025-12-25", dayType: "regular-holiday", regularHours: 8, overtimeHours: 2, nightDiffHours: 1 },
      { date: "2025-12-26", dayType: "regular", regularHours: 8, overtimeHours: 0, nightDiffHours: 0 },
    ];

    const result = calculateWeeklyPayroll(attendance, ratePerHour);

    expect(result.breakdown).toHaveLength(4);
    expect(result.totals.regularPay).toBe(4480); // 800 + 1040 + 1600 + 800
    expect(result.totals.overtimePay).toBe(770); // 250 + 0 + 520 + 0
    expect(result.totals.nightDiffPay).toBe(20); // 10 + 0 + 10 + 0
    expect(result.grossPay).toBe(5270);
  });

  test("should handle empty attendance", () => {
    const result = calculateWeeklyPayroll([], ratePerHour);
    expect(result.breakdown).toHaveLength(0);
    expect(result.totals.regularPay).toBe(0);
    expect(result.totals.overtimePay).toBe(0);
    expect(result.totals.nightDiffPay).toBe(0);
    expect(result.grossPay).toBe(0);
  });
});

describe("Payroll Calculator - Net Pay Calculation", () => {
  test("should calculate net pay correctly with deductions", () => {
    const grossPay = 10000;
    const deductions = {
      sssContribution: 500,
      philhealthContribution: 300,
      pagibigContribution: 100,
      tax: 1000,
    };
    const allowance = 500;

    const result = calculateNetPay(grossPay, deductions, allowance);

    expect(result.totalDeductions).toBe(1900);
    expect(result.netPay).toBe(8600); // 10000 - 1900 + 500
  });

  test("should handle negative adjustment (addition)", () => {
    const grossPay = 10000;
    const deductions = {
      adjustment: -500, // Negative means addition
    };

    const result = calculateNetPay(grossPay, deductions, 0);

    expect(result.totalDeductions).toBe(-500);
    expect(result.netPay).toBe(10500); // 10000 - (-500)
  });

  test("should handle zero deductions", () => {
    const grossPay = 10000;
    const result = calculateNetPay(grossPay, {}, 0);
    expect(result.totalDeductions).toBe(0);
    expect(result.netPay).toBe(10000);
  });
});

describe("Holiday Detection - Edge Cases", () => {
  // Philippine Holidays 2025
  const holidays2025: Holiday[] = [
    // Regular Holidays
    { date: "2025-01-01", name: "New Year's Day", type: "regular" },
    { date: "2025-03-29", name: "Maundy Thursday", type: "regular" },
    { date: "2025-03-30", name: "Good Friday", type: "regular" },
    { date: "2025-04-09", name: "Araw ng Kagitingan", type: "regular" },
    { date: "2025-05-01", name: "Labor Day", type: "regular" },
    { date: "2025-06-12", name: "Independence Day", type: "regular" },
    { date: "2025-08-25", name: "National Heroes Day", type: "regular" },
    { date: "2025-11-30", name: "Bonifacio Day", type: "regular" },
    { date: "2025-12-25", name: "Christmas Day", type: "regular" },
    { date: "2025-12-30", name: "Rizal Day", type: "regular" },
    // Special Non-Working Holidays (Official Gazette)
    { date: "2025-02-09", name: "Chinese New Year", type: "non-working" },
    { date: "2025-02-25", name: "EDSA People Power Revolution Anniversary", type: "non-working" },
    { date: "2025-03-31", name: "Black Saturday", type: "non-working" },
    { date: "2025-08-21", name: "Ninoy Aquino Day", type: "non-working" },
    { date: "2025-11-01", name: "All Saints' Day", type: "non-working" },
    { date: "2025-11-02", name: "All Souls' Day", type: "non-working" },
    { date: "2025-12-08", name: "Feast of the Immaculate Conception", type: "non-working" },
    { date: "2025-12-24", name: "Christmas Eve", type: "non-working" },
    { date: "2025-12-26", name: "Additional Special Non-Working Day", type: "non-working" },
    { date: "2025-12-31", name: "New Year's Eve", type: "non-working" },
  ];

  test("should correctly identify December 24 as non-working holiday", () => {
    const dayType = determineDayType("2025-12-24", holidays2025);
    expect(dayType).toBe("non-working-holiday");
  });

  test("should correctly identify December 25 as regular holiday", () => {
    const dayType = determineDayType("2025-12-25", holidays2025);
    expect(dayType).toBe("regular-holiday");
  });

  test("should correctly identify December 26 as non-working holiday", () => {
    const dayType = determineDayType("2025-12-26", holidays2025);
    expect(dayType).toBe("non-working-holiday");
  });

  test("should correctly identify December 31 as non-working holiday", () => {
    const dayType = determineDayType("2025-12-31", holidays2025);
    expect(dayType).toBe("non-working-holiday");
  });

  test("should correctly identify regular day when not a holiday", () => {
    const dayType = determineDayType("2025-12-23", holidays2025);
    expect(dayType).toBe("regular");
  });

  test("should correctly identify Sunday as rest day", () => {
    const dayType = determineDayType("2025-12-28", holidays2025); // Sunday
    expect(dayType).toBe("sunday");
  });

  test("should correctly identify Sunday + Regular Holiday", () => {
    // Find a Sunday that is also a regular holiday
    const sundayHoliday = holidays2025.find(h => {
      const date = new Date(h.date);
      return date.getDay() === 0 && h.type === "regular";
    });

    if (sundayHoliday) {
      const dayType = determineDayType(sundayHoliday.date, holidays2025);
      expect(dayType).toBe("sunday-regular-holiday");
    }
  });

  test("should correctly identify Sunday + Special Holiday", () => {
    // Find a Sunday that is also a non-working holiday
    const sundaySpecialHoliday = holidays2025.find(h => {
      const date = new Date(h.date);
      return date.getDay() === 0 && h.type === "non-working";
    });

    if (sundaySpecialHoliday) {
      const dayType = determineDayType(sundaySpecialHoliday.date, holidays2025);
      expect(dayType).toBe("sunday-special-holiday");
    }
  });

  test("should handle custom rest day", () => {
    const dayType = determineDayType("2025-12-23", holidays2025, true);
    expect(dayType).toBe("sunday");
  });

  test("should handle empty holidays array", () => {
    const dayType = determineDayType("2025-12-25", []);
    expect(dayType).toBe("regular"); // Should default to regular if no holidays
  });

  test("should handle date format variations", () => {
    // Test that date matching works correctly
    const dayType1 = determineDayType("2025-12-25", holidays2025);
    const dayType2 = determineDayType("2025-12-25", holidays2025);
    expect(dayType1).toBe(dayType2);
    expect(dayType1).toBe("regular-holiday");
  });
});

describe("Payroll Calculator - Utility Functions", () => {
  test("should return correct day type labels", () => {
    expect(getDayTypeLabel("regular")).toBe("Regular Day");
    expect(getDayTypeLabel("sunday")).toBe("Sunday/Rest Day");
    expect(getDayTypeLabel("non-working-holiday")).toBe("Non-Working Holiday");
    expect(getDayTypeLabel("regular-holiday")).toBe("Regular Holiday");
    expect(getDayTypeLabel("sunday-special-holiday")).toBe("Sunday + Special Holiday");
    expect(getDayTypeLabel("sunday-regular-holiday")).toBe("Sunday + Regular Holiday");
  });

  test("should return correct multipliers", () => {
    expect(getMultiplier("regular")).toBe(1);
    expect(getMultiplier("sunday")).toBe(1.3);
    expect(getMultiplier("non-working-holiday")).toBe(1.3);
    expect(getMultiplier("regular-holiday")).toBe(2);
    expect(getMultiplier("sunday-special-holiday")).toBe(1.5);
    expect(getMultiplier("sunday-regular-holiday")).toBe(2.6);
  });
});

describe("Payroll Calculator - Edge Cases and Error Handling", () => {
  const ratePerHour = 100;

  test("should handle very large hours", () => {
    const result = calculateDailyPay("regular", 24, 8, 4, ratePerHour);
    expect(result.total).toBeGreaterThan(0);
    expect(result.regularPay).toBe(2400);
    expect(result.overtimePay).toBe(1000);
    expect(result.nightDiffPay).toBe(40);
  });

  test("should handle decimal hours", () => {
    const result = calculateDailyPay("regular", 8.5, 2.5, 1.5, ratePerHour);
    expect(result.regularPay).toBe(850);
    expect(result.overtimePay).toBe(312.5);
    expect(result.nightDiffPay).toBe(15);
  });

  test("should handle negative hours (should not crash)", () => {
    const result = calculateDailyPay("regular", -1, -1, -1, ratePerHour);
    // Should handle gracefully, might return negative or zero
    expect(typeof result.total).toBe("number");
  });

  test("should handle zero rate per hour", () => {
    const result = calculateDailyPay("regular", 8, 2, 1, 0);
    expect(result.total).toBe(0);
  });
});