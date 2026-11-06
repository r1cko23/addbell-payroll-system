import { describe, expect, test } from "vitest";
import { buildPayrollRunTemplateTable } from "@/lib/payroll-export/build-payroll-run-template";

const DAYS = 5;
const AMOUNT = 6;
const REST_HR = 9;
const NWH_HR = 10;
const REG_HOL_HR = 11;
const REST_AMT = 14;
const NWH_AMT = 15;
const REG_HOL_AMT = 16;

const RATE_DAY = 800; // 100/hr
const run = { cutoff_start: "2026-10-28", cutoff_end: "2026-11-03", company_name: "X" };

type Day = {
  date: string;
  dayType: string;
  regularHours: number;
  clockInTime?: string;
  clockOutTime?: string;
};

const worked = (date: string, dayType: string, h: number): Day => ({
  date,
  dayType,
  regularHours: h,
  clockInTime: `${date}T07:00:00+08:00`,
  clockOutTime: `${date}T17:00:00+08:00`,
});
const absent = (date: string, dayType: string, h = 0): Day => ({ date, dayType, regularHours: h });

function row(attendance: Day[]) {
  const table = buildPayrollRunTemplateTable({
    run,
    holidays: [],
    slips: [
      {
        employee_id: "e1",
        gross_pay: 0,
        earnings_breakdown: { attendance_data: attendance },
        employees: { salary_basis: "daily", base_rate: RATE_DAY },
      },
    ],
  });
  return table.dataRows[0];
}

const weekdays8 = ["2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31"].map((d) =>
  worked(d, "regular", 8)
);

describe("payroll Excel no. of days", () => {
  test("zero hours is zero days", () => {
    expect(row([absent("2026-10-28", "regular")])[DAYS]).toBe(0);
  });

  test("partial and full regular days count in 8-hour day equivalents", () => {
    const r = row([worked("2026-10-28", "regular", 8), worked("2026-10-29", "regular", 4)]);
    expect(r[DAYS]).toBe(1.5);
    expect(r[AMOUNT]).toBe(1.5 * RATE_DAY);
  });

  test("a 10-hour schedule credits 1.25 days per day, matching rate/hr = rateday / 8", () => {
    const r = row([worked("2026-10-28", "regular", 10), worked("2026-10-29", "regular", 10)]);
    expect(r[DAYS]).toBe(2.5);
    expect(r[AMOUNT]).toBe(2.5 * RATE_DAY);
  });

  test("unworked special non-working day credited 4h in old payslips adds no days and no pay", () => {
    // Nov 2, 2026 run: stored attendance still carries the pre-NWPC 4h credit.
    const r = row([...weekdays8, absent("2026-11-02", "non-working-holiday", 4)]);
    expect(r[DAYS]).toBe(4);
    expect(r[AMOUNT]).toBe(4 * RATE_DAY);
    expect(r[NWH_HR]).toBe("");
    expect(r[NWH_AMT]).toBe("");
  });

  test("worked special non-working day goes to its own column, not no. of days", () => {
    const r = row([...weekdays8, worked("2026-11-02", "non-working-holiday", 10)]);
    expect(r[DAYS]).toBe(4);
    expect(r[AMOUNT]).toBe(4 * RATE_DAY);
    expect(r[NWH_HR]).toBe(10);
    expect(r[NWH_AMT]).toBeCloseTo(10 * 100 * 1.3);
  });

  test("unworked regular holiday is paid in the REG HOL column, not no. of days", () => {
    const r = row([...weekdays8, absent("2026-11-02", "regular-holiday", 4)]);
    expect(r[DAYS]).toBe(4);
    expect(r[AMOUNT]).toBe(4 * RATE_DAY);
    expect(r[REG_HOL_HR]).toBe(4);
    expect(r[REG_HOL_AMT]).toBe(RATE_DAY); // 4h x 200% = one day's wage
  });

  test("worked regular holiday goes to its own column, not no. of days", () => {
    const r = row([...weekdays8, worked("2026-11-02", "regular-holiday", 8)]);
    expect(r[DAYS]).toBe(4);
    expect(r[REG_HOL_HR]).toBe(8);
    expect(r[REG_HOL_AMT]).toBe(2 * RATE_DAY);
  });

  test("rest day worked goes to the rest day column, not no. of days", () => {
    const r = row([...weekdays8, worked("2026-11-01", "sunday", 8)]);
    expect(r[DAYS]).toBe(4);
    expect(r[AMOUNT]).toBe(4 * RATE_DAY);
    expect(r[REST_HR]).toBe(8);
    expect(r[REST_AMT]).toBeCloseTo(8 * 100 * 1.3);
  });

  test("rest day not worked adds nothing", () => {
    const r = row([...weekdays8, absent("2026-11-01", "sunday")]);
    expect(r[DAYS]).toBe(4);
    expect(r[REST_HR]).toBe("");
  });
});
