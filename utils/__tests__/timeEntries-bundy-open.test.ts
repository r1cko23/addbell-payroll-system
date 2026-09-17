import {
  getActiveBundyBusinessDayKey,
  getOpenEntryFromPunches,
  isAdminManualBackfillPunch,
  isStaleAdminManualOpenIn,
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

  test("same-day admin manual time in stays open for bundy clock out", () => {
    const now = new Date();
    const punches: TimeEntryPunch[] = [
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: now.toISOString(),
        source: "admin_correction",
        device_info: "admin:manual time in — forgot to clock in",
      },
    ];
    expect(isAdminManualBackfillPunch(punches[0])).toBe(true);
    expect(isStaleAdminManualOpenIn(punches[0], now)).toBe(false);
    const open = getOpenEntryFromPunches(punches, getDateInManilaDefault);
    expect(open?.id).toBe("admin-in");
  });

  test("admin manual time in does not supersede open employee web clock-in", () => {
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
        punched_at: "2026-06-10T22:48:00+00:00",
        source: "admin_correction",
        device_info: "admin:manual time in",
      },
    ];
    const sessions = punchesToSessions(punches, getDateInManilaDefault);
    const open = sessions.filter((s) => !s.clock_out_time);
    expect(open).toHaveLength(2);
    expect(open.map((s) => s.id).sort()).toEqual(["admin-in", "web-in"]);
    expect(getOpenEntryFromPunches(punches, getDateInManilaDefault)?.id).toBe(
      "web-in"
    );
  });

  test("prior-day admin manual time in past 23h does not block bundy", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-06-08T23:00:00+00:00",
        source: "admin_correction",
        device_info: "admin:manual time in — forgot to clock in",
      },
    ];
    const now = new Date("2026-06-10T10:00:00+08:00");
    expect(isStaleAdminManualOpenIn(punches[0], now)).toBe(true);
    const open = getOpenEntryFromPunches(punches, getDateInManilaDefault, undefined);
    expect(open).toBeNull();
  });

  test("admin manual time in stays open after midnight until 23h", () => {
    const now = new Date();
    const punches: TimeEntryPunch[] = [
      {
        id: "admin-in",
        employee_id: "x",
        punch_type: "in",
        punched_at: new Date(now.getTime() - 22 * 60 * 60 * 1000).toISOString(),
        source: "admin_correction",
        device_info: "admin:manual time in",
      },
    ];
    expect(isStaleAdminManualOpenIn(punches[0], now)).toBe(false);
    const open = getOpenEntryFromPunches(punches, getDateInManilaDefault);
    expect(open?.id).toBe("admin-in");
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

  // Carizza Leonardo, Sep 16–17 2026: Time In 06:00 PHT, Time Out 04:53 PHT next day (~22h53m).
  // Toast said clocked out, but Time Out stayed enabled because pairing capped at 20h.
  test("employee Time Out within 23h closes overnight session (Carizza 22h53m)", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "1a613a33",
        employee_id: "carizza",
        punch_type: "in",
        punched_at: "2026-09-15T22:00:42.400Z",
        source: "web",
      },
      {
        id: "c74501a4",
        employee_id: "carizza",
        punch_type: "out",
        punched_at: "2026-09-16T20:53:32.483Z",
        source: "web",
      },
    ];
    const sessions = punchesToSessions(punches, getDateInManilaDefault);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clock_out_time).toBe("2026-09-16T20:53:32.483Z");
    expect(getOpenEntryFromPunches(punches, getDateInManilaDefault)).toBeNull();
  });

  test("retry Time Outs after a 22h53m clock-out stay closed", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "1a613a33",
        employee_id: "carizza",
        punch_type: "in",
        punched_at: "2026-09-15T22:00:42.400Z",
        source: "web",
      },
      {
        id: "c74501a4",
        employee_id: "carizza",
        punch_type: "out",
        punched_at: "2026-09-16T20:53:32.483Z",
        source: "web",
      },
      {
        id: "6c29ba31",
        employee_id: "carizza",
        punch_type: "out",
        punched_at: "2026-09-16T20:53:43.239Z",
        source: "web",
      },
      {
        id: "be5c970e",
        employee_id: "carizza",
        punch_type: "out",
        punched_at: "2026-09-16T20:54:00.421Z",
        source: "web",
      },
      {
        id: "a9b97ac1",
        employee_id: "carizza",
        punch_type: "out",
        punched_at: "2026-09-16T20:54:17.116Z",
        source: "web",
      },
    ];
    expect(getOpenEntryFromPunches(punches, getDateInManilaDefault)).toBeNull();
    const sessions = punchesToSessions(punches, getDateInManilaDefault);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].out_punch_id).toBe("c74501a4");
  });

  test("employee Time Out after 23h does not pair (auto-close window)", () => {
    const punches: TimeEntryPunch[] = [
      {
        id: "in1",
        employee_id: "x",
        punch_type: "in",
        punched_at: "2026-09-16T06:00:00+08:00",
        source: "web",
      },
      {
        id: "out1",
        employee_id: "x",
        punch_type: "out",
        punched_at: "2026-09-17T05:01:00+08:00",
        source: "web",
      },
    ];
    const sessions = punchesToSessions(punches, getDateInManilaDefault);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].clock_out_time).toBeNull();
    expect(getOpenEntryFromPunches(punches, getDateInManilaDefault)?.id).toBe(
      "in1"
    );
  });
});
