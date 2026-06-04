import { describe, expect, it } from "vitest";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { HOLIDAY_UNWORKED_CREDIT_HOURS } from "@/utils/holidays";

describe("generateTimesheetFromClockEntries holiday lookback", () => {
  it("credits regular holiday hours when pre-period work satisfies eligibility", () => {
    const periodStart = new Date("2026-05-27");
    const periodEnd = new Date("2026-06-02");
    const holidays = [{ holiday_date: "2026-05-27", holiday_type: "regular" }];
    const entries = [
      {
        id: "1",
        employee_id: "x",
        clock_in_time: "2026-05-25T23:00:00.000Z",
        clock_out_time: "2026-05-26T10:00:00.000Z",
        regular_hours: 8,
        overtime_hours: 0,
        total_night_diff_hours: 0,
        status: "approved",
      },
      {
        id: "2",
        employee_id: "x",
        clock_in_time: "2026-05-28T23:00:00.000Z",
        clock_out_time: "2026-05-29T11:03:06.101Z",
        regular_hours: 8,
        overtime_hours: 0,
        total_night_diff_hours: 0,
        status: "approved",
      },
    ];

    const result = generateTimesheetFromClockEntries(
      entries as any,
      periodStart,
      periodEnd,
      holidays
    );

    const may27 = result.attendance_data.find((d) => d.date === "2026-05-27");
    expect(may27?.dayType).toBe("regular-holiday");
    expect(may27?.regularHours).toBe(HOLIDAY_UNWORKED_CREDIT_HOURS);
  });
});
