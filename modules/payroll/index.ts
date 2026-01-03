/**
 * Payroll Module - Public API
 *
 * This module handles all payroll-related functionality:
 * - Payslip generation and printing
 * - Salary calculations
 * - Government deductions (SSS, PhilHealth, Pag-IBIG, Tax)
 *
 * Import from this file only - internal implementation may change.
 */

// Components
export { PayslipPrint } from "@/components/PayslipPrint";
export { PayslipDetailedBreakdown } from "@/components/PayslipDetailedBreakdown";

// Services - Payroll Calculations
export {
  calculateWeeklyPayroll,
  calculateRegularPay,
  calculateRegularOT,
  calculateNightDiff,
  calculateSundayRestDay,
  calculateSundayRestDayOT,
  calculateRegularHoliday,
  calculateRegularHolidayOT,
  calculateNonWorkingHoliday,
  calculateNonWorkingHolidayOT,
  type DayType,
} from "@/utils/payroll-calculator";

// Services - Government Deductions
export {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateWithholdingTax,
  calculateMonthlySalary,
} from "@/utils/ph-deductions";

// Utilities
export { formatCurrency, generatePayslipNumber } from "@/utils/format";









