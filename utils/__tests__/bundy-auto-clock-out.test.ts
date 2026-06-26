import {
  findAutoOutForClockIn,
  findStaleOpenSessionsForAutoClose,
  hasAutoOutForClockIn,
} from "@/lib/bundy-auto-clock-out";
import { getDateInManilaDefault, type TimeEntryPunch } from "@/lib/timeEntries";

describe("hasAutoOutForClockIn", () => {
  test("detects matching 23h auto-out punch", () => {
    const clockIn = "2026-06-23T22:42:00+00:00";
    const punches: TimeEntryPunch[] = [
      {
        id: "in1",
        employee_id: "x",
        punch_type: "in",
        punched_at: clockIn,
      },
      {
        id: "auto-out",
        employee_id: "x",
        punch_type: "out",
        punched_at: "2026-06-24T21:42:00+00:00",
        device_info: "auto:23h-open-shift-close Manila",
      },
    ];
    expect(hasAutoOutForClockIn(clockIn, punches)).toBe(true);
    expect(findAutoOutForClockIn(clockIn, punches)?.outPunchId).toBe("auto-out");
  });
});

describe("findStaleOpenSessionsForAutoClose", () => {
  test("finds older web IN even when a newer admin manual IN is still open", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "web-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-09T23:00:59.777Z",
        source: "web",
      },
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-10T22:48:00+00",
        source: "admin_correction",
        device_info: "admin:manual time in",
      },
    ];

    const now = new Date("2026-06-11T06:30:00+08:00");
    const stale = findStaleOpenSessionsForAutoClose(punches, now);

    expect(stale).toHaveLength(1);
    expect(stale[0].id).toBe("web-in");
    expect(hasAutoOutForClockIn(stale[0].clock_in_time!, punches)).toBe(false);
  });

  test("closes both stale sessions when both are past 23 hours", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "web-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-09T23:00:59.777Z",
        source: "web",
      },
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-10T22:48:00+00",
        source: "admin_correction",
        device_info: "admin:manual time in",
      },
    ];

    const now = new Date("2026-06-12T08:00:00+08:00");
    const stale = findStaleOpenSessionsForAutoClose(punches, now);

    expect(stale.map((s) => s.id)).toEqual(["web-in", "admin-in"]);
  });

  test("ignores open sessions not yet past 23 hours", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "in1",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-11T06:00:00+08:00",
      },
    ];

    const now = new Date("2026-06-11T20:00:00+08:00");
    expect(findStaleOpenSessionsForAutoClose(punches, now)).toHaveLength(0);
  });

  test("auto-closes admin manual IN after 23h even on a prior calendar day", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-10T22:48:00+00",
        source: "admin_correction",
        device_info: "admin:manual time in",
      },
    ];

    const now = new Date("2026-06-12T04:48:00+08:00");
    const stale = findStaleOpenSessionsForAutoClose(punches, now);
    expect(stale).toHaveLength(1);
    expect(stale[0].id).toBe("admin-in");
  });

  test("includes admin manual open IN after midnight before 23h", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-10T22:48:00+00",
        source: "admin_correction",
        device_info: "admin:manual time in",
      },
    ];

    const now = new Date("2026-06-11T16:44:00+00");
    expect(findStaleOpenSessionsForAutoClose(punches, now)).toHaveLength(0);
  });
});

describe("getDateInManilaDefault sanity for Carizza June 10 IN", () => {
  test("web IN at 2026-06-09T23:00:59Z buckets to June 10 Manila", () => {
    expect(getDateInManilaDefault("2026-06-09T23:00:59.777Z")).toBe("2026-06-10");
  });
});
