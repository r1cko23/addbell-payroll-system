import {
  assignBundyBusinessDayKeysFromPunches,
  getBundy23HourAutoOutIso,
  getBundyBusinessDayKey,
  getBundyBusinessDayKeyForClockIn,
  isPastBundyAutoClockOut,
} from "@/lib/bundy-business-day";

describe("bundy business day", () => {
  test("before 7 AM wall clock maps to previous day (overnight tail)", () => {
    expect(getBundyBusinessDayKey("2026-05-26T05:30:00+08:00")).toBe("2026-05-25");
  });

  test("early clock-in without open session uses calendar day", () => {
    expect(
      getBundyBusinessDayKeyForClockIn("2026-05-22T06:30:00+08:00", false, null)
    ).toBe("2026-05-22");
  });

  test("early clock-in with open overnight session uses prior business day", () => {
    expect(
      getBundyBusinessDayKeyForClockIn(
        "2026-05-22T02:00:00+08:00",
        true,
        "2026-05-21T22:00:00+08:00"
      )
    ).toBe("2026-05-21");
  });

  test("auto-close at 23h after clock-in", () => {
    const clockIn = "2026-05-22T06:30:00+08:00";
    const punches = [{ id: "in1", punch_type: "in", punched_at: clockIn }];
    const map = assignBundyBusinessDayKeysFromPunches(punches);
    expect(map.get("in1")).toBe("2026-05-22");
    expect(isPastBundyAutoClockOut(clockIn, new Date("2026-05-22T07:00:00+08:00"))).toBe(
      false
    );
    expect(
      isPastBundyAutoClockOut(clockIn, new Date("2026-05-23T05:30:00+08:00"))
    ).toBe(true);
    expect(getBundy23HourAutoOutIso(clockIn)).toBe(
      new Date(new Date(clockIn).getTime() + 23 * 60 * 60 * 1000).toISOString()
    );
  });

  test("at 7 AM starts new business day", () => {
    expect(getBundyBusinessDayKey("2026-05-26T07:00:00+08:00")).toBe("2026-05-26");
  });

  test("open session before 23h is not auto-closed", () => {
    const clockIn = "2026-05-25T07:00:00+08:00";
    const now = new Date("2026-05-26T03:00:00+08:00");
    expect(isPastBundyAutoClockOut(clockIn, now)).toBe(false);
  });

  test("open session at or after 23h is auto-closed", () => {
    const clockIn = "2026-05-25T07:00:00+08:00";
    const now = new Date("2026-05-26T07:00:00+08:00");
    expect(isPastBundyAutoClockOut(clockIn, now)).toBe(true);
  });

  test("late evening start also closes at 23h after in", () => {
    const clockIn = "2026-05-25T22:00:00+08:00";
    expect(isPastBundyAutoClockOut(clockIn, new Date("2026-05-26T20:59:00+08:00"))).toBe(
      false
    );
    expect(isPastBundyAutoClockOut(clockIn, new Date("2026-05-26T21:00:00+08:00"))).toBe(
      true
    );
  });
});
