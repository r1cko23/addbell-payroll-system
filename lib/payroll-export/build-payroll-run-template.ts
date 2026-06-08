import { format, subMonths } from "date-fns";
import {
  buildStoredEarningsBreakdown,
  normalizeEarningsBreakdownForExport,
  regularHoursBasicGross,
} from "@/lib/payroll-earnings-breakdown";
import {
  HOLIDAY_UNWORKED_CREDIT_HOURS,
  isEligibleForHolidayPayRule,
} from "@/utils/holidays";
import {
  resolvePayslipAllowanceAmount,
  type CutoffAllowanceRow,
} from "@/lib/payslip-allowances";
import { computePayslipNetPay } from "@/lib/payslip-net";
import {
  calculateDailyPay,
  type DayType,
} from "@/utils/payroll-calculator";

type RunRow = {
  cutoff_start: string;
  cutoff_end: string;
  company_name: string;
};

export type PayrollRunTemplateTable = {
  title: string;
  subtitle: string;
  columns: Array<{ key: string; wch: number }>;
  headerRows: any[][];
  dataRows: any[][];
  colorGroups: {
    earningsCols: number[];
    deductionCols: number[];
    netCols: number[];
  };
};

function safeNumber(n: unknown) {
  const x = Number(n ?? 0);
  return Number.isFinite(x) ? x : 0;
}

const OTHER_DEDUCTION_EXPORT_TYPES = [
  "Vale",
  "Uniform",
  "PPE",
  "Gasul",
] as const;

/** Reads Vale / Uniform / PPE / Gasul from payslip other_deduction_lines (saved on payslip UI). */
function otherDeductionAmountsFromBreakdown(ded: Record<string, unknown>) {
  const amounts: Record<(typeof OTHER_DEDUCTION_EXPORT_TYPES)[number], number> =
    {
      Vale: 0,
      Uniform: 0,
      PPE: 0,
      Gasul: 0,
    };
  const lines = ded?.other_deduction_lines;
  if (Array.isArray(lines) && lines.length > 0) {
    for (const line of lines) {
      const row = line as { type?: string; amount?: unknown };
      const typ = String(row?.type ?? "").trim();
      if (
        (OTHER_DEDUCTION_EXPORT_TYPES as readonly string[]).includes(typ)
      ) {
        amounts[typ as (typeof OTHER_DEDUCTION_EXPORT_TYPES)[number]] =
          safeNumber(row?.amount);
      }
    }
    return amounts;
  }
  // Legacy: all manual other deductions were stored only in weekly.vale.
  const weekly =
    ded?.weekly && typeof ded.weekly === "object"
      ? (ded.weekly as Record<string, unknown>)
      : null;
  amounts.Vale = safeNumber(weekly?.vale ?? ded?.vale);
  return amounts;
}

function ratePerDayAndHourFromEmployee(employee: any): { perDay: number; perHour: number } {
  const basis = String(employee?.salary_basis || "").toLowerCase();
  const baseRate = safeNumber(employee?.base_rate);
  if (!baseRate) return { perDay: 0, perHour: 0 };
  const monthlyRate = basis === "monthly" ? baseRate : baseRate * 26;
  const perDay = basis === "daily" ? baseRate : monthlyRate / 26;
  const perHour = perDay / 8;
  return {
    perDay: perDay > 0 && Number.isFinite(perDay) ? perDay : 0,
    perHour: perHour > 0 && Number.isFinite(perHour) ? perHour : 0,
  };
}

function formatHolidayRange(dates: Date[]) {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const monthLabel = format(sorted[0], "MMMM");
  const uniqueDays = [...new Set(sorted.map((d) => format(d, "d")))];
  if (uniqueDays.length === 1) return `${monthLabel} ${uniqueDays[0]}`;
  if (uniqueDays.length === 2) return `${monthLabel} ${uniqueDays[0]}-${uniqueDays[1]}`;
  return `${monthLabel} ${uniqueDays[0]}-${uniqueDays[uniqueDays.length - 1]}`;
}

