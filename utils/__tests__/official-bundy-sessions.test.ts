import { getBundyBusinessDayKeyForInPunch } from "@/lib/bundy-business-day";
import { filterOfficialBundySessions } from "@/lib/official-bundy-sessions";
import {
  getDateInManilaDefault,
  punchesToSessions,
  type TimeEntryPunch,
  type TimeEntrySession,
} from "@/lib/timeEntries";

function session(
  id: string,
  clock_in_time: string,
  clock_out_time: string | null
): TimeEntrySession {
  return {
    id,
    clock_in_time,
    clock_out_time,
    clock_in_date_ph: getDateInManilaDefault(clock_in_time),
    status: clock_out_time ? "clocked_out" : "clocked_in",
    total_hours: clock_out_time
      ? (new Date(clock_out_time).getTime() - new Date(clock_in_time).getTime()) /
        (1000 * 60 * 60)
      : null,
  };
}

function punch(
  id: string,
  punch_type: "in" | "out",
  punched_at: string
): TimeEntryPunch {
  return { id, employee_id: "e", punch_type, punched_at, source: "web" };
}

const SAME_DAY = () => "2026-09-11";

function officialOnDay(sessions: TimeEntrySession[]) {
  return filterOfficialBundySessions(sessions, SAME_DAY);
}

function officialFromPunches(punches: TimeEntryPunch[]) {
  return filterOfficialBundySessions(
    punchesToSessions(punches, getDateInManilaDefault),
    (s) => getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, punches)
  );
}

describe("filterOfficialBundySessions — longest complete pair per day", () => {
  test("Carizza Sep 11: 1-minute accident does not hide the 19h overnight pair", () => {
    const punches = [
      punch("in-acc", "in", "2026-09-11T06:26:28.550+08:00"),
      punch("out-acc", "out", "2026-09-11T06:27:54.441+08:00"),
      punch("in-real", "in", "2026-09-11T06:28:08.540+08:00"),
      punch("out-real", "out", "2026-09-12T02:20:35.751+08:00"),
    ];
    const official = officialFromPunches(punches);
    expect(official).toHaveLength(1);
    expect(official[0].id).toBe("in-real");
    expect(official[0].clock_in_time).toBe("2026-09-11T06:28:08.540+08:00");
    expect(official[0].clock_out_time).toBe("2026-09-12T02:20:35.751+08:00");
  });

  test("zero sessions stay empty", () => {
    expect(officialOnDay([])).toEqual([]);
  });

  test("single 1-minute pair is still official when it is the only pair", () => {
    const official = officialOnDay([
      session("only", "2026-09-11T06:26:00+08:00", "2026-09-11T06:27:00+08:00"),
    ]);
    expect(official).toHaveLength(1);
    expect(official[0].id).toBe("only");
  });

  test("single incomplete session stays official", () => {
    const official = officialOnDay([
      session("open", "2026-09-11T06:28:00+08:00", null),
    ]);
    expect(official).toHaveLength(1);
    expect(official[0].id).toBe("open");
  });

  test("long pair then accidental short pair still keeps the long pair", () => {
    const official = officialOnDay([
      session("long", "2026-09-11T07:00:00+08:00", "2026-09-11T17:00:00+08:00"),
      session("short", "2026-09-11T17:01:00+08:00", "2026-09-11T17:02:00+08:00"),
    ]);
    expect(official.map((s) => s.id)).toEqual(["long"]);
  });

  test("three pairs: middle longest wins", () => {
    const official = officialOnDay([
      session("a", "2026-09-11T06:00:00+08:00", "2026-09-11T06:02:00+08:00"),
      session("b", "2026-09-11T07:00:00+08:00", "2026-09-11T19:00:00+08:00"),
      session("c", "2026-09-11T19:10:00+08:00", "2026-09-11T20:00:00+08:00"),
    ]);
    expect(official).toHaveLength(1);
    expect(official[0].id).toBe("b");
  });

  test("equal duration keeps the earlier Time In", () => {
    const official = officialOnDay([
      session("first", "2026-09-11T07:00:00+08:00", "2026-09-11T15:00:00+08:00"),
      session("second", "2026-09-11T16:00:00+08:00", "2026-09-12T00:00:00+08:00"),
    ]);
    expect(official).toHaveLength(1);
    expect(official[0].id).toBe("first");
  });

  test("complete short pair wins over a later incomplete IN", () => {
    const official = officialOnDay([
      session("short", "2026-09-11T06:26:00+08:00", "2026-09-11T06:27:00+08:00"),
      session("open", "2026-09-11T06:28:00+08:00", null),
    ]);
    expect(official).toHaveLength(1);
    expect(official[0].id).toBe("short");
  });

  test("refresh with the same punches still returns the longer pair", () => {
    const punches = [
      punch("in-acc", "in", "2026-09-11T06:26:28.550+08:00"),
      punch("out-acc", "out", "2026-09-11T06:27:54.441+08:00"),
      punch("in-real", "in", "2026-09-11T06:28:08.540+08:00"),
      punch("out-real", "out", "2026-09-12T02:20:35.751+08:00"),
    ];
    const first = officialFromPunches(punches);
    const second = officialFromPunches(punches);
    expect(first[0].id).toBe("in-real");
    expect(second[0].id).toBe(first[0].id);
    expect(second[0].clock_out_time).toBe(first[0].clock_out_time);
  });

  test("two business days keep their own longest pair", () => {
    const official = filterOfficialBundySessions(
      [
        session("d10-short", "2026-09-10T06:00:00+08:00", "2026-09-10T06:01:00+08:00"),
        session("d10-long", "2026-09-10T07:00:00+08:00", "2026-09-10T17:00:00+08:00"),
        session("d11-long", "2026-09-11T06:28:00+08:00", "2026-09-12T02:20:00+08:00"),
        session("d11-short", "2026-09-11T06:26:00+08:00", "2026-09-11T06:27:00+08:00"),
      ],
      (s) => getDateInManilaDefault(s.clock_in_time)
    );
    expect(official.map((s) => s.id).sort()).toEqual(["d10-long", "d11-long"]);
  });
});
