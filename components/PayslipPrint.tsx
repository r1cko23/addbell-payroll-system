"use client";

import { memo, useMemo } from "react";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/format";
import {
  calculateRegularOT,
  calculateNightDiff,
  calculateRegularHoliday,
  calculateRegularHolidayOT,
  calculateNonWorkingHoliday,
  calculateNonWorkingHolidayOT,
  calculateSundayRestDay,
  calculateSundayRestDayOT,
  calculateSundaySpecialHoliday,
  calculateSundaySpecialHolidayOT,
  calculateSundayRegularHoliday,
  calculateSundayRegularHolidayOT,
  type DayType,
} from "@/utils/payroll-calculator";
import {
  HOLIDAY_UNWORKED_CREDIT_HOURS,
  isEligibleForHolidayPayRule,
} from "@/utils/holidays";
import { aggregateMetricsFromAttendanceDays } from "@/lib/day-attendance-summary";
import { creditNightDiffHours, creditWorkHoursHalfHour } from "@/utils/overtime";

interface PayslipPrintProps {
  employee: {
    employee_id: string;
    full_name: string;
    rate_per_day?: number;
    rate_per_hour?: number;
    position?: string | null;
    assigned_hotel?: string | null;
    employee_type?: "office-based" | "client-based" | null;
    job_level?: string | null;
  };
  weekStart: Date;
  weekEnd: Date;
  attendance: any;
  earnings: {
    regularPay: number;
    regularOT: number;
    regularOTHours: number;
    nightDiff: number;
    nightDiffHours: number;
    sundayRestDay: number;
    sundayRestDayHours: number;
    specialHoliday: number;
    specialHolidayHours: number;
    regularHoliday: number;
    regularHolidayHours: number;
    grossIncome: number;
  };
  deductions: {
    vale: number;
    sssLoan: number;
    sssCalamityLoan: number;
    pagibigLoan: number;
    pagibigCalamityLoan: number;
    monthlyLoan?: number; // Total monthly loans (sum of all loan types)
    monthlyLoans?: {
      sssLoan?: number;
      pagibigLoan?: number;
      companyLoan?: number;
      emergencyLoan?: number;
      otherLoan?: number;
    }; // Individual loan types for 1st cutoff (1-15) only
    sssContribution: number; // Regular SSS contribution (MSC up to PHP 20,000)
    sssWisp?: number; // WISP (Workers' Investment and Savings Program) - mandatory for MSC > PHP 20,000
    philhealthContribution: number;
    pagibigContribution: number;
    withholdingTax?: number;
    totalDeductions: number;
  };
  adjustment: number;
  adjustmentReason?: string | null;
  netPay: number;
  /** When set, print summary uses these instead of recalculated totals (matches payslip page). */
  summaryGrossPay?: number;
  summaryNetPay?: number;
  workingDays: number;
  absentDays: number;
  preparedBy: string;
}

