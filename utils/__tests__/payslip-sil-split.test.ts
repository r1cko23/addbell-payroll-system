import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { mapPayslipAttendanceDays } from "@/lib/map-payslip-attendance-days";
import { moveSilOutOfBasic } from "@/lib/payslip-print-sync";

function punch(date: string, start: string, end: string) {
  return {
    id: date,
    employee_id: "employee-1",
    clock_in_time: `${date}T${start}+08:00`,
    clock_out_time: `${date}T${end}+08:00`,
    regular_hours: null,
    overtime_hours: 0,
    total_night_diff_hours: 0,
    status: "approved",
  };
}

describe("SIL hours are kept apart from Basic on the payslip", () => {
  const periodStart = new Date(2026, 10, 4, 12, 0, 0);
  const periodEnd = new Date(2026, 10, 10, 12, 0, 0);

  test("generator tags only the leave-credited hours", () => {
    const result = generateTimesheetFromClockEntries(
      [punch("2026-11-05", "07:00:00", "18:00:00")],
      periodStart,
      periodEnd,
      [],
      undefined,
      true,
      true,
      false,
      undefined,
      undefined,
      false,
      new Map([
        ["2026-11-06", 8],
        ["2026-11-05", 4],
      ])
    );
    const day = (d: string) => result.attendance_data.find((a) => a.date === d);
    expect(day("2026-11-06")).toMatchObject({ regularHours: 8, leaveHours: 8 });
    // Worked more than the half-day leave credit: nothing came from leave.
    expect(day("2026-11-05")?.leaveHours).toBeUndefined();
    expect(day("2026-11-04")?.leaveHours).toBeUndefined();
  });

  test("leave hours survive the payslip day merge", () => {
    const [day] = mapPayslipAttendanceDays(
      [{ date: "2026-11-06", dayType: "regular", regularHours: 8, overtimeHours: 0, nightDiffHours: 0, leaveHours: 8 }],
      []
    );
    expect(day.leaveHours).toBe(8);
  });

  test("Eleazar Nov 4-10: Basic 40h, SIL 8h, same total", () => {
    const rate = 106.25;
    const days = [
      { date: "2026-11-04", dayType: "regular", regularHours: 10 },
      { date: "2026-11-05", dayType: "regular", regularHours: 10 },
      { date: "2026-11-06", dayType: "regular", regularHours: 8, leaveHours: 8 },
      { date: "2026-11-07", dayType: "regular", regularHours: 0 },
      { date: "2026-11-08", dayType: "sunday", regularHours: 0 },
      { date: "2026-11-09", dayType: "regular", regularHours: 10 },
      { date: "2026-11-10", dayType: "regular", regularHours: 10 },
    ];
    const table = {
      basic: { days: 6, hours: 48, amount: 5100 },
      sil: { hours: 0, amount: 0 },
    };
    moveSilOutOfBasic(table, days, rate, false);
    expect(table.basic).toEqual({ days: 5, hours: 40, amount: 4250 });
    expect(table.sil).toEqual({ hours: 8, amount: 850 });
  });

  test("no leave hours: Basic unchanged", () => {
    const table = {
      basic: { days: 5, hours: 40, amount: 4250 },
      sil: { hours: 0, amount: 0 },
    };
    moveSilOutOfBasic(table, [{ date: "2026-11-04", regularHours: 10 }], 106.25, false);
    expect(table.basic.hours).toBe(40);
    expect(table.sil.hours).toBe(0);
  });
});
