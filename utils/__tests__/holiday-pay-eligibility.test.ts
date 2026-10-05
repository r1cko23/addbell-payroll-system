import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import {
  HOLIDAY_UNWORKED_CREDIT_HOURS,
  isEligibleForHolidayPayRule,
} from "@/utils/holidays";

/**
 * National Heroes Day 2026 is Monday, August 31.
 * Saturday and Sunday are not required office days, so Friday is the workday
 * immediately before that holiday.
 */
const heroesDayWeekend = [
  { date: "2026-08-27", dayType: "regular", regularHours: 8 },
  { date: "2026-08-28", dayType: "regular", regularHours: 0 },
  { date: "2026-08-29", dayType: "regular", regularHours: 0 },
  { date: "2026-08-30", dayType: "sunday", regularHours: 0 },
];

describe("unworked regular holiday pay", () => {
  test("absence on the Friday before a Monday holiday is not paid", () => {
    expect(
      isEligibleForHolidayPayRule("2026-08-31", 0, heroesDayWeekend)
    ).toBe(false);
  });

  test("full paid leave on the Friday before a Monday holiday is paid", () => {
    const days = heroesDayWeekend.map((day) =>
      day.date === "2026-08-28" ? { ...day, regularHours: 8 } : day
    );

    expect(isEligibleForHolidayPayRule("2026-08-31", 0, days)).toBe(true);
  });

  test("a full day worked on the Friday before a Monday holiday is paid", () => {
    const days = heroesDayWeekend.map((day) =>
      day.date === "2026-08-28" ? { ...day, regularHours: 8 } : day
    );

    expect(isEligibleForHolidayPayRule("2026-08-31", 0, days)).toBe(true);
  });

  test("when Friday is a rest day, absence on Thursday is not paid", () => {
    expect(
      isEligibleForHolidayPayRule("2026-08-31", 0, [
        { date: "2026-08-26", dayType: "regular", regularHours: 8 },
        { date: "2026-08-27", dayType: "regular", regularHours: 0 },
        { date: "2026-08-28", dayType: "sunday", regularHours: 0 },
        { date: "2026-08-29", dayType: "regular", regularHours: 0 },
        { date: "2026-08-30", dayType: "sunday", regularHours: 0 },
      ])
    ).toBe(false);
  });

  test("when Friday is a rest day, a full Thursday is paid", () => {
    expect(
      isEligibleForHolidayPayRule("2026-08-31", 0, [
        { date: "2026-08-27", dayType: "regular", regularHours: 8 },
        { date: "2026-08-28", dayType: "sunday", regularHours: 0 },
        { date: "2026-08-29", dayType: "regular", regularHours: 0 },
        { date: "2026-08-30", dayType: "sunday", regularHours: 0 },
      ])
    ).toBe(true);
  });

  test("work on the holiday is paid even when the prior workday was absent", () => {
    expect(
      isEligibleForHolidayPayRule("2026-08-31", 8, heroesDayWeekend)
    ).toBe(true);
  });

  test("no preceding workday means the unworked holiday is not paid", () => {
    expect(isEligibleForHolidayPayRule("2026-08-31", 0, [])).toBe(false);
  });

  test("a second regular holiday is paid when the first holiday was credited", () => {
    expect(
      isEligibleForHolidayPayRule("2026-04-03", 0, [
        { date: "2026-04-01", dayType: "regular", regularHours: 0 },
        { date: "2026-04-02", dayType: "regular-holiday", regularHours: 4 },
      ])
    ).toBe(true);
  });

  test("a second regular holiday is not paid when the first was unworked and the workday before it was absent", () => {
    expect(
      isEligibleForHolidayPayRule("2026-04-03", 0, [
        { date: "2026-03-31", dayType: "regular", regularHours: 8 },
        { date: "2026-04-01", dayType: "regular", regularHours: 0 },
        { date: "2026-04-02", dayType: "regular-holiday", regularHours: 0 },
      ])
    ).toBe(false);
  });
});

function punch(date: string, start: string, end: string) {
  return {
    id: date,
    employee_id: "employee-1",
    clock_in_time: `${date}T${start}+08:00`,
    clock_out_time: `${date}T${end}+08:00`,
    regular_hours: null,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  };
}

describe("holiday recording for 31 August 2026", () => {
  const periodStart = new Date(2026, 7, 24, 12, 0, 0);
  const periodEnd = new Date(2026, 7, 31, 12, 0, 0);
  const holidays = [{ holiday_date: "2026-08-31", holiday_type: "regular" }];

  function hoursOn(
    result: ReturnType<typeof generateTimesheetFromClockEntries>,
    date: string
  ) {
    return result.attendance_data.find((day) => day.date === date)?.regularHours;
  }

  test("does not record the holiday when Friday was absent and an earlier day was complete", () => {
    const result = generateTimesheetFromClockEntries(
      [punch("2026-08-27", "07:00:00", "18:00:00")],
      periodStart,
      periodEnd,
      holidays
    );

    expect(hoursOn(result, "2026-08-31")).toBe(0);
  });

  test("records the holiday when Friday was a full workday", () => {
    const result = generateTimesheetFromClockEntries(
      [punch("2026-08-28", "07:00:00", "16:00:00")],
      periodStart,
      periodEnd,
      holidays
    );

    expect(hoursOn(result, "2026-08-31")).toBe(HOLIDAY_UNWORKED_CREDIT_HOURS);
  });

  test("records the holiday when Friday is a full paid leave day", () => {
    const result = generateTimesheetFromClockEntries(
      [],
      periodStart,
      periodEnd,
      holidays,
      undefined,
      true,
      true,
      false,
      undefined,
      undefined,
      false,
      new Map([["2026-08-28", 8]])
    );

    expect(hoursOn(result, "2026-08-31")).toBe(HOLIDAY_UNWORKED_CREDIT_HOURS);
  });

  test("does not record the holiday when Friday is a rest day and Thursday was absent", () => {
    const result = generateTimesheetFromClockEntries(
      [punch("2026-08-26", "07:00:00", "18:00:00")],
      periodStart,
      periodEnd,
      holidays,
      new Map([["2026-08-28", true]])
    );

    expect(hoursOn(result, "2026-08-31")).toBe(0);
  });
});
