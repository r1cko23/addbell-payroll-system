import { findStaleOpenSessionsForAutoClose } from "@/lib/bundy-auto-clock-out";
import {
  BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  getBundyBusinessDayKeyForInPunch,
} from "@/lib/bundy-business-day";
import { filterOfficialBundySessions } from "@/lib/official-bundy-sessions";
import {
  getOpenEntryFromPunches,
  punchesToSessions,
  getDateInManilaDefault,
  type TimeEntryPunch,
} from "@/lib/timeEntries";

/** Bundy Time Out button is on iff pairing still sees an open IN. */
function timeOutButtonOn(punches: TimeEntryPunch[]): boolean {
  return getOpenEntryFromPunches(punches, getDateInManilaDefault) != null;
}

function punch(
  id: string,
  punch_type: "in" | "out",
  punched_at: string,
  extra: Partial<TimeEntryPunch> = {}
): TimeEntryPunch {
  return {
    id,
    employee_id: "e",
    punch_type,
    punched_at,
    source: extra.source ?? "web",
    ...extra,
  };
}

const EARLY_BIRD_IN = "2026-09-16T06:00:00.000+08:00";
const OUT_8H = "2026-09-16T14:00:00.000+08:00";
const OUT_20H = "2026-09-17T02:00:00.000+08:00";
const OUT_20H_PLUS_1MS = "2026-09-17T02:00:00.001+08:00";
const OUT_22H53M = "2026-09-17T04:53:00.000+08:00";
const OUT_23H = "2026-09-17T05:00:00.000+08:00";
const OUT_23H_PLUS_1MS = "2026-09-17T05:00:00.001+08:00";
const AUTO_OUT_23H30M = "2026-09-17T05:30:00.000+08:00";
const AUTO_OUT_24H_PLUS_1MS = "2026-09-17T06:00:00.001+08:00";

function autoOut(id: string, punched_at: string): TimeEntryPunch {
  return punch(id, "out", punched_at, {
    device_info: BUNDY_AUTO_CLOCK_OUT_DEVICE_INFO,
  });
}

