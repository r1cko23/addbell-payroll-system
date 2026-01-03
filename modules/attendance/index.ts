/**
 * Attendance Module - Public API
 *
 * This module handles all time and attendance functionality:
 * - Time clock entries
 * - Timesheet generation
 * - Night differential calculations
 * - Overtime tracking
 *
 * Import from this file only - internal implementation may change.
 */

// Services
export { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
export { formatPHTime } from "@/utils/format";

// Utilities - Holidays & Day Types
export {
  determineDayType,
  getDayName,
  formatDateShort,
  isDateSunday,
  type Holiday,
  type DayType,
} from "@/utils/holidays";

// Utilities - Bi-monthly Periods
export {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getBiMonthlyWorkingDays,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
