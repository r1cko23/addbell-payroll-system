import {
  contributionMonthDeductedOn,
  statutoryFromContributionMonth,
} from "@/lib/month-after-statutory";

/** One saved payslip carrying the month's basic and gross. */
const month = (basic: number, gross: number) => [
  { gross_pay: gross, earnings_breakdown: { payroll_result: { totals: { regularPay: basic } } } },
];

describe("statutory deductions match the accountant's workbook", () => {
  // Rows from SEPTEMBER sheet, 2026-ADDBELL-PAYROLL summary.
  test.each([
    ["AGUILA", 21460, 30099.51, 1500, 536.5],
    ["ALLEGO", 13640, 22187.56, 1100, 341],
    ["MARTE", 13650, 14343.75, 725, 341.25],
    ["MALLARI", 28262.5, 29954.69, 1500, 706.56],
    ["LEONARDO", 24437.5, 31489.85, 1575, 610.94],
  ])("%s", (_name, basic, gross, sssEe, philEe) => {
    const r = statutoryFromContributionMonth("2026-09", month(basic, gross));
    expect(r.sssReg + r.sssWisp).toBeCloseTo(sssEe, 2);
    expect(r.phil).toBeCloseTo(philEe, 2);
    expect(r.pagibig).toBe(200);
  });

  test("PhilHealth floor ₱250 for low basic (OCTOBER sheet, ERVERA 4,960)", () => {
    const r = statutoryFromContributionMonth("2026-10", month(4960, 4960));
    expect(r.phil).toBe(250);
    expect(r.sssReg + r.sssWisp).toBe(250);
  });

  test("basic and gross are summed across the month's weekly payslips", () => {
    const weeks = [4887.5, 5100, 4250, 5100, 5100].map((b) => month(b, b + 1000)[0]);
    const r = statutoryFromContributionMonth("2026-09", weeks);
    expect(r.basic).toBe(24437.5);
    expect(r.gross).toBe(29437.5);
  });

  test("no pay in the month: nothing deducted", () => {
    expect(statutoryFromContributionMonth("2026-09", []).total).toBe(0);
  });
});

describe("deducted on the last cutoff of the next month", () => {
  test.each([
    ["2026-10-27", "2026-09"], // Oct 21–27 deducts September (Aug 26 – Sep 29)
    ["2026-11-24", "2026-10"], // Nov 18–24 deducts October (Sep 30 – Oct 27)
    ["2026-12-29", "2026-11"],
    ["2027-01-26", "2026-12"],
  ])("pay ending %s deducts %s", (end, expected) => {
    expect(contributionMonthDeductedOn(new Date(`${end}T00:00:00`))).toBe(expected);
  });

  test.each(["2026-11-03", "2026-11-10", "2026-11-17"])("pay ending %s deducts nothing", (end) => {
    expect(contributionMonthDeductedOn(new Date(`${end}T00:00:00`))).toBeNull();
  });
});
