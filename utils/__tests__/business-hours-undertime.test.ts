import {
  calculateLateHours,
  calculateUndertimeHours,
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
});

describe("calculateLateHours", () => {
  test("8:35 AM arrival is 2 hours late from 7 AM start", () => {
    expect(calculateLateHours(7 * 60, 8 * 60 + 35)).toBe(2);
  });
});
