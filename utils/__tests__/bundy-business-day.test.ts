import {
  assignBundyBusinessDayKeysFromPunches,
  getBundyBusinessDayAutoOutIso,
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

  test("assign: 6:30 AM start is not auto-closed until next morning 06:59", () => {
    const punches = [
      { id: "in1", punch_type: "in", punched_at: "2026-05-22T06:30:00+08:00" },
    ];
    const map = assignBundyBusinessDayKeysFromPunches(punches);
    expect(map.get("in1")).toBe("2026-05-22");
    const now = new Date("2026-05-22T07:00:00+08:00");
    expect(isPastBundyAutoClockOut("2026-05-22T06:30:00+08:00", now, map.get("in1"))).toBe(
      false
    );
    const afterDeadline = new Date("2026-05-23T06:59:00+08:00");
    expect(
      isPastBundyAutoClockOut("2026-05-22T06:30:00+08:00", afterDeadline, map.get("in1"))
    ).toBe(true);
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
