import { buildYearEndRows, thirteenthMonthWindow } from "@/lib/year-end-payout";

const slip = (employee_id: string, period_start: string, basic: number) => ({
  employee_id,
  period_start,
  gross_pay: basic,
  earnings_breakdown: { payroll_result: { totals: { regularPay: basic } } },
});

describe("year-end 13th month + SIL cash", () => {
  test("2026 window matches the accountant's sheet (Dec 10, 2025 – Dec 8, 2026 cutoffs)", () => {
    expect(thirteenthMonthWindow(2026)).toEqual({ afterEnd: "2025-12-09", throughEnd: "2026-12-08" });
  });

  test("13th month = basic ÷ 12; SIL cash = unused days × daily rate; total adds both", () => {
    const [row] = buildYearEndRows(
      [{ id: "e1", employee_id: "2025-004", full_name: "CONTE, ELEAZAR", salary_basis: "daily", base_rate: 850 }],
      [slip("e1", "2026-11-04", 5100), slip("e1", "2026-10-28", 4250)],
      [
        {
          employee_id: "e1",
          leave_type: "Sick Leave",
          status: "approved_by_hr",
          start_date: "2026-07-30",
          total_days: 3,
          selected_dates: ["2026-07-30", "2026-07-31", "2026-11-06"],
          half_day_dates: [],
        },
      ],
      2026
    );
    expect(row).toMatchObject({
      basic: 9350,
      thirteenthMonth: 779.17,
      silUnusedDays: 2,
      dailyRate: 850,
      silCash: 1700,
      total: 2479.17,
      firstCutoff: "2026-10-28",
    });
  });

  test("SUMMARY sheet example: 5 unused days at ₱530 = ₱2,650", () => {
    const [row] = buildYearEndRows(
      [{ id: "a", employee_id: "x", full_name: "ACIERTO", salary_basis: "daily", base_rate: 530 }],
      [slip("a", "2026-01-07", 1000)],
      [],
      2026
    );
    expect(row.silCash).toBe(2650);
  });

  test("counts like HR's sheet: worked regular-day hours ÷ 8; holidays and SIL days left out", () => {
    const rate = 106.25; // ₱850/day
    const day = (date: string, dayType: string, regularHours: number, extra = {}) => ({
      date, dayType, regularHours, ...extra,
    });
    // Mallari Oct 7–13 shape: Wed–Fri worked (28h), Mon–Tue SIL (8h each) → sheet 3.5 days.
    const days = [
      day("2026-10-07", "regular", 10),
      day("2026-10-08", "regular", 10),
      day("2026-10-09", "regular", 8),
      day("2026-10-10", "regular", 0),
      day("2026-10-11", "sunday", 0),
      day("2026-10-12", "regular", 8),
      day("2026-10-13", "regular", 8, { leaveHours: 8 }),
    ];
    const p = {
      employee_id: "m",
      period_start: "2026-10-07",
      gross_pay: 0,
      earnings_breakdown: {
        attendance_data: days,
        payroll_result: { breakdown: days.map((d) => ({ regularPay: d.regularHours * rate })) },
      },
    };
    const [row] = buildYearEndRows(
      [{ id: "m", employee_id: "2015-040", full_name: "MALLARI", salary_basis: "daily", base_rate: 850 }],
      [p],
      [
        {
          employee_id: "m",
          leave_type: "Sick Leave",
          status: "approved_by_hr",
          start_date: "2026-10-12",
          total_days: 1,
          selected_dates: ["2026-10-12"],
          half_day_dates: [],
        },
      ],
      2026
    );
    expect(row.basic / 850).toBe(3.5);
  });

  test("holiday days are not counted", () => {
    const rate = 106.25;
    const days = [
      { date: "2026-08-31", dayType: "regular-holiday", regularHours: 4 },
      { date: "2026-09-01", dayType: "regular", regularHours: 10 },
    ];
    const [row] = buildYearEndRows(
      [{ id: "h", employee_id: "h", full_name: "H", salary_basis: "daily", base_rate: 850 }],
      [
        {
          employee_id: "h",
          period_start: "2026-08-26",
          gross_pay: 0,
          earnings_breakdown: {
            attendance_data: days,
            payroll_result: { breakdown: [{ regularPay: 4 * rate * 2 }, { regularPay: 10 * rate }] },
          },
        },
      ],
      [],
      2026
    );
    expect(row.basic).toBe(1062.5);
  });

  test("employees without payslips in the window are left out", () => {
    expect(
      buildYearEndRows([{ id: "z", employee_id: "z", full_name: "Z", base_rate: 600 }], [], [], 2026)
    ).toEqual([]);
  });
});
