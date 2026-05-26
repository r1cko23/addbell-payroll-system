import {
  getBundyBusinessDayAutoOutIso,
  getBundyBusinessDayKey,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";

describe("bundy business day", () => {
  test("before 7 AM belongs to previous business day", () => {
    expect(getBundyBusinessDayKey("2026-05-26T05:30:00+08:00")).toBe("2026-05-25");
  });

  test("at 7 AM starts new business day", () => {
    expect(getBundyBusinessDayKey("2026-05-26T07:00:00+08:00")).toBe("2026-05-26");
  });

  test("auto out is 06:59 on day after business day", () => {
    expect(getBundyBusinessDayAutoOutIso("2026-05-25")).toBe(
      "2026-05-26T06:59:00+08:00"
    );
  });

  test("open session after midnight but before 06:59 is not auto-closed", () => {
    const clockIn = "2026-05-25T07:00:00+08:00";
    const now = new Date("2026-05-26T03:00:00+08:00");
    expect(isPastBundyAutoClockOut(clockIn, now)).toBe(false);
  });

  test("open session at or after 06:59 deadline is auto-closed", () => {
    const clockIn = "2026-05-25T07:00:00+08:00";
    const now = new Date("2026-05-26T06:59:00+08:00");
    expect(isPastBundyAutoClockOut(clockIn, now)).toBe(true);
  });
});
