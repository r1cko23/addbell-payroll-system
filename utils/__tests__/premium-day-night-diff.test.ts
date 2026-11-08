import { describe, expect, it } from "vitest";
import { calculateDailyPay, overtimeAndNightDiffPay } from "@/utils/payroll-calculator";

// ₱800/day → ₱100/hour. DOLE: night differential is 10% of the hourly rate for that day;
// night hours that are also overtime get 10% of the overtime rate.
const RATE = 100;
const nd = (dayType: Parameters<typeof calculateDailyPay>[0], reg: number, ot: number, night: number) =>
  calculateDailyPay(dayType, reg, ot, night, RATE).nightDiffPay;

describe("night differential on worked holidays and rest days (regular punch)", () => {
  it.each([
    ["sunday", 1.3],
    ["non-working-holiday", 1.3],
    ["regular-holiday", 2],
    ["sunday-special-holiday", 1.5],
    ["sunday-regular-holiday", 2.6],
  ] as const)("%s: night hours inside the shift use the day rate (×%s)", (dayType, mult) => {
    expect(nd(dayType, 8, 0, 3)).toBeCloseTo(3 * RATE * mult * 0.1, 2);
  });

  it("night hours in overtime use the overtime rate, the rest the day rate", () => {
    // special day, 8h + 2h OT, 4 night hours: 2 fall in OT (end of shift), 2 in the shift.
    expect(nd("non-working-holiday", 8, 2, 4)).toBeCloseTo(2 * 130 * 0.1 + 2 * 169 * 0.1, 2);
  });

  it("more night hours than overtime hours", () => {
    // regular holiday, 8h + 1h OT, 3 night hours: 1 in OT (×2.6), 2 in the shift (×2).
    expect(nd("regular-holiday", 8, 1, 3)).toBeCloseTo(1 * 260 * 0.1 + 2 * 200 * 0.1, 2);
  });

  it("zero night hours pays nothing", () => {
    expect(nd("sunday", 8, 2, 0)).toBe(0);
  });

  it("total includes the corrected night differential", () => {
    const day = calculateDailyPay("sunday", 8, 0, 2, RATE);
    expect(day.total).toBeCloseTo(day.regularPay + day.overtimePay + 2 * 130 * 0.1, 2);
  });

  it("screens get the same amount through overtimeAndNightDiffPay", () => {
    expect(overtimeAndNightDiffPay("regular-holiday", 8, 1, 3, RATE).nightDiffPay).toBeCloseTo(66, 2);
  });
});

describe("night differential on regular days", () => {
  it("night hours that are also overtime use the overtime rate (×1.25)", () => {
    expect(nd("regular", 8, 2, 2)).toBeCloseTo(2 * 125 * 0.1, 2);
  });

  it("night hours beyond the overtime use the basic rate", () => {
    // 8h + 1h OT, 3 night hours: 1 in OT (×1.25), 2 in the shift (×1).
    expect(nd("regular", 8, 1, 3)).toBeCloseTo(1 * 125 * 0.1 + 2 * RATE * 0.1, 2);
  });

  it("night hours with no overtime use the basic rate", () => {
    expect(nd("regular", 8, 0, 2)).toBeCloseTo(2 * RATE * 0.1, 2);
  });

  it("zero night hours pays nothing", () => {
    expect(nd("regular", 8, 3, 0)).toBe(0);
  });

  it("total and the screen helper include it", () => {
    const day = calculateDailyPay("regular", 8, 2, 2, RATE);
    expect(day.total).toBeCloseTo(800 + 2 * 125 + 2 * 125 * 0.1, 2);
    expect(overtimeAndNightDiffPay("regular", 8, 2, 2, RATE).nightDiffPay).toBeCloseTo(25, 2);
  });
});

describe("unchanged cases", () => {

  it("overtime-only rest day keeps the 98a4c30 pricing", () => {
    // Sunday + special, 10h through an OT request, no night hours past 8 → 0 ND.
    expect(nd("sunday-special-holiday", 0, 10, 0)).toBe(0);
    // Special day 9h OT-only, 6 night hours: 1 past 8 (×1.69), 5 inside (×1.3).
    expect(nd("non-working-holiday", 0, 9, 6)).toBeCloseTo(5 * 130 * 0.1 + 1 * 169 * 0.1, 2);
  });
});
