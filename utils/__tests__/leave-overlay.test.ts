import { describe, expect, test } from "vitest";
import {
  APPROVED_LEAVE_COLUMNS,
  buildLeaveDatesMap,
  type LeaveRequestRow,
} from "@/lib/ph-payroll/leave-overlay";

/** Full leave_requests row as stored for Daniel Tabada's Oct 2026 SIL. */
const danielDbRow = {
  id: "leave-1",
  employee_id: "daniel",
  leave_type: "Sick Leave",
  leave_subtype: "regular_sil",
  start_date: "2026-10-08",
  end_date: "2026-10-13",
  total_days: 2,
  selected_dates: ["2026-10-08", "2026-10-13"],
  half_day_dates: [],
  status: "approved_by_hr",
};

function asFetched(row: Record<string, unknown>): LeaveRequestRow {
  const cols = APPROVED_LEAVE_COLUMNS.split(",").map((c) => c.trim());
  return Object.fromEntries(cols.map((c) => [c, row[c]])) as LeaveRequestRow;
}

describe("approved leave as payroll fetches it", () => {
  test("Daniel: only the picked SIL days are credited, not the whole range", () => {
    const map = buildLeaveDatesMap([asFetched(danielDbRow)], "2026-10-07", "2026-10-13");
    expect([...map.keys()].sort()).toEqual(["2026-10-08", "2026-10-13"]);
  });

  test("one picked day credits one day", () => {
    const row = { ...danielDbRow, end_date: "2026-10-08", selected_dates: ["2026-10-08"] };
    const map = buildLeaveDatesMap([asFetched(row)], "2026-10-07", "2026-10-13");
    expect([...map.keys()]).toEqual(["2026-10-08"]);
  });

  test("legacy row without picked days still credits its range", () => {
    const row = { ...danielDbRow, end_date: "2026-10-09", selected_dates: null };
    const map = buildLeaveDatesMap([asFetched(row)], "2026-10-07", "2026-10-13");
    expect([...map.keys()].sort()).toEqual(["2026-10-08", "2026-10-09"]);
  });

  test("half-day picked date is flagged half day", () => {
    const row = {
      ...danielDbRow,
      selected_dates: ["2026-10-08"],
      half_day_dates: ["2026-10-08"],
    };
    const map = buildLeaveDatesMap([asFetched(row)], "2026-10-07", "2026-10-13");
    expect(map.get("2026-10-08")?.isHalfDay).toBe(true);
  });
});
