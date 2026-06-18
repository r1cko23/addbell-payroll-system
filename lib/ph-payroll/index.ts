/**
 * Philippine Payroll Module (Frappe HR / ERPNext-inspired)
 *
 * Public API — import from here for cutoff attendance and gross pay.
 * Phase 1 (Sprint A): unified attendance + rates + gross resolution.
 */

export {
  computeDaysWork,
  sumRegularDayHours,
  sumAttendanceRegularHours,
} from "./attendance-cutoff";
export {
  resolveDaysWorkTotals,
  rollupActualBHForDaysWork,
  rollupRenderedSpecialBH,
  excludeWorkedSpecialDayFromDaysWork,
  isEligibleForAllowancesEmployee,
} from "./days-work-rollup";
export type {
  DaysWorkRollupDay,
  DaysWorkEmployeeContext,
  ResolvedDaysWork,
} from "./days-work-rollup";
export { WEEKLY_MAX_CUTOFF_HOURS } from "./types";
export type { DaysWorkInput, DaysWorkResult, HolidayForCutoff, TaxFrequency } from "./types";

export {
  getRatePerHour,
  getRatePerDay,
  getMonthlySalary,
  type RateEmployee,
} from "./employee-rates";

export {
  buildLeaveDatesMap,
  applyLeaveOverlayToAttendance,
  getSilCreditedDates,
  type LeaveDayInfo,
  type LeaveRequestRow,
} from "./leave-overlay";

export {
  buildCutoffAttendance,
  type BuildCutoffAttendanceInput,
  type CutoffAttendanceResult,
} from "./build-cutoff-attendance";

export {
  regularHoursBasicGross,
  computeWeeklyGrossFromAttendance,
  resolveCutoffGrossPay,
} from "./cutoff-gross";

export {
  resolveRegisterPeriod,
  payslipOverlapsPeriod,
  buildRegisterRow,
  groupPayslipsByEmployee,
  type RegisterPeriodMode,
  type RegisterPeriod,
  type RegisterRow,
  type RegisterPayslip,
} from "./payroll-register";

export {
  resolveTimesheetReviewStatus,
  canGeneratePayslipForTimesheet,
  summarizeTimesheetReadiness,
  type TimesheetReviewStatus,
  type TimesheetReadinessSummary,
} from "./timesheet-review";

export { buildApprovedOvertimeMaps } from "./prepare-overtime-maps";
export type { OvertimeRequestForMaps } from "./prepare-overtime-maps";
export { computePayslipHoursDisplay } from "./payslip-hours";

export {
  validatePayrollEntry,
  buildPayrollEntryRow,
  summarizePayrollEntry,
  payrollEntryRowsToCsv,
  hasEmployeePayRate,
  type PayrollEntryStatus,
  type PayrollEntryRow,
  type PayrollEntrySummary,
  type PayrollEntryEmployeeInput,
} from "./payroll-entry-validation";
