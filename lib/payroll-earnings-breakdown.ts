import { aggregateMetricsFromAttendanceDays } from "@/lib/day-attendance-summary";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import { regularHoursBasicGross } from "@/lib/ph-payroll/cutoff-gross";

export { regularHoursBasicGross } from "@/lib/ph-payroll/cutoff-gross";

export type StoredEarningsBreakdown = {
  attendance_data: any[];
  payroll_result: ReturnType<typeof calculateWeeklyPayroll> | null;
  attendance_metrics?: {
    late_hours: number;
    undertime_hours: number;
  };
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
  const { lateHours, undertimeHours } = aggregateMetricsFromAttendanceDays(data);
  return {
    attendance_data: data,
    payroll_result,
    attendance_metrics: {
      late_hours: lateHours,
      undertime_hours: undertimeHours,
    },
  };
}

/** Unified gross for UI, save, print, and bulk generate. */
export function resolveGrossPayForDisplay(params: {
  previewGrossPay?: number | null;
  attendanceData?: any[];
  ratePerHour: number;
  savedGrossPay?: number;
  attendanceGrossPay?: number;
}): number {
  const {
    previewGrossPay = null,
    attendanceData = [],
    ratePerHour,
    savedGrossPay = 0,
    attendanceGrossPay = 0,
  } = params;

  if (previewGrossPay !== null && previewGrossPay >= 0) {
    return Math.round(previewGrossPay * 100) / 100;
  }

  const basicGross = regularHoursBasicGross(attendanceData, ratePerHour);
  if (basicGross > 0) return basicGross;

  if (savedGrossPay > 0) return Math.round(savedGrossPay * 100) / 100;
  if (attendanceGrossPay > 0) return Math.round(attendanceGrossPay * 100) / 100;

  if (ratePerHour > 0 && attendanceData.length > 0) {
    const payrollResult = calculateWeeklyPayroll(attendanceData, ratePerHour);
    return Math.round(payrollResult.grossPay * 100) / 100;
  }
  return 0;
}

/** Prefer on-screen preview gross; fall back to attendance or recalculated payroll. */
export function resolveGrossPayForSave(params: {
  previewGrossPay: number | null;
  attendanceGrossPay?: number;
  attendanceData?: any[];
  ratePerHour: number;
}): number {
  return resolveGrossPayForDisplay({
    previewGrossPay: params.previewGrossPay,
    attendanceData: params.attendanceData,
    ratePerHour: params.ratePerHour,
    attendanceGrossPay: params.attendanceGrossPay,
  });
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
    const metrics = obj.attendance_metrics as
      | { late_hours?: number; undertime_hours?: number }
      | undefined;
    return {
      attendance_data,
      payroll_result,
      attendance_metrics:
        metrics &&
        (Number(metrics.late_hours) > 0 || Number(metrics.undertime_hours) > 0)
          ? {
              late_hours: Number(metrics.late_hours ?? 0),
              undertime_hours: Number(metrics.undertime_hours ?? 0),
            }
          : metrics
            ? {
                late_hours: Number(metrics.late_hours ?? 0),
                undertime_hours: Number(metrics.undertime_hours ?? 0),
              }
            : undefined,
    };
  }
  return null;
}