function PayslipPrintComponent(props: PayslipPrintProps) {
  const {
    employee,
    weekStart,
    weekEnd,
    attendance,
    deductions,
    adjustment = 0,
    adjustmentReason,
    netPay: netPayProp,
    summaryGrossPay,
    summaryNetPay,
    workingDays,
    preparedBy,
  } = props;

  const attendanceMetrics = useMemo(() => {
    const saved = attendance?.attendance_metrics as
      | { late_hours?: number; undertime_hours?: number }
      | undefined;
    if (saved && (saved.late_hours != null || saved.undertime_hours != null)) {
      return {
        lateHours: Number(saved.late_hours ?? 0),
        undertimeHours: Number(saved.undertime_hours ?? 0),
      };
    }
    const data = Array.isArray(attendance?.attendance_data)
      ? (attendance.attendance_data as Array<{
          date: string;
          clockInTime?: string | null;
          clockOutTime?: string | null;
        }>)
      : [];
    return aggregateMetricsFromAttendanceDays(data);
  }, [attendance]);

  // Calculate detailed earnings breakdown from attendance data
  const ratePerHour = employee.rate_per_hour || 0;
  const ratePerDay = employee.rate_per_day || 0;

  // Identify employee type
  const isClientBased = employee.employee_type === "client-based";
  const isOfficeBased =
    employee.employee_type === "office-based" ||
    employee.employee_type === null;

  // Check if employee is Account Supervisor (client-based)
  const isAccountSupervisor =
    employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;

  // Check if employee is supervisory (office-based supervisory roles)
  const supervisoryPositions = [
    "PAYROLL SUPERVISOR",
    "ACCOUNT RECEIVABLE SUPERVISOR",
    "HR OPERATIONS SUPERVISOR",
    "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT",
    "HR SUPERVISOR - LABOR RELATIONS",
    "HR SUPERVISOR-LABOR RELATIONS", // Also match without spaces around hyphen
    "HR SUPERVISOR - EMPLOYEE ENGAGEMENT",
    "HR SUPERVISOR-EMPLOYEE ENGAGEMENT", // Also match without spaces around hyphen
  ];
  const isSupervisory =
    isOfficeBased &&
    supervisoryPositions.some((pos) =>
      employee.position?.toUpperCase().includes(pos.toUpperCase())
    );

  // Check if employee is managerial (office-based) - by job_level
  const isManagerial =
    isOfficeBased && employee.job_level?.toUpperCase() === "MANAGERIAL";

  // Check if employee is supervisory by job_level (more reliable than position matching)
  const isSupervisoryByJobLevel =
    isOfficeBased && employee.job_level?.toUpperCase() === "SUPERVISORY";

  // Office-based supervisory or managerial employees get allowances
  // Account Supervisors ALWAYS get allowances (whether office-based or client-based)
  // Check BOTH position-based and job_level-based supervisory status
  const isEligibleForAllowances =
    isAccountSupervisor || isSupervisory || isSupervisoryByJobLevel || isManagerial;

  // Rank and file office-based employees use standard calculations
  const isRankAndFile = isOfficeBased && !isEligibleForAllowances;

  const useFixedAllowances = isClientBased || isEligibleForAllowances;

  // Initialize earnings breakdown
  const earningsBreakdown = {
    basic: { days: 0, hours: 0, amount: 0 },
    overtime: { hours: 0, amount: 0 },
    nightDiff: { hours: 0, amount: 0 },
    legalHoliday: { days: 0, amount: 0 },
    legalHDOT: { hours: 0, amount: 0 },
    legalHDND: { hours: 0, amount: 0 },
    spHoliday: { days: 0, amount: 0 },
    SHOT: { hours: 0, amount: 0 },
    SHND: { hours: 0, amount: 0 },
    SHonRDOT: { hours: 0, amount: 0 },
    LHonRDOT: { hours: 0, amount: 0 },
    restDay: { days: 0, amount: 0 },
    restDayOT: { hours: 0, amount: 0 },
    restDayND: { hours: 0, amount: 0 },
    workingDayoff: { days: 0, amount: 0 },
    otherPay: { amount: 0 },
  };

  // Fixed allowances for Account Supervisors and Office-based employees
  // All OT and ND items go to Other Pay section (not in earnings table)
  const fixedAllowances = {
    regularOT: { amount: 0 },
    regularNightDiff: { amount: 0 }, // Night Differential for regular days
    legalHolidayOT: { amount: 0 },
    legalHolidayND: { amount: 0 },
    specialHolidayOT: { amount: 0 },
    specialHolidayND: { amount: 0 },
    restDayOT: { amount: 0 },
    restDayND: { amount: 0 },
    specialHolidayOnRestDayOT: { amount: 0 },
    legalHolidayOnRestDayOT: { amount: 0 },
    regularNightdiffOT: { amount: 0 },
    // Allowances for regular hours worked on holidays/rest days (not OT)
    legalHolidayAllowance: { amount: 0 }, // Regular hours worked on legal holiday
    specialHolidayAllowance: { amount: 0 }, // Regular hours worked on special holiday
    restDayAllowance: { amount: 0 }, // Regular hours worked on rest day
    specialHolidayOnRestDayAllowance: { amount: 0 }, // Regular hours worked on special holiday + rest day
    legalHolidayOnRestDayAllowance: { amount: 0 }, // Regular hours worked on legal holiday + rest day
  };

  /**
   * Calculate holiday/rest day allowance for client-based and office-based supervisory/managerial
   * Uses same fixed amounts: ₱350 for ≥4 hours, ₱700 for ≥8 hours
   * NO PRO-RATING - must meet exact hour requirements
   */
  function calculateHolidayRestDayAllowance(hours: number): number {
    if (isClientBased || isEligibleForAllowances) {
      if (hours >= 8) {
        return 700;
      } else if (hours >= 4) {
        return 350;
      }
      // No pro-rating - must meet 4 or 8 hour requirement
      return 0;
    }
    // Rank and file use standard calculation
    return 0;
  }

  let totalSalary = 0;
  let totalGrossPay = 0;

  const isEligibleForHolidayPay = isEligibleForHolidayPayRule;

  // Process attendance data if available
  if (
    attendance?.attendance_data &&
    Array.isArray(attendance.attendance_data)
  ) {
    const attendanceData = attendance.attendance_data as Array<{
      date: string;
      dayType?: DayType;
      regularHours: number;
      overtimeHours: number;
      nightDiffHours: number;
      clockInTime?: string | null;
      clockOutTime?: string | null;
    }>;

    attendanceData.forEach((day) => {
      const {
        date,
        dayType = "regular",
        regularHours: rawRegularHours,
        overtimeHours: rawOvertimeHours,
        nightDiffHours,
        clockInTime,
        clockOutTime,
      } = day;

      // Convert overtimeHours to number if it's a string
      const overtimeHours =
        typeof rawOvertimeHours === "string"
          ? parseFloat(rawOvertimeHours)
          : rawOvertimeHours || 0;

      const regularHours = creditWorkHoursHalfHour(
        Math.round((Number(rawRegularHours) || 0) * 100) / 100
      );
      const creditedNightDiffHours = creditNightDiffHours(
        Math.round((Number(nightDiffHours) || 0) * 100) / 100
      );

      // Basic salary (regular working days — Mon–Sat; Sunday rest for office-based)
      // IMPORTANT:
      // - Rest days (sunday) should NOT be included in basic salary (paid separately)
      // - Holidays should NOT be included in basic salary (paid separately)
      // - Mon–Sat: pay only actual regular hours (no automatic 8h on unworked Saturday)
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayType === "regular") {
        // REST DAY RULES:
        // - Office-based: Sunday is rest day - NOT PAID if not worked
        // - Client-based: scheduled rest days - NOT PAID if not worked
        // - Mon–Sat: only actual regularHours (6-day week; no free 8h on unworked Saturday)

        // For hotel client-based account supervisors: Sunday is also a regular workday if NOT their rest day
        // Note: If dayType === "regular" and dayOfWeek === 0, it means Sunday is NOT a rest day for client-based account supervisors
        const isSundayRegularWorkday = dayOfWeek === 0 && (isClientBased || isAccountSupervisor);

        // Regular Mon–Sat + eligible Sunday AS workdays: basic = actual regular hours only
        if ((dayOfWeek !== 0 || isSundayRegularWorkday) && regularHours > 0) {
          const hoursForBasic = regularHours;
          // Day-equivalent and hours (do not use ++ per day — that showed "2" for two partial-hour days)
          earningsBreakdown.basic.days += hoursForBasic / 8;
          earningsBreakdown.basic.hours += hoursForBasic;
          const dayAmount = hoursForBasic * ratePerHour;
          earningsBreakdown.basic.amount += dayAmount;
        }
        // Sunday (dayOfWeek === 0) is rest day for office-based - NOT included in basic salary
        // But for client-based account supervisors, Sunday is included if NOT their rest day AND they worked
      }

      if (dayType === "regular" && overtimeHours > 0) {
        earningsBreakdown.overtime.hours += overtimeHours;
        earningsBreakdown.overtime.amount += calculateRegularOT(
          overtimeHours,
          ratePerHour
        );
      }

      // Night Differential (regular days); holidays/rest days use separate ND lines
      // Policy: ND is derived from approved OT only (regular work ends at 6PM),
      // but it's displayed under the single "Night Differential" line.
      if (dayType === "regular" && creditedNightDiffHours > 0) {
        earningsBreakdown.nightDiff.hours += creditedNightDiffHours;
        earningsBreakdown.nightDiff.amount += calculateNightDiff(
          creditedNightDiffHours,
          ratePerHour
        );
      }

      // Removed: NDOT line item. ND is already represented in Night Differential above.

      // Legal Holiday
      // Regular Holiday pay is computed separately from regular work hours.
      if (dayType === "regular-holiday") {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const hoursPaid = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
          earningsBreakdown.legalHoliday.days += hoursPaid / 8;
          // Policy: eligible Regular Holiday pay always uses 2.0x, even for credited hours.
          earningsBreakdown.legalHoliday.amount += calculateRegularHoliday(
            hoursPaid,
            ratePerHour
          );

          // Premium applies when there is a complete time in/out.
          if (regularHours > 0 && clockInTime && clockOutTime) {
            if (useFixedAllowances) {
              if (clockInTime && regularHours >= 4) {
                const allowance = calculateHolidayRestDayAllowance(regularHours);
                if (allowance > 0) {
                  fixedAllowances.legalHolidayAllowance.amount += allowance;
                }
              }
            } else {
              // already included in calculateRegularHoliday above
            }
          }
        }
        // If not eligible, don't add daily rate (but OT allowance still applies if they worked OT)
        if (overtimeHours > 0) {
          earningsBreakdown.legalHDOT.hours += overtimeHours;
          earningsBreakdown.legalHDOT.amount += calculateRegularHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (creditedNightDiffHours > 0) {
          earningsBreakdown.legalHDND.hours += creditedNightDiffHours;
          earningsBreakdown.legalHDND.amount += calculateNightDiff(
            creditedNightDiffHours,
            ratePerHour
          );
        }
      }

      // Special Holiday
      // Special Holiday pay is computed separately from regular work hours.
      if (dayType === "non-working-holiday") {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const hoursPaid = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
          earningsBreakdown.spHoliday.days += hoursPaid / 8;
          // Policy: eligible Special Holiday pay always uses 1.3x, even for credited hours.
          earningsBreakdown.spHoliday.amount += calculateNonWorkingHoliday(
            hoursPaid,
            ratePerHour
          );

          if (regularHours > 0 && clockInTime && clockOutTime) {
            if (useFixedAllowances) {
              if (clockInTime && regularHours >= 4) {
                const allowance = calculateHolidayRestDayAllowance(regularHours);
                if (allowance > 0) {
                  fixedAllowances.specialHolidayAllowance.amount += allowance;
                }
              }
            } else {
              // already included in calculateNonWorkingHoliday above
            }
          }
        }
        // If not eligible, don't add daily rate (but OT allowance still applies if they worked OT)
        if (overtimeHours > 0) {
          earningsBreakdown.SHOT.hours += overtimeHours;
          earningsBreakdown.SHOT.amount += calculateNonWorkingHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
        if (creditedNightDiffHours > 0) {
          earningsBreakdown.SHND.hours += creditedNightDiffHours;
          earningsBreakdown.SHND.amount += calculateNightDiff(
            creditedNightDiffHours,
            ratePerHour
          );
        }
      }

      // Rest Day (Sunday) - Sunday is the designated rest day for office-based employees
      // For client-based Account Supervisors: Rest days are Monday, Tuesday, or Wednesday only
      // Rest days that fall on holidays are treated as holidays (holiday takes priority)
      // REST DAY PAY RULES:
      // - Office-based: Sunday is rest day - NOT PAID if not worked
      // - Client-based: Rest day (Mon/Tue/Wed) - NOT PAID if not worked
      // - Only paid if employee actually worked on rest day (regularHours > 0)
      // NOTE: Attendance data should already have correct dayType from timesheet generator
      // If dayType === "sunday" for client-based employees, it means it's their actual rest day
      if (dayType === "sunday") {
        // Only pay if employee actually worked on rest day
        if (regularHours > 0) {
          if (!useFixedAllowances) {
            // Office-based Rank and File: Standard multiplier calculation (1.3x)
            const standardAmount = calculateSundayRestDay(
              regularHours,
              ratePerHour
            );
            earningsBreakdown.restDay.days++;
            earningsBreakdown.restDay.amount += standardAmount;
          } else {
            // Client-based Account Supervisors/Supervisory/Managerial:
            // Daily rate only (1x), no multiplier
            const dailyRateAmount = regularHours * ratePerHour;
            earningsBreakdown.restDay.days++;
            earningsBreakdown.restDay.amount += dailyRateAmount;

            // Add allowance ONLY if they actually worked on the rest day (clockInTime exists and regularHours >= 4)
            if (clockInTime && regularHours >= 4) {
              const allowance = calculateHolidayRestDayAllowance(regularHours);
              if (allowance > 0) {
                fixedAllowances.restDayAllowance.amount += allowance;
              }
            }
          }
        }
        // If regularHours === 0, no rest day pay (rest day is not paid if not worked)

        if (overtimeHours > 0) {
          earningsBreakdown.restDayOT.hours += overtimeHours;
          earningsBreakdown.restDayOT.amount += calculateSundayRestDayOT(
            overtimeHours,
            ratePerHour
          );
        }

        if (creditedNightDiffHours > 0) {
          earningsBreakdown.restDayND.hours += creditedNightDiffHours;
          earningsBreakdown.restDayND.amount += calculateNightDiff(
            creditedNightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Special Holiday
      // Everyone receives the same Sunday+Special Holiday multiplier when worked.
      if (dayType === "sunday-special-holiday") {
        const eligible = isEligibleForHolidayPay(date, regularHours, attendanceData);
        if (eligible) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const hoursPaid = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
          earningsBreakdown.spHoliday.days += hoursPaid / 8;
          // Policy: eligible Sunday+Special always uses 1.5x, even for credited hours.
          earningsBreakdown.spHoliday.amount += hoursPaid * ratePerHour * 1.5;
        }
        if (overtimeHours > 0) {
          earningsBreakdown.SHonRDOT.hours += overtimeHours;
          earningsBreakdown.SHonRDOT.amount +=
            calculateSundaySpecialHolidayOT(overtimeHours, ratePerHour);
        }
        if (creditedNightDiffHours > 0) {
          earningsBreakdown.SHND.hours += creditedNightDiffHours;
          earningsBreakdown.SHND.amount += calculateNightDiff(
            creditedNightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Regular Holiday
      // Everyone receives the same Sunday+Regular Holiday multiplier when worked.
      if (dayType === "sunday-regular-holiday") {
        const eligible = isEligibleForHolidayPay(date, regularHours, attendanceData);
        if (eligible) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const hoursPaid = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
          earningsBreakdown.legalHoliday.days += hoursPaid / 8;
          // Policy: eligible Sunday+Regular always uses 2.6x, even for credited hours.
          earningsBreakdown.legalHoliday.amount += hoursPaid * ratePerHour * 2.6;
        }
        if (overtimeHours > 0) {
          earningsBreakdown.LHonRDOT.hours += overtimeHours;
          earningsBreakdown.LHonRDOT.amount +=
            calculateSundayRegularHolidayOT(overtimeHours, ratePerHour);
        }
        if (creditedNightDiffHours > 0) {
          earningsBreakdown.legalHDND.hours += creditedNightDiffHours;
          earningsBreakdown.legalHDND.amount += calculateNightDiff(
            creditedNightDiffHours,
            ratePerHour
          );
        }
      }
    });

    // For Account Supervisors and Office-based employees:
    // Total Salary = Basic + Legal Holiday + Special Holiday + Rest Day + Other Pay (OT Allowances)
    // For Rank and File:
    // Total Salary = Basic + all overtime/holiday earnings

    totalSalary =
      Object.values(earningsBreakdown).reduce((sum, item) => {
        if (typeof item === "object" && "amount" in item) {
          return sum + (item.amount || 0);
        }
        return sum;
      }, 0) +
      (useFixedAllowances
        ? fixedAllowances.legalHolidayAllowance.amount +
          fixedAllowances.specialHolidayAllowance.amount +
          fixedAllowances.restDayAllowance.amount +
          fixedAllowances.specialHolidayOnRestDayAllowance.amount +
          fixedAllowances.legalHolidayOnRestDayAllowance.amount
        : 0);

    totalGrossPay = totalSalary;
  } else {
    // Fallback to provided earnings
    // For fallback, calculate totalSalary from provided earnings
    totalSalary =
      props.earnings.regularPay +
      (props.earnings.regularOT || 0) +
      (props.earnings.nightDiff || 0) +
      (props.earnings.sundayRestDay || 0) +
      (props.earnings.specialHoliday || 0) +
      (props.earnings.regularHoliday || 0);

    // Total Gross Pay should equal Total Salary
    totalGrossPay = totalSalary;

    earningsBreakdown.basic.days = workingDays;
    earningsBreakdown.basic.amount = props.earnings.regularPay;
    earningsBreakdown.basic.hours =
      ratePerHour > 0 ? props.earnings.regularPay / ratePerHour : 0;
    earningsBreakdown.overtime.hours = props.earnings.regularOTHours;
    earningsBreakdown.overtime.amount = props.earnings.regularOT;
    earningsBreakdown.nightDiff.hours = props.earnings.nightDiffHours;
    earningsBreakdown.nightDiff.amount = props.earnings.nightDiff;
  }

  // Format name (LAST NAME, FIRST NAME)
  const formatName = (fullName: string) => {
    const parts = fullName.split(" ");
    if (parts.length >= 2) {
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(" ");
      return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}`;
    }
    return fullName.toUpperCase();
  };

  // Format period (MM/DD/YYYY to MM/DD/YYYY)
  const formatPeriod = (start: Date, end: Date) => {
    return `${format(start, "MM/dd/yyyy")} to ${format(end, "MM/dd/yyyy")}`;
  };

  // Format number with dash for zero
  const formatNumber = (value: number | string) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return num === 0 ? "-" : num.toFixed(2);
  };

  // Format currency with dash for zero
  const formatCurrencyOrDash = (value: number) => {
    return value === 0 ? "-" : formatCurrency(value);
  };

  /** Earnings "Hours" column: Basic is always shown in clock hours (not day counts). */
  const formatBasicHoursCell = () => {
    const b = earningsBreakdown.basic;
    if (b.hours > 0) return b.hours.toFixed(2);
    if (ratePerHour > 0 && b.amount > 0) {
      return (b.amount / ratePerHour).toFixed(2);
    }
    if (b.days > 0) {
      return (b.days * 8).toFixed(2);
    }
    return "-";
  };

  /** Day-equivalent amounts in data (÷8) → display as hours (×8). */
  const formatDayEquivalentAsHours = (days: number) =>
    days > 0 ? (days * 8).toFixed(2) : "-";

  // Calculate total deductions
  // Note: withholdingTax is already included in deductions.totalDeductions from props
  const totalDeductions = deductions.totalDeductions;

  const tardiness =
    ratePerHour > 0 ? attendanceMetrics.lateHours * ratePerHour : 0;
  const undertimeAmount =
    ratePerHour > 0 ? attendanceMetrics.undertimeHours * ratePerHour : 0;

  // Ensure Total Salary is calculated if not already set
  if (totalSalary === 0 && earningsBreakdown.basic.amount > 0) {
    // Fallback: if totalSalary wasn't calculated above, use basic as minimum
    totalSalary = earningsBreakdown.basic.amount;
  }

  // Gross pay follows saved/on-screen totals; late/undertime amounts are shown for reference only.
  totalGrossPay = totalSalary;
  totalSalary = totalGrossPay;

  // Net Pay = Gross Pay - Deductions + Adjustment (adjustment can be + or -)
  let netPay =
    totalGrossPay - totalDeductions + (typeof adjustment === "number" ? adjustment : 0);

  // When parent passes summary totals (live payslip screen), keep print in sync.
  if (
    typeof summaryGrossPay === "number" &&
    summaryGrossPay >= 0 &&
    Math.abs(totalGrossPay - summaryGrossPay) > 0.01
  ) {
    totalGrossPay = summaryGrossPay;
    totalSalary = summaryGrossPay;
    netPay =
      typeof summaryNetPay === "number" && summaryNetPay >= 0
        ? summaryNetPay
        : summaryGrossPay -
            totalDeductions +
            (typeof adjustment === "number" ? adjustment : 0);
  }

  const printGrossPay =
    typeof summaryGrossPay === "number" && summaryGrossPay >= 0
      ? summaryGrossPay
      : totalGrossPay;
  const printNetPay =
    typeof summaryNetPay === "number" && summaryNetPay >= 0
      ? summaryNetPay
      : netPay || netPayProp || 0;

  return (
    <div
      id="payslip-print-content"
      className="payslip-container"
      style={{
        width: "8.5in",
        padding: "0.5in",
        backgroundColor: "#fff",
        color: "#000",
        fontFamily: "Arial, sans-serif",
        fontSize: "10pt",
        lineHeight: "1.2",
      }}
    >
      {/* Header with Logo - Enlarged */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          marginBottom: "10px",
          borderBottom: "2px solid #000",
          paddingBottom: "10px",
        }}
      >
        <img
          src="/add-bell-logo-new.png"
          alt="Add-bell Technical Services, Inc."
          style={{
            height: "100px",
            width: "auto",
            objectFit: "contain",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>

      {/* Payslip Title */}
      <div
        style={{
          textAlign: "center",
          fontSize: "18pt",
          fontWeight: "bold",
          letterSpacing: "3px",
          marginBottom: "15px",
        }}
      >
        P A Y S L I P
      </div>

      {/* Employee and Period Info */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "15px",
          fontSize: "9pt",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{ padding: "3px 5px", fontWeight: "bold", width: "25%" }}
            >
              Employee Name:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              {formatName(employee.full_name)}
            </td>
            <td
              style={{ padding: "3px 5px", fontWeight: "bold", width: "25%" }}
            >
              Position:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              {employee.position || employee.assigned_hotel || "-"}
            </td>
          </tr>
          <tr>
            <td style={{ padding: "3px 5px", fontWeight: "bold" }}>
              Company Name:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              ADD-BELL TECHNICAL SERVICES, INC.
            </td>
            <td style={{ padding: "3px 5px", fontWeight: "bold" }}>
              Period Covered:
            </td>
            <td style={{ padding: "3px 5px", width: "25%" }}>
              {formatPeriod(weekStart, weekEnd)}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Earnings and Deductions Table */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        {/* Earnings Section */}
        <div style={{ width: "50%" }}>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "2px",
              fontSize: "9pt",
            }}
          >
            Earnings:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9pt",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                    width: "40%",
                  }}
                ></th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                    width: "30%",
                  }}
                >
                  Hours
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                    width: "30%",
                  }}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Basic
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatBasicHoursCell()}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.basic.amount)}
                </td>
              </tr>
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Overtime
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.overtime.hours > 0
                      ? earningsBreakdown.overtime.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.overtime.amount)}
                  </td>
                </tr>
              )}
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Night Diff
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.nightDiff.hours > 0
                      ? earningsBreakdown.nightDiff.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.nightDiff.amount)}
                  </td>
                </tr>
              )}
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Regular Holiday
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatDayEquivalentAsHours(earningsBreakdown.legalHoliday.days)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.legalHoliday.amount)}
                </td>
              </tr>
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Regular Holiday OT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.legalHDOT.hours > 0
                      ? earningsBreakdown.legalHDOT.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.legalHDOT.amount)}
                  </td>
                </tr>
              )}
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Regular Holiday ND
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.legalHDND.hours > 0
                      ? earningsBreakdown.legalHDND.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.legalHDND.amount)}
                  </td>
                </tr>
              )}
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SP Holiday
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatDayEquivalentAsHours(earningsBreakdown.spHoliday.days)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.spHoliday.amount)}
                </td>
              </tr>
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    SH OT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.SHOT.hours > 0
                      ? earningsBreakdown.SHOT.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.SHOT.amount)}
                  </td>
                </tr>
              )}
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    SH ND
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.SHND.hours > 0
                      ? earningsBreakdown.SHND.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.SHND.amount)}
                  </td>
                </tr>
              )}
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    SH on RD OT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.SHonRDOT.hours > 0
                      ? earningsBreakdown.SHonRDOT.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.SHonRDOT.amount)}
                  </td>
                </tr>
              )}
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    LH on RD OT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.LHonRDOT.hours > 0
                      ? earningsBreakdown.LHonRDOT.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.LHonRDOT.amount)}
                  </td>
                </tr>
              )}
              {/* Removed: NDOT (ND is row 2) */}
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Rest Day
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatDayEquivalentAsHours(earningsBreakdown.restDay.days)}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.restDay.amount)}
                </td>
              </tr>
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Rest Day OT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.restDayOT.hours > 0
                      ? earningsBreakdown.restDayOT.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.restDayOT.amount)}
                  </td>
                </tr>
              )}
              {(
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Rest Day ND
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.restDayND.hours > 0
                      ? earningsBreakdown.restDayND.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.restDayND.amount)}
                  </td>
                </tr>
              )}
              {/* Working Dayoff row removed - Saturday is now included in Basic Salary (regular work day per law) */}
            </tbody>
          </table>

          {/* Other Pay Section */}
          <div style={{ marginTop: "5px" }}>
            <div
              style={{
                fontWeight: "bold",
                marginBottom: "2px",
                fontSize: "9pt",
              }}
            >
              Other Pay
              {useFixedAllowances && (
                <span
                  style={{
                    fontSize: "7pt",
                    fontWeight: "normal",
                    color: "#666",
                    marginLeft: "5px",
                    fontStyle: "italic",
                  }}
                >
                  (Holiday / rest day work allowances)
                </span>
              )}
            </div>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "9pt",
              }}
            >
              <tbody>
                {useFixedAllowances ? (
                  <>
                    {/* Holiday / rest day work allowances (policy); OT & ND are in main earnings */}
                    {fixedAllowances.legalHolidayAllowance.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Regular Holiday Allowance
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          {formatCurrencyOrDash(
                            fixedAllowances.legalHolidayAllowance.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.specialHolidayAllowance.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Special Holiday Allowance
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          {formatCurrencyOrDash(
                            fixedAllowances.specialHolidayAllowance.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.restDayAllowance.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Rest Day Allowance
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          {formatCurrencyOrDash(
                            fixedAllowances.restDayAllowance.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.specialHolidayOnRestDayAllowance.amount >
                      0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Special Holiday on Rest Day Allowance
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          {formatCurrencyOrDash(
                            fixedAllowances.specialHolidayOnRestDayAllowance
                              .amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.legalHolidayOnRestDayAllowance.amount >
                      0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Regular Holiday on Rest Day Allowance
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          {formatCurrencyOrDash(
                            fixedAllowances.legalHolidayOnRestDayAllowance
                              .amount
                          )}
                        </td>
                      </tr>
                    )}
                    {/* Total Other Pay */}
                    {(fixedAllowances.legalHolidayAllowance.amount > 0 ||
                      fixedAllowances.specialHolidayAllowance.amount > 0 ||
                      fixedAllowances.restDayAllowance.amount > 0 ||
                      fixedAllowances.specialHolidayOnRestDayAllowance.amount >
                        0 ||
                      fixedAllowances.legalHolidayOnRestDayAllowance.amount >
                        0) && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Other Pay Total
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          -
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            width: "30%",
                          }}
                        >
                          {formatCurrencyOrDash(
                            fixedAllowances.legalHolidayAllowance.amount +
                              fixedAllowances.specialHolidayAllowance.amount +
                              fixedAllowances.restDayAllowance.amount +
                              fixedAllowances.specialHolidayOnRestDayAllowance
                                .amount +
                              fixedAllowances.legalHolidayOnRestDayAllowance
                                .amount
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ) : (
                  <tr>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 5px",
                        fontWeight: "bold",
                        width: "40%",
                      }}
                    >
                      Other Pay
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 5px",
                        textAlign: "right",
                        width: "30%",
                      }}
                    >
                      -
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 5px",
                        textAlign: "right",
                        width: "30%",
                      }}
                    >
                      {formatCurrencyOrDash(earningsBreakdown.otherPay.amount)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Deductions Section */}
        <div style={{ width: "50%" }}>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "2px",
              fontSize: "9pt",
              textAlign: "right",
            }}
          >
            Deduction:
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "9pt",
            }}
          >
            <thead>
              <tr>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "3px",
                    textAlign: "center",
                    fontSize: "8pt",
                  }}
                  colSpan={2}
                >
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SSS (Regular)
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.sssContribution)}
                </td>
              </tr>
              {(deductions.sssWisp || 0) > 0 && (
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    SSS WISP
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(deductions.sssWisp || 0)}
                  </td>
                </tr>
              )}
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  PhilHealth
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.philhealthContribution)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Pagi-Ibig
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(deductions.pagibigContribution)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  WTax
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrency(deductions.withholdingTax || 0)}
                </td>
              </tr>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Other Deduction
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(
                    (deductions.monthlyLoans
                      ? (deductions.monthlyLoans.sssLoan || 0) +
                        (deductions.monthlyLoans.pagibigLoan || 0) +
                        (deductions.monthlyLoans.companyLoan || 0) +
                        (deductions.monthlyLoans.emergencyLoan || 0) +
                        (deductions.monthlyLoans.otherLoan || 0)
                      : deductions.monthlyLoan || 0) +
                      (deductions.vale || 0) +
                      (deductions.sssLoan || 0) +
                      (deductions.sssCalamityLoan || 0) +
                      (deductions.pagibigLoan || 0) +
                      (deductions.pagibigCalamityLoan || 0)
                  )}
                </td>
              </tr>
              {/* Individual Loan Types */}
              {deductions.monthlyLoans &&
                (deductions.monthlyLoans.sssLoan || 0) +
                  (deductions.monthlyLoans.pagibigLoan || 0) +
                  (deductions.monthlyLoans.companyLoan || 0) +
                  (deductions.monthlyLoans.emergencyLoan || 0) +
                  (deductions.monthlyLoans.otherLoan || 0) >
                  0 && (
                  <>
                    {(deductions.monthlyLoans.sssLoan || 0) > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            paddingLeft: "15px",
                            fontSize: "8pt",
                          }}
                        >
                          SSS Loan
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            fontSize: "8pt",
                          }}
                        >
                          {formatCurrencyOrDash(
                            deductions.monthlyLoans.sssLoan || 0
                          )}
                        </td>
                      </tr>
                    )}
                    {(deductions.monthlyLoans.pagibigLoan || 0) > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            paddingLeft: "15px",
                            fontSize: "8pt",
                          }}
                        >
                          Pag-IBIG Loan
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            fontSize: "8pt",
                          }}
                        >
                          {formatCurrencyOrDash(
                            deductions.monthlyLoans.pagibigLoan || 0
                          )}
                        </td>
                      </tr>
                    )}
                    {(deductions.monthlyLoans.companyLoan || 0) > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            paddingLeft: "15px",
                            fontSize: "8pt",
                          }}
                        >
                          Company Loan
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            fontSize: "8pt",
                          }}
                        >
                          {formatCurrencyOrDash(
                            deductions.monthlyLoans.companyLoan || 0
                          )}
                        </td>
                      </tr>
                    )}
                    {(deductions.monthlyLoans.emergencyLoan || 0) > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            paddingLeft: "15px",
                            fontSize: "8pt",
                          }}
                        >
                          Emergency Loan
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            fontSize: "8pt",
                          }}
                        >
                          {formatCurrencyOrDash(
                            deductions.monthlyLoans.emergencyLoan || 0
                          )}
                        </td>
                      </tr>
                    )}
                    {(deductions.monthlyLoans.otherLoan || 0) > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            paddingLeft: "15px",
                            fontSize: "8pt",
                          }}
                        >
                          Other Loan
                        </td>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            textAlign: "right",
                            fontSize: "8pt",
                          }}
                        >
                          {formatCurrencyOrDash(
                            deductions.monthlyLoans.otherLoan || 0
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )}
              {/* Fallback for old format (backward compatibility) */}
              {!deductions.monthlyLoans &&
                (deductions.monthlyLoan || 0) > 0 && (
                  <tr>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 5px",
                        paddingLeft: "15px",
                        fontSize: "8pt",
                      }}
                    >
                      Monthly Loan
                    </td>
                    <td
                      style={{
                        border: "1px solid #000",
                        padding: "3px 5px",
                        textAlign: "right",
                        fontSize: "8pt",
                      }}
                    >
                      {formatCurrencyOrDash(deductions.monthlyLoan || 0)}
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Section */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "9pt",
          marginTop: "10px",
        }}
      >
        <tbody>
          <tr>
            <td
              style={{ width: "50%", padding: "3px 5px", verticalAlign: "top" }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Total Salary:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "8px",
                  borderBottom: "1px solid #000",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(totalSalary)}
              </div>
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Less Tardiness:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "8px",
                  borderBottom: "1px solid #000",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(tardiness)}
                {attendanceMetrics.lateHours > 0 && (
                  <span style={{ fontSize: "7pt", color: "#444" }}>
                    {" "}
                    ({attendanceMetrics.lateHours}h)
                  </span>
                )}
              </div>
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Less Undertime:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "8px",
                  borderBottom: "1px solid #000",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(undertimeAmount)}
                {attendanceMetrics.undertimeHours > 0 && (
                  <span style={{ fontSize: "7pt", color: "#444" }}>
                    {" "}
                    ({attendanceMetrics.undertimeHours}h)
                  </span>
                )}
              </div>
              <div
                style={{
                  fontWeight: "bold",
                  marginTop: "5px",
                  marginBottom: "3px",
                }}
              >
                Total Gross Pay:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  borderTop: "2px solid #000",
                  borderBottom: "2px solid #000",
                  paddingTop: "3px",
                  paddingBottom: "3px",
                }}
              >
                {formatCurrency(printGrossPay)}
              </div>
            </td>
            <td
              style={{ width: "50%", padding: "3px 5px", verticalAlign: "top" }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "3px" }}>
                Total Deduction:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  borderTop: "1px solid #000",
                  borderBottom: "1px solid #000",
                  paddingTop: "2px",
                  paddingBottom: "2px",
                }}
              >
                {formatCurrency(totalDeductions)}
              </div>
              {(typeof adjustment === "number" && adjustment !== 0) && (
                <>
                  <div
                    style={{
                      fontWeight: "bold",
                      marginTop: "10px",
                      marginBottom: "3px",
                    }}
                  >
                    Adjustment:
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      marginBottom: "5px",
                      fontWeight: "bold",
                      color: adjustment >= 0 ? "#166534" : "#b91c1c",
                    }}
                  >
                    {adjustment >= 0 ? "+" : ""}{formatCurrency(adjustment)}
                    {adjustmentReason && (
                      <div style={{ fontWeight: "normal", fontSize: "8pt", color: "#374151", marginTop: "2px" }}>
                        {adjustmentReason}
                      </div>
                    )}
                  </div>
                </>
              )}
              <div
                style={{
                  fontWeight: "bold",
                  marginTop: "15px",
                  marginBottom: "3px",
                }}
              >
                Net Pay:
              </div>
              <div
                style={{
                  textAlign: "right",
                  marginBottom: "5px",
                  fontWeight: "bold",
                  borderTop: "2px solid #000",
                  borderBottom: "2px solid #000",
                  paddingTop: "3px",
                  paddingBottom: "3px",
                  fontSize: "11pt",
                }}
              >
                {formatCurrency(printNetPay)}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Memoize to prevent expensive recalculations when parent re-renders
export const PayslipPrint = memo(PayslipPrintComponent);