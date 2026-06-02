import {
  getActiveBundyBusinessDayKey,
  getOpenEntryFromPunches,
  isSupersededInPunch,
  punchesToSessions,
  getDateInManilaDefault,
  type TimeEntryPunch,
} from "@/lib/timeEntries";

describe("bundy open session / superseded IN", () => {
  const engilbenPunches: TimeEntryPunch[] = [
    {
      id: "08fc5e96",
      employee_id: "x",
      punch_type: "in",
      punched_at: "2026-05-27T22:29:39.701Z",
    },
    {
      id: "1a859d7a",
      employee_id: "x",
      punch_type: "in",
      punched_at: "2026-05-27T23:19:52.647Z",
    },
    {
      id: "4dc95312",
      employee_id: "x",
      punch_type: "out",
      punched_at: "2026-05-28T10:36:06.384Z",
    },
    {
      id: "6bd64a19",
      employee_id: "x",
      punch_type: "in",
      punched_at: "2026-05-28T23:00:00Z",
    },
    {
      id: "450a498b",
      employee_id: "x",
      punch_type: "out",
      punched_at: "2026-05-29T10:27:44.631Z",
    },
    {
      id: "3f9987e5",
      employee_id: "x",
      punch_type: "in",
      punched_at: "2026-05-31T23:00:00Z",
    },
    {
      id: "1eda0cd6",
      employee_id: "x",
      punch_type: "out",
      punched_at: "2026-06-01T10:03:56.29Z",
    },
  ];

  test("early IN superseded by later IN before OUT", () => {
    expect(isSupersededInPunch("08fc5e96", engilbenPunches)).toBe(true);
    expect(isSupersededInPunch("1a859d7a", engilbenPunches)).toBe(false);
  });

  test("superseded IN does not create open session", () => {
    const sessions = punchesToSessions(engilbenPunches, getDateInManilaDefault);
    const open = sessions.filter((s) => !s.clock_out_time);
    expect(open).toHaveLength(0);
  });

  test("June 2 morning: no open entry, active business day is June 2", () => {
    const now = "2026-06-02T07:00:54+08:00";
    const active = getActiveBundyBusinessDayKey(engilbenPunches, now);
    expect(active).toBe("2026-06-02");
    const open = getOpenEntryFromPunches(
      engilbenPunches,
      getDateInManilaDefault,
      active
    );
    expect(open).toBeNull();
  });

  test("early-bird IN before 7 AM is not superseded by admin pre-open at 7 AM", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "early",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-02T06:25:00+08:00",
        source: "web",
      },
      {
        id: "admin7",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-02T07:00:00+08:00",
        source: "admin_correction",
        device_info: "admin:Jun 2 2026 7:00 AM — pre-open; staff instructed to time out only",
      },
      {
        id: "out1",
        employee_id: "x",
        punch_type: "out",
        punched_at: "2026-06-02T18:00:00+08:00",
      },
    ];
    expect(isSupersededInPunch("early", punches)).toBe(false);
    const sessions = punchesToSessions(punches, getDateInManilaDefault);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].id).toBe("early");
    expect(sessions[0].clock_out_time).not.toBeNull();
  });

  test("overnight open before 7 AM still counts as open", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "in1",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-01T14:00:00+08:00",
      },
    ];
    const now = "2026-06-02T03:00:00+08:00";
    const open = getOpenEntryFromPunches(
      punches,
      getDateInManilaDefault,
      getActiveBundyBusinessDayKey(punches, now)
    );
    expect(open).not.toBeNull();
    expect(open?.id).toBe("in1");
  });
});
