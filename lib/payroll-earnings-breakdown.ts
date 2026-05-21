import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";

export type StoredEarningsBreakdown = {
  attendance_data: any[];
  payroll_result: ReturnType<typeof calculateWeeklyPayroll> | null;
};

/** Shape persisted on payslips so Excel export and reports can read OT/ND amounts. */
export function buildStoredEarningsBreakdown(
  attendanceData: any[],
  ratePerHour: number
): StoredEarningsBreakdown {
  const data = Array.isArray(attendanceData) ? attendanceData : [];
  const payroll_result =
    ratePerHour > 0 && data.length > 0
      ? calculateWeeklyPayroll(data, ratePerHour)
      : null;
  return { attendance_data: data, payroll_result };
}

/** Prefer on-screen preview gross; fall back to attendance or recalculated payroll. */
export function resolveGrossPayForSave(params: {
  previewGrossPay: number | null;
  attendanceGrossPay?: number;
  attendanceData?: any[];
  ratePerHour: number;
}): number {
  const { previewGrossPay, attendanceGrossPay = 0, attendanceData = [], ratePerHour } =
    params;
  if (previewGrossPay !== null && previewGrossPay >= 0) {
    return Math.round(previewGrossPay * 100) / 100;
  }
  if (attendanceGrossPay > 0) {
    return Math.round(attendanceGrossPay * 100) / 100;
  }
  if (ratePerHour > 0 && attendanceData.length > 0) {
    const payrollResult = calculateWeeklyPayroll(attendanceData, ratePerHour);
    return Math.round(payrollResult.grossPay * 100) / 100;
  }
  return 0;
}

export function normalizeEarningsBreakdownForExport(
  raw: unknown
): StoredEarningsBreakdown | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return { attendance_data: raw, payroll_result: null };
  }
  if (typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const attendance_data = Array.isArray(obj.attendance_data)
      ? obj.attendance_data
      : Array.isArray(obj.payroll_result)
        ? []
        : [];
    const payroll_result =
      obj.payroll_result && typeof obj.payroll_result === "object"
        ? (obj.payroll_result as ReturnType<typeof calculateWeeklyPayroll>)
        : null;
    return { attendance_data, payroll_result };
  }
  return null;
}
