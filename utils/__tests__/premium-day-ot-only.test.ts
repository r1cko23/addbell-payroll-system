import { describe, expect, test } from "vitest";
import {
  calculateDailyPay,
  calculateNightDiff,
  calculateNonWorkingHolidayOT,
  overtimeAndNightDiffPay,
  type DayType,
} from "@/utils/payroll-calculator";

const RATE = 100; // per hour

// Day premium m: first 8 hours worked at m, hours past 8 at m x 1.3 (DOLE).
const cases: Array<[DayType, number]> = [
  ["non-working-holiday", 1.3],
  ["sunday-special-holiday", 1.5],
  ["sunday", 1.3],
  ["regular-holiday", 2],
  ["sunday-regular-holiday", 2.6],
];

describe("rest day or holiday worked only through an approved OT request", () => {
  for (const [dayType, m] of cases) {
    for (const hours of [4, 8, 9, 10]) {
      test(`${dayType}, ${hours}h`, () => {
        const firstEight = Math.min(8, hours);
        const past = hours - firstEight;
        const pay = calculateDailyPay(dayType, 0, hours, 0, RATE);
        expect(pay.regularPay).toBeCloseTo(firstEight * RATE * m);
        expect(pay.overtimePay).toBeCloseTo(past * RATE * m * 1.3);
        expect(pay.total).toBeCloseTo(pay.regularPay + pay.overtimePay);
      });
    }
  }

  test("night hours inside the first 8 get 10% of the day rate", () => {
    const pay = calculateDailyPay("non-working-holiday", 0, 8, 3, RATE);
    expect(pay.nightDiffPay).toBeCloseTo(3 * RATE * 1.3 * 0.1);
  });

  test("night hours past 8 get 10% of the day OT rate (Nov 2: 7 PM-4 AM, 6 night hours)", () => {
    // 9h shift ending at 4 AM: hour 9 (3-4 AM) is past 8, so 5 night hours inside, 1 past.
    const pay = calculateDailyPay("non-working-holiday", 0, 9, 6, RATE);
    expect(pay.nightDiffPay).toBeCloseTo(5 * RATE * 1.3 * 0.1 + 1 * RATE * 1.3 * 1.3 * 0.1);
    expect(pay.total).toBeCloseTo(8 * 130 + 1 * 169 + pay.nightDiffPay);
  });

  test("Sunday + special day, 10h (Nov 1)", () => {
    const pay = calculateDailyPay("sunday-special-holiday", 0, 10, 0, RATE);
    expect(pay.total).toBeCloseTo(8 * 150 + 2 * 195);
  });
});

describe("unchanged cases", () => {
  test("holiday with a regular punch and OT on top keeps its pay", () => {
    const pay = calculateDailyPay("non-working-holiday", 8, 2, 1, RATE);
    expect(pay.regularPay).toBeCloseTo(8 * 130);
    expect(pay.overtimePay).toBeCloseTo(2 * 169);
    expect(pay.nightDiffPay).toBeCloseTo(1 * RATE * 0.1);
  });

  test("regular day OT-only keeps regular OT pricing", () => {
    const pay = calculateDailyPay("regular", 0, 3, 1, RATE);
    expect(pay.regularPay).toBe(0);
    expect(pay.overtimePay).toBeCloseTo(3 * 125);
    expect(pay.nightDiffPay).toBeCloseTo(10);
  });

  test("unworked holiday credit (no OT) is not affected", () => {
    const pay = calculateDailyPay("regular-holiday", 4, 0, 0, RATE);
    expect(pay.regularPay).toBeCloseTo(800);
  });
});

describe("overtimeAndNightDiffPay (payslip screen and print lines)", () => {
  test("OT-only special day: OT line carries the day-rate 8h plus the OT hour", () => {
    const { overtimePay, nightDiffPay } = overtimeAndNightDiffPay("non-working-holiday", 0, 9, 6, RATE);
    const day = calculateDailyPay("non-working-holiday", 0, 9, 6, RATE);
    expect(overtimePay + nightDiffPay).toBeCloseTo(day.total);
  });

  test("punched holiday with OT on top matches the old per-type OT and ND", () => {
    const { overtimePay, nightDiffPay } = overtimeAndNightDiffPay("non-working-holiday", 8, 2, 1, RATE);
    expect(overtimePay).toBeCloseTo(calculateNonWorkingHolidayOT(2, RATE));
    expect(nightDiffPay).toBeCloseTo(calculateNightDiff(1, RATE));
  });
});
