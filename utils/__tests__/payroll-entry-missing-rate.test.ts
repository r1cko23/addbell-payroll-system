import { buildPayrollEntryRow } from "@/lib/ph-payroll/payroll-entry-validation";

describe("buildPayrollEntryRow missing rate", () => {
  test("a monthly employee with time entries and a zero rate is a warning, not blocked", () => {
    const row = buildPayrollEntryRow(
      {
        id: "emp-1",
        employee_id: "74",
        full_name: "MAY-ANN GABION LACUPANTO",
        salary_basis: "monthly",
        base_rate: 0,
        employment_type: "probationary",
      },
      {
        clockEntryCount: 5,
        clockEntryDates: new Set([
          "2026-09-23",
          "2026-09-24",
          "2026-09-25",
          "2026-09-28",
          "2026-09-29",
        ]),
        timesheet: null,
        payslip: null,
        holidays: [],
        periodStart: new Date("2026-09-23T12:00:00+08:00"),
        periodEnd: new Date("2026-09-29T12:00:00+08:00"),
      }
    );

    expect(row.hasRate).toBe(false);
    expect(row.status).toBe("warning");
    expect(row.issues).toEqual([]);
    expect(row.warnings).toContain("Missing pay rate (base_rate + salary_basis)");
  });
});