function aggregateHolidayAndOtFromAttendance(
  attendance: any[],
  perHour: number
) {
  const totals = {
    regOtHours: 0,
    restOtHours: 0,
    nwhHours: 0,
    regHolHours: 0,
    regOtPay: 0,
    restOtPay: 0,
    nwhPay: 0,
    regHolPay: 0,
  };

  if (!perHour || !Array.isArray(attendance)) return totals;

  attendance.forEach((day) => {
    const dayType = (day?.dayType || "regular") as DayType;
    const regularHours = safeNumber(day?.regularHours);
    const overtimeHours = safeNumber(day?.overtimeHours);
    const nightDiffHours = safeNumber(day?.nightDiffHours);
    const calc = calculateDailyPay(
      dayType,
      regularHours,
      overtimeHours,
      nightDiffHours,
      perHour
    );

    if (dayType === "regular") {
      totals.regOtHours += overtimeHours;
      totals.regOtPay += calc.overtimePay;
      return;
    }

    if (
      dayType === "regular-holiday" ||
      dayType === "sunday-regular-holiday"
    ) {
      const eligible = isEligibleForHolidayPayRule(
        String(day?.date || ""),
        regularHours,
        attendance
      );
      if (eligible) {
        const hasCompleteLog = Boolean(day?.clockInTime && day?.clockOutTime);
        const paidH = hasCompleteLog
          ? regularHours
          : HOLIDAY_UNWORKED_CREDIT_HOURS;
        totals.regHolHours += paidH;
        totals.regHolPay += calc.regularPay;
      }
      if (overtimeHours > 0) {
        totals.regHolPay += calc.overtimePay;
      }
      return;
    }

    if (
      dayType === "non-working-holiday" ||
      dayType === "sunday-special-holiday"
    ) {
      const eligible = isEligibleForHolidayPayRule(
        String(day?.date || ""),
        regularHours,
        attendance
      );
      if (eligible) {
        const hasCompleteLog = Boolean(day?.clockInTime && day?.clockOutTime);
        const paidH = hasCompleteLog
          ? regularHours
          : HOLIDAY_UNWORKED_CREDIT_HOURS;
        totals.nwhHours += paidH;
        totals.nwhPay += calc.regularPay;
      }
      if (overtimeHours > 0) {
        totals.nwhPay += calc.overtimePay;
      }
      return;
    }

    if (dayType === "sunday") {
      totals.restOtHours += overtimeHours;
      totals.restOtPay += calc.overtimePay;
    }
  });

  return totals;
}

