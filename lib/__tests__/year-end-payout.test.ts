import * as XLSX from "xlsx";
import {
  buildYearEndRows,
  matchAppEmployee,
  parseThirteenthMonthWorkbook,
} from "@/lib/year-end-payout";

/** Same layout as HR's "13th-Month-pay-2026-Manpower.xlsx" Admin sheet. */
function workbook() {
  const ws = XLSX.utils.aoa_to_sheet([
    ["ADD-BELL 13TH MONTH"],
    ["ID #", "", "NAMES"],
    [],
    ["", "", "Names", "RATE", "Dec 10-16", "Dec 17-23", "Total days (12)", "Amount", "New Rate", "Mar 4-10", "Mar 11-17"],
    ["", 5, "Conte Eleazar", 800, 6, 5.4, 11.4, 9120, 850, 6, 5.7],
    // Resigned mid-year: totals typed into week columns (Milo Gilbert row).
    ["", 4, "Milo Gilbert", 700, 6, 6, 12, 8400, 750, 66, 49500],
    ["", "", "Resigned"],
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Admin");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["no header here"]]), "Notes");
  return wb;
}

describe("13th month from HR's sheet", () => {
  test("basic = Amount cells + open weeks × latest rate", () => {
    const [eleazar] = parseThirteenthMonthWorkbook(workbook());
    expect(eleazar).toMatchObject({ sheet: "Admin", name: "Conte Eleazar", rate: 850 });
    expect(eleazar.basic).toBe(9120 + 11.7 * 850);
  });

  test("week cells that cannot be one week's days are skipped and reported", () => {
    const rows = parseThirteenthMonthWorkbook(workbook());
    const gilbert = rows.find((r) => r.name === "Milo Gilbert")!;
    expect(gilbert.basic).toBe(8400);
    expect(gilbert.skipped).toEqual(["J6", "K6"]);
    expect(rows.find((r) => r.name === "Resigned")).toBeUndefined();
  });

  test("matches app employees by name words, preferring active", () => {
    const employees = [
      { id: "old", employee_id: "AX2025-24", full_name: "KEVEN JABONERO PABLO", is_active: false },
      { id: "new", employee_id: "75", full_name: "KEVEN JABONERO PABLO", is_active: true },
      { id: "e", employee_id: "2025-004", full_name: "ELEAZAR DACPANO CONTE", is_active: true },
    ];
    const row = (name: string, code = "") => ({ sheet: "S", code, name, basic: 1, rate: 1, skipped: [] });
    expect(matchAppEmployee(row("Keven Pablo"), employees)?.id).toBe("new");
    expect(matchAppEmployee(row("Conte Eleazar"), employees)?.id).toBe("e");
    expect(matchAppEmployee(row("Someone Else"), employees)).toBeNull();
    expect(matchAppEmployee(row("x", "2025-004"), employees)?.id).toBe("e");
  });

  test("13th month = basic ÷ 12, plus unused SIL × app daily rate", () => {
    const [row] = buildYearEndRows(
      [{ sheet: "Admin", code: "", name: "Conte Eleazar", basic: 202350, rate: 850, skipped: [] }],
      [{ id: "e", employee_id: "2025-004", full_name: "ELEAZAR DACPANO CONTE", salary_basis: "daily", base_rate: 850, is_active: true }],
      [
        {
          employee_id: "e",
          leave_type: "Sick Leave",
          status: "approved_by_hr",
          start_date: "2026-07-30",
          total_days: 3,
          selected_dates: ["2026-07-30", "2026-07-31", "2026-11-06"],
          half_day_dates: [],
        },
      ],
      2026
    );
    expect(row).toMatchObject({
      thirteenthMonth: 16862.5,
      silUnusedDays: 2,
      dailyRate: 850,
      silCash: 1700,
      total: 18562.5,
      employeeId: "e",
    });
  });

  test("uses the sheet's latest rate; inactive employees get no SIL cash", () => {
    const rows = buildYearEndRows(
      [
        { sheet: "Admin", code: "", name: "Aguila William", basic: 182050, rate: 740, skipped: [] },
        { sheet: "Manpower", code: "", name: "Tumlos Jay", basic: 80600, rate: 620, skipped: [] },
      ],
      [
        { id: "a", employee_id: "2014-014", full_name: "WILLIAM MATIBAG AGUILA", salary_basis: "daily", base_rate: 690, is_active: true },
        { id: "t", employee_id: "2015-038", full_name: "JAY ALLAN BILAOS TUMLOS", salary_basis: "daily", base_rate: 620, is_active: false },
      ],
      [],
      2026
    );
    expect(rows[0]).toMatchObject({ dailyRate: 740, silUnusedDays: 5, silCash: 3700 });
    expect(rows[1]).toMatchObject({ silUnusedDays: 0, silCash: 0 });
    expect(rows[1].notes).toContain("Inactive in the app: SIL settled in final pay");
  });

  test("not in the app: 13th month from the sheet, no SIL cash, noted", () => {
    const [row] = buildYearEndRows(
      [{ sheet: "Manpower", code: "", name: "Mendoza, Norman", basic: 18000, rate: 600, skipped: [] }],
      [],
      [],
      2026
    );
    expect(row).toMatchObject({ thirteenthMonth: 1500, silCash: 0, total: 1500, employeeId: null });
    expect(row.notes).toContain("Not found in the app: no SIL cash");
  });
});
