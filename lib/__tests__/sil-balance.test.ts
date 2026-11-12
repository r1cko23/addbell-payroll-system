import { computeSilBalance, silDaysInYear, type SilLeaveRow } from "@/lib/sil-balance";

function leave(over: Partial<SilLeaveRow>): SilLeaveRow {
  return {
    employee_id: "e",
    leave_type: "Sick Leave",
    status: "approved_by_hr",
    start_date: "2026-07-30",
    total_days: 1,
    selected_dates: ["2026-07-30"],
    half_day_dates: [],
    ...over,
  };
}

describe("SIL balance from leave requests", () => {
  test("Eleazar 2026: 3 approved days leaves 2", () => {
    const b = computeSilBalance(
      [
        leave({ selected_dates: ["2026-07-30", "2026-07-31"], total_days: 2 }),
        leave({ start_date: "2026-11-06", selected_dates: ["2026-11-06"] }),
        leave({ leave_type: "LWOP", selected_dates: ["2026-05-04"] }),
      ],
      "2026"
    );
    expect(b).toEqual({ used: 3, pending: 0, remaining: 2, available: 2 });
  });

  test("pending reserves days for filing but not for HR's remaining", () => {
    const b = computeSilBalance(
      [leave({}), leave({ status: "pending", selected_dates: ["2026-08-03", "2026-08-04"] })],
      "2026"
    );
    expect(b).toMatchObject({ used: 1, pending: 2, remaining: 4, available: 2 });
  });

  test("rejected and cancelled do not count", () => {
    const b = computeSilBalance(
      [leave({ status: "rejected" }), leave({ status: "cancelled" })],
      "2026"
    );
    expect(b.available).toBe(5);
  });

  test("half days count 0.5", () => {
    expect(
      silDaysInYear(
        leave({ selected_dates: ["2026-06-26", "2026-06-29"], half_day_dates: ["2026-06-26"] }),
        "2026"
      )
    ).toBe(1.5);
  });

  test("new year resets: Dec→Jan leave splits by date", () => {
    const row = leave({
      start_date: "2026-12-31",
      selected_dates: ["2026-12-31", "2027-01-04"],
      total_days: 2,
    });
    expect(silDaysInYear(row, "2026")).toBe(1);
    expect(computeSilBalance([row], "2027").available).toBe(4);
  });

  test("never below zero", () => {
    const dates = ["2026-01-05", "2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09", "2026-01-12"];
    expect(computeSilBalance([leave({ selected_dates: dates })], "2026").available).toBe(0);
  });
});