export function buildPayrollRunTemplateTable(params: {
  run: RunRow;
  holidays: Array<{ holiday_date: string; is_regular: boolean }>;
  slips: any[];
  cutoffAllowancesByEmployee?: Record<string, CutoffAllowanceRow>;
}): PayrollRunTemplateTable {
  const cutoffStart = String(params.run.cutoff_start);
  const cutoffEnd = String(params.run.cutoff_end);
  const companyName = String(params.run.company_name || "ADD-BELL TECHNICAL SERVICES INC.");

  const startD = new Date(cutoffStart);
  const endD = new Date(cutoffEnd);
  const subtitle = `PAYROLL FOR ${format(startD, "MMMM d")}-${format(endD, "d,  yyyy")}`.replace(
    /,  (\\d{4})$/,
    ",  $1"
  );

  let nonWorkingLabel = "Non-working Holiday";
  let regularHolidayLabel = "REG HOL";
  const parsed = (params.holidays || [])
    .map((h) => ({
      date: new Date(String(h.holiday_date).split("T")[0]),
      isRegular: Boolean(h.is_regular),
    }))
    .filter((h) => Number.isFinite(h.date.getTime()));
  const regularDates = parsed.filter((h) => h.isRegular).map((h) => h.date);
  const specialDates = parsed.filter((h) => !h.isRegular).map((h) => h.date);
  const regRange = formatHolidayRange(regularDates);
  const specRange = formatHolidayRange(specialDates);
  if (specRange) nonWorkingLabel = `Non-working Holiday ${specRange}`;
  if (regRange) regularHolidayLabel = `REG HOL  ${regRange}`;

  const allowanceMonthLabel = format(subMonths(startD, 2), "MMM  yyyy");
  const allowancesHeader = ` Allowances for ${allowanceMonthLabel}/Load `;

  const columns = [
    { key: "blank", wch: 2 },
    { key: "id_no", wch: 12 },
    { key: "nos", wch: 6 },
    { key: "name", wch: 26 },
    { key: "rateday", wch: 12 },
    { key: "days", wch: 10 },
    { key: "regular_total", wch: 16 },
    { key: "rate_hr", wch: 10 },
    { key: "ot_reg_hr", wch: 11 },
    { key: "ot_rest_hr", wch: 13 },
    { key: "ot_nwh_hr", wch: 16 },
    { key: "ot_reg_hol_hr", wch: 12 },
    { key: "night_diff_hr", wch: 12 },
    { key: "spacer1", wch: 4 },
    { key: "ot_reg_amt", wch: 14 },
    { key: "ot_rest_amt", wch: 14 },
    { key: "ot_nwh_amt", wch: 16 },
    { key: "ot_reg_hol_amt", wch: 14 },
    { key: "night_diff_amt", wch: 14 },
    { key: "late_hr", wch: 8 },
    { key: "undertime_hr", wch: 10 },
    { key: "gross", wch: 16 },
    { key: "sss", wch: 12 },
    { key: "philhealth", wch: 12 },
    { key: "pagibig", wch: 12 },
    { key: "salary_loan", wch: 12 },
    { key: "pagibig_loan", wch: 14 },
    { key: "calamity", wch: 12 },
    { key: "tax", wch: 10 },
    { key: "vale", wch: 10 },
    { key: "uniform", wch: 20 },
    { key: "adjustments", wch: 12 },
    { key: "allowances", wch: 18 },
    { key: "net", wch: 16 },
    { key: "net_payroll", wch: 16 },
  ];

  const titleRow = Array(columns.length).fill("");
  titleRow[3] = companyName;
  const subtitleRow = Array(columns.length).fill("");
  subtitleRow[3] = subtitle;

  const r3 = Array(columns.length).fill("");
  r3[1] = "ID No.#";
  r3[2] = "Nos.";
  r3[3] = "NAME";
  r3[4] = "REGULAR HOUR";
  r3[6] = " TOTAL ";
  r3[7] = " RATE/HR ";
  r3[8] = "OVERTIME, HR";
  r3[13] = "Regular";
  r3[14] = "Rest Day";
  r3[16] = "Regular";
  r3[18] = "NIGHT";
  r3[19] = "LATE";
  r3[20] = "UNDERTIME";
  r3[21] = " GROSS ";
  r3[22] = " SSS ";
  r3[23] = " PHILHEALTH ";
  r3[24] = " PAG-IBIG ";
  r3[25] = " Salary Loan ";
  r3[26] = " Pag-IBIG Loan ";
  r3[31] = " ADJUSTMENTS ";
  r3[32] = allowancesHeader;
  r3[33] = " NET ";

  const r4 = Array(columns.length).fill("");
  r4[4] = "Rateday";
  r4[5] = "No. of days";
  r4[6] = " AMOUNT ";
  r4[8] = "REG OT";
  r4[9] = "Rest Day/Sunday";
  r4[10] = nonWorkingLabel;
  r4[11] = regularHolidayLabel;
  r4[12] = "NIGHT DIFF";
  r4[13] = "Overtime";
  r4[14] = "SUNDAY";
  r4[15] = "Non-working Holiday";
  r4[16] = "HOLIDAY";
  r4[18] = "DIFF";
  r4[19] = "HR";
  r4[20] = "HR";
  r4[21] = " GROSS ";
  r4[22] = ` MONTH ${format(startD, "MMM yyyy")} `;
  r4[27] = " Calamity Loan ";
  r4[28] = " TAX ";
  r4[29] = " VALE ";
  r4[30] = " UNIFORM / SAFETY SHOES / PPE / GASUL ";
  r4[31] = " ADJUSTMENTS ";
  r4[32] = " Allowances / Load ";
  r4[33] = " NET ";
  r4[34] = " PAYROLL ";

  const dataRows: any[][] = [];
  (params.slips || []).forEach((ps: any, idx: number) => {
    const emp = ps.employees || ps.employee || {};
    const middleInitial = String(emp.middle_name || "").trim()
      ? ` ${String(emp.middle_name).trim().charAt(0)}.`
      : "";
    const fullName = `${String(emp.last_name || "").trim()}, ${String(emp.first_name || "").trim()}${middleInitial}`.trim();

    const normalized = normalizeEarningsBreakdownForExport(ps.earnings_breakdown);
    const attendance: any[] = normalized?.attendance_data || [];
    const lateHours = safeNumber(normalized?.attendance_metrics?.late_hours);
    const undertimeHours = safeNumber(
      normalized?.attendance_metrics?.undertime_hours
    );
    const { perHour } = ratePerDayAndHourFromEmployee(emp);
    const payrollResult =
      normalized?.payroll_result ||
      (perHour > 0 && attendance.length > 0
        ? buildStoredEarningsBreakdown(attendance, perHour).payroll_result
        : null);

    const totalRegularHours = Array.isArray(attendance)
      ? attendance.reduce((s, d) => s + safeNumber(d?.regularHours), 0)
      : 0;
    const { perDay } = ratePerDayAndHourFromEmployee(emp);
    const daysWorked = totalRegularHours > 0 ? totalRegularHours / 8 : 0;

    const holidayOt = aggregateHolidayAndOtFromAttendance(attendance, perHour);
    const totalOvertimeHours = holidayOt.regOtHours;
    const totalNightDiffHours = Array.isArray(attendance)
      ? attendance.reduce((s, d) => s + safeNumber(d?.nightDiffHours), 0)
      : 0;

    const otPay = holidayOt.regOtPay || safeNumber(payrollResult?.totals?.overtimePay);
    const ndPay = safeNumber(payrollResult?.totals?.nightDiffPay);
    const regularPay =
      safeNumber(payrollResult?.totals?.regularPay) ||
      (perHour > 0 ? regularHoursBasicGross(attendance, perHour) : 0);

    const gross = safeNumber(ps.gross_pay);
    const ded = ps.deductions_breakdown || {};

    const sss = safeNumber(ded?.sss) + safeNumber(ded?.sss_wisp);
    const philhealth = safeNumber(ded?.philhealth);
    const pagibig = safeNumber(ded?.pagibig);
    const tax = safeNumber(ded?.tax ?? ded?.withholding_tax);

    const salaryLoan = safeNumber(ded?.weekly?.sss_loan ?? ded?.sss_loan);
    const pagibigLoan = safeNumber(ded?.weekly?.pagibig_loan ?? ded?.pagibig_loan);
    const calamity = safeNumber(ded?.weekly?.pagibig_calamity ?? ded?.pagibig_calamity);
    const otherDeductions = otherDeductionAmountsFromBreakdown(ded);
    const vale = otherDeductions.Vale;
    const safetyShoes = safeNumber(
      (ded?.weekly?.safety_shoes ?? ded?.weekly?.safetyShoes) ??
        (ded?.safety_shoes ?? ded?.safetyShoes)
    );
    const uniformCombined =
      otherDeductions.Uniform +
      otherDeductions.PPE +
      otherDeductions.Gasul +
      safetyShoes;
    const adjustments = safeNumber(ps.adjustment_amount ?? 0);
    const cutoffAllowance = params.cutoffAllowancesByEmployee?.[ps.employee_id];
    const allowances = resolvePayslipAllowanceAmount(
      {
        allowance_amount: ps.allowance_amount,
        deductions_breakdown: ded,
      },
      cutoffAllowance
    );
    const net = computePayslipNetPay({
      grossPay: gross,
      adjustmentAmount: adjustments,
      totalDeductions: safeNumber(ps.total_deductions),
      allowanceAmount: allowances,
    });

    const row = Array(columns.length).fill("");
    row[1] = String(emp.company_id_no || "").trim() || String(ps.employee_id);
    row[2] = idx + 1;
    row[3] = fullName || "—";
    row[4] = perDay;
    row[5] = daysWorked;
    row[6] = regularPay > 0 ? regularPay : perDay > 0 ? perDay * daysWorked : gross;
    row[7] = perHour;
    row[8] = totalOvertimeHours > 0 ? totalOvertimeHours : "";
    row[9] = holidayOt.restOtHours > 0 ? holidayOt.restOtHours : "";
    row[10] = holidayOt.nwhHours > 0 ? holidayOt.nwhHours : "";
    row[11] = holidayOt.regHolHours > 0 ? holidayOt.regHolHours : "";
    row[12] = totalNightDiffHours > 0 ? totalNightDiffHours : "";
    row[13] = otPay > 0 ? otPay : "";
    row[14] = holidayOt.restOtPay > 0 ? holidayOt.restOtPay : "";
    row[15] = holidayOt.nwhPay > 0 ? holidayOt.nwhPay : "";
    row[16] = holidayOt.regHolPay > 0 ? holidayOt.regHolPay : "";
    row[18] = ndPay > 0 ? ndPay : "";
    row[19] = lateHours > 0 ? lateHours : "";
    row[20] = undertimeHours > 0 ? undertimeHours : "";
    row[21] = gross;
    row[22] = sss;
    row[23] = philhealth;
    row[24] = pagibig;
    row[25] = salaryLoan;
    row[26] = pagibigLoan;
    row[27] = calamity;
    row[28] = tax;
    row[29] = vale;
    row[30] = uniformCombined;
    row[31] = adjustments !== 0 ? adjustments : "";
    row[32] = allowances > 0 ? allowances : "";
    row[33] = net;
    row[34] = net;
    dataRows.push(row);
  });

  return {
    title: companyName,
    subtitle,
    columns,
    headerRows: [titleRow, subtitleRow, r3, r4],
    dataRows,
    colorGroups: {
      earningsCols: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
      deductionCols: [22, 23, 24, 25, 26, 27, 28, 29, 30],
      netCols: [31, 32, 33, 34],
    },
  };
}