describe("bundy IN/OUT pair gap — Time Out button vs saved punch", () => {
  describe("cardinality", () => {
    test("zero punches: Time Out off", () => {
      expect(timeOutButtonOn([])).toBe(false);
      expect(punchesToSessions([], getDateInManilaDefault)).toEqual([]);
    });

    test("one IN, no OUT: Time Out on", () => {
      const punches = [punch("in1", "in", EARLY_BIRD_IN)];
      expect(timeOutButtonOn(punches)).toBe(true);
      expect(punchesToSessions(punches, getDateInManilaDefault)[0].clock_out_time).toBeNull();
    });

    test("one IN + one OUT: Time Out off", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_8H),
      ];
      expect(timeOutButtonOn(punches)).toBe(false);
      expect(punchesToSessions(punches, getDateInManilaDefault)).toHaveLength(1);
    });

    test("one IN + many Time Outs: one session, first OUT wins", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_22H53M),
        punch("out2", "out", "2026-09-17T04:53:10.000+08:00"),
        punch("out3", "out", "2026-09-17T04:53:20.000+08:00"),
      ];
      const sessions = punchesToSessions(punches, getDateInManilaDefault);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].out_punch_id).toBe("out1");
      expect(timeOutButtonOn(punches)).toBe(false);
    });
  });

  describe("lifecycle — Time Out relative to 20h/23h window", () => {
    test("Time Out at 20h even (old cap) closes session", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_20H),
      ];
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("Time Out 1ms past 20h still closes (Carizza-class regression)", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_20H_PLUS_1MS),
      ];
      expect(punchesToSessions(punches, getDateInManilaDefault)[0].clock_out_time).toBe(
        OUT_20H_PLUS_1MS
      );
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("Time Out at exactly 23h closes session", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_23H),
      ];
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("employee Time Out 1ms past 23h does not pair; Time Out stays on", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_23H_PLUS_1MS),
      ];
      expect(punchesToSessions(punches, getDateInManilaDefault)[0].clock_out_time).toBeNull();
      expect(timeOutButtonOn(punches)).toBe(true);
    });

    test("retry Time Out after toast still matches saved pair (partial success)", () => {
      const afterFirstSave = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_22H53M),
      ];
      expect(timeOutButtonOn(afterFirstSave)).toBe(false);

      const afterRetry = [
        ...afterFirstSave,
        punch("out2", "out", "2026-09-17T04:53:11.000+08:00"),
      ];
      expect(timeOutButtonOn(afterRetry)).toBe(false);
    });
  });

  describe("persistence — employee OUT vs auto-close", () => {
    test("auto-out at exactly 23h pairs", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        autoOut("auto", OUT_23H),
      ];
      expect(timeOutButtonOn(punches)).toBe(false);
      expect(punchesToSessions(punches, getDateInManilaDefault)[0].out_punch_id).toBe(
        "auto"
      );
    });

    test("auto-out 30m past 23h still pairs (24h buffer)", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        autoOut("auto", AUTO_OUT_23H30M),
      ];
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("auto-out 1ms past 24h does not pair", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        autoOut("auto", AUTO_OUT_24H_PLUS_1MS),
      ];
      expect(timeOutButtonOn(punches)).toBe(true);
    });

    test("employee Time Out at 22h53m wins over later 23h auto-out", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("emp-out", "out", OUT_22H53M),
        autoOut("auto", OUT_23H),
      ];
      const sessions = punchesToSessions(punches, getDateInManilaDefault);
      expect(sessions[0].out_punch_id).toBe("emp-out");
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("orphan Time Out with no IN does not open a session", () => {
      const punches = [punch("out1", "out", OUT_8H)];
      expect(punchesToSessions(punches, getDateInManilaDefault)).toEqual([]);
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("Time Out at the same instant as Time In does not pair", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", EARLY_BIRD_IN),
      ];
      expect(timeOutButtonOn(punches)).toBe(true);
    });
  });

  describe("overnight / early-bird business day", () => {
    test("6 AM Time In + 4:53 AM next day Time Out closes (Carizza shape)", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_22H53M),
      ];
      const sessions = punchesToSessions(punches, getDateInManilaDefault);
      expect(sessions[0].clock_in_date_ph).toBe("2026-09-16");
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("official attendance for that business day shows Time Out, not open", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_22H53M),
      ];
      const sessions = punchesToSessions(punches, getDateInManilaDefault);
      const official = filterOfficialBundySessions(sessions, (s) =>
        getBundyBusinessDayKeyForInPunch(s.id, s.clock_in_time, punches)
      );
      expect(official).toHaveLength(1);
      expect(official[0].clock_out_time).toBe(OUT_22H53M);
    });

    test("7 AM Time In + 5:59 AM next day Time Out (22h59m) closes", () => {
      const punches = [
        punch("in1", "in", "2026-09-16T07:00:00.000+08:00"),
        punch("out1", "out", "2026-09-17T05:59:00.000+08:00"),
      ];
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("two overnight days both close (many sessions)", () => {
      const punches = [
        punch("in-a", "in", "2026-09-14T06:33:00.000+08:00"),
        punch("out-a", "out", "2026-09-15T00:55:00.000+08:00"),
        punch("in-b", "in", EARLY_BIRD_IN),
        punch("out-b", "out", OUT_22H53M),
      ];
      const sessions = punchesToSessions(punches, getDateInManilaDefault);
      expect(sessions).toHaveLength(2);
      expect(sessions.every((s) => s.clock_out_time)).toBe(true);
      expect(timeOutButtonOn(punches)).toBe(false);
    });
  });

  describe("auto-close must not overwrite a saved overnight Time Out", () => {
    test("22h53m employee Time Out is not stale even after 23h has passed", () => {
      const punches = [
        punch("in1", "in", EARLY_BIRD_IN),
        punch("out1", "out", OUT_22H53M),
      ];
      const now = new Date("2026-09-17T11:15:00+08:00");
      expect(findStaleOpenSessionsForAutoClose(punches, now)).toHaveLength(0);
      expect(timeOutButtonOn(punches)).toBe(false);
    });

    test("forgotten overnight with no Time Out is stale after 23h", () => {
      const punches = [punch("in1", "in", EARLY_BIRD_IN)];
      const now = new Date("2026-09-17T05:00:00+08:00");
      expect(findStaleOpenSessionsForAutoClose(punches, now)).toHaveLength(1);
    });
  });
});
