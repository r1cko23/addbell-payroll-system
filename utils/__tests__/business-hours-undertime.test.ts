import {
  calculateLateHours,
  calculateUndertimeHours,
  calculateUndertimeHoursForAttendanceDay,
} from "@/utils/business-hours";
import { computeDayAttendanceMetrics } from "@/lib/day-attendance-summary";

describe("calculateUndertimeHours", () => {
  test("no UT when clock-out is after scheduled end", () => {
    expect(calculateUndertimeHours(16 * 60, 18 * 60 + 32)).toBe(0);
  });

  test("UT when clock-out is before scheduled end", () => {
    expect(calculateUndertimeHours(16 * 60, 14 * 60)).toBe(2);
  });
});

describe("calculateUndertimeHoursForAttendanceDay", () => {
  test("no UT when clock-out is on the next Manila calendar day", () => {
    expect(
      calculateUndertimeHoursForAttendanceDay(
        "2026-06-24",
        "2026-06-24T21:42:00+00:00", // Jun 25 5:42 AM Manila
        18 * 60
      )
    ).toBe(0);
  });

  test("UT when clock-out is same day before scheduled end", () => {
    expect(
      calculateUndertimeHoursForAttendanceDay(
        "2026-06-05",
        "2026-06-05T06:00:00+08:00", // 2 PM Manila, Friday end 4 PM
        16 * 60
      )
    ).toBe(2);
  });
});

describe("computeDayAttendanceMetrics undertime", () => {
  test("late Friday arrival with late clock-out: LT only, no UT", () => {
    const metrics = computeDayAttendanceMetrics("2026-06-05", [
      {
        clock_in_time: "2026-06-05T00:35:00.000Z", // 8:35 AM Manila
        clock_out_time: "2026-06-05T10:32:00.000Z", // 6:32 PM Manila
      },
    ]);
    expect(metrics.lt).toBe(2);
    expect(metrics.ut).toBe(0);
    expect(metrics.bh).toBe(6);
  });

  test("overnight shift: no false UT when out is next morning", () => {
    const metrics = computeDayAttendanceMetrics("2026-06-24", [
      {
        clock_in_time: "2026-06-23T22:42:00+00:00", // Wed Jun 24 6:42 AM Manila
        clock_out_time: "2026-06-24T21:42:00+00:00", // Thu Jun 25 5:42 AM Manila
      },
    ]);
    expect(metrics.ut).toBe(0);
    expect(metrics.bh).toBe(10);
  });
});

describe("computeDayAttendanceMetrics Saturday OT", () => {
  test("Saturday bundy punches do not auto-count as OT", () => {
    const metrics = computeDayAttendanceMetrics("2026-06-20", [
      {
        clock_in_time: "2026-06-20T13:00:00+08:00",
        clock_out_time: "2026-06-20T18:07:00+08:00",
      },
    ]);
    expect(metrics.bh).toBe(0);
    expect(metrics.ot).toBe(0);
    expect(metrics.totalWorked).toBe(4);
  });

  test("Saturday OT credits only approved filing hours", () => {
    const metrics = computeDayAttendanceMetrics(
      "2026-06-20",
      [
        {
          clock_in_time: "2026-06-20T13:00:00+08:00",
          clock_out_time: "2026-06-20T18:07:00+08:00",
        },
      ],
      { approvedOtHours: 4 }
    );
    expect(metrics.bh).toBe(0);
    expect(metrics.ot).toBe(4);
  });
});

describe("calculateLateHours", () => {
  test("8:35 AM arrival is 2 hours late from 7 AM start", () => {
    expect(calculateLateHours(7 * 60, 8 * 60 + 35)).toBe(2);
  });
});
