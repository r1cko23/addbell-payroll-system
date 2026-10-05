import {
  attendanceEntryHoursLabel,
  attendanceEntrySourceLabel,
  attendanceEntryStatusLabel,
} from "@/lib/attendance-entry-display";

describe("attendance entry display", () => {
  test("a finished punch reads as auto approved", () => {
    expect(
      attendanceEntryStatusLabel({
        status: "clocked_out",
        clockOutTime: "2026-10-01T10:20:00.000Z",
      })
    ).toBe("Auto approved");
  });

  test("an open punch reads as incomplete", () => {
    expect(
      attendanceEntryStatusLabel({
        status: "clocked_in",
        clockOutTime: null,
      })
    ).toBe("Incomplete");
  });

  test("elapsed hours show on the entry line", () => {
    expect(
      attendanceEntryHoursLabel({ totalHours: 8.41, regularHours: 7.6 })
    ).toBe("8.41h");
  });

  test("no hours omits the hours label", () => {
    expect(
      attendanceEntryHoursLabel({ totalHours: null, regularHours: null })
    ).toBeNull();
  });

  test("biometric source is labeled Biometric", () => {
    expect(
      attendanceEntrySourceLabel({ source: "biometric", device: "ZKTeco" })
    ).toBe("Biometric");
  });

  test("a phone punch is labeled Bundy", () => {
    expect(
      attendanceEntrySourceLabel({ source: "web", device: "iPhone" })
    ).toBe("Bundy");
  });

  test("an admin backfill has no source badge", () => {
    expect(
      attendanceEntrySourceLabel({
        source: "admin_correction",
        device: "admin:manual",
      })
    ).toBeNull();
  });
});
