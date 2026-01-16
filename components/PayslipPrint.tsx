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
  netPay: number;
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
    netPay: netPayProp,
    workingDays,
    preparedBy,
  } = props;

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

  // Check if employee is managerial (office-based)
  const isManagerial =
    isOfficeBased && employee.job_level?.toUpperCase() === "MANAGERIAL";

  // Office-based supervisory or managerial employees get allowances
  // Account Supervisors ALWAYS get allowances (whether office-based or client-based)
  const isEligibleForAllowances =
    isAccountSupervisor || isSupervisory || isManagerial;

  // Rank and file office-based employees use standard calculations
  const isRankAndFile = isOfficeBased && !isEligibleForAllowances;

  const useFixedAllowances = isClientBased || isEligibleForAllowances;

  // Initialize earnings breakdown
  const earningsBreakdown = {
    basic: { days: 0, amount: 0 },
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
    NDOT: { hours: 0, amount: 0 },
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
   * Calculate OT allowance based on employee type
   * Client-based, Office-based Supervisory/Managerial: First 2 hours = ₱200 total, then ₱100 per succeeding hour
   * Office-based Rank and File: Standard calculation (1.25x hourly rate)
   */
  function calculateOTAllowance(hours: number): number {
    // Client-based employees and Office-based Supervisory/Managerial: First 2 hours = ₱200, then ₱100 per succeeding hour
    if (isClientBased || isAccountSupervisor || isEligibleForAllowances) {
      if (hours < 2) {
        return 0;
      }
      // First 2 hours = ₱200, then ₱100 per succeeding hour
      return 200 + Math.max(0, hours - 2) * 100;
    }
    // Office-based Rank and File: Standard calculation (1.25x hourly rate)
    return calculateRegularOT(hours, ratePerHour);
  }

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

  /**
   * Calculate holiday/rest day OT allowance for client-based and office-based supervisory/managerial
   * Uses same fixed amounts: ₱350 for ≥4 hours, ₱700 for ≥8 hours
   * NO PRO-RATING - must meet exact hour requirements
   */
  function calculateHolidayRestDayOTAllowance(hours: number): number {
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

  /**
   * Helper function to check "1 Day Before" rule for holidays
   * Returns true if employee is eligible for holiday daily rate:
   * - If they worked on the holiday itself (regularHours > 0), they get daily rate regardless
   * - If they didn't work on the holiday, they must have worked the day before (regularHours >= 8)
   */
  const isEligibleForHolidayPay = (
    currentDate: string,
    currentRegularHours: number,
    attendanceData: Array<{
      date: string;
      dayType?: DayType;
      regularHours: number;
      overtimeHours: number;
      nightDiffHours: number;
      clockInTime?: string | null;
      clockOutTime?: string | null;
    }>
  ): boolean => {
    // If employee worked on the holiday itself, they get daily rate regardless
    if (currentRegularHours > 0) {
      return true;
    }

    // If they didn't work on the holiday, check if they worked a REGULAR WORKING DAY before
    // Search up to 7 days back to find the last REGULAR WORKING DAY (skip holidays and rest days)
    // This matches the timesheet generation logic
    const currentDateObj = new Date(currentDate);
    for (let i = 1; i <= 7; i++) {
      const checkDateObj = new Date(currentDateObj);
      checkDateObj.setDate(checkDateObj.getDate() - i);
      const checkDateStr = checkDateObj.toISOString().split("T")[0];

      // Find the day in attendance data
      const checkDay = attendanceData.find(
        (day) => day.date === checkDateStr
      );

      if (checkDay) {
        // Only count REGULAR WORKING DAYS (skip holidays and rest days)
        if (
          checkDay.dayType === "regular" &&
          (checkDay.regularHours || 0) >= 8
        ) {
          return true; // Found a regular working day with 8+ hours
        }
        // If it's a rest day or holiday, continue searching backwards
      }
    }

    return false;
  };

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
        regularHours,
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

      // Basic salary (regular working days ONLY - Mon-Fri)
      // IMPORTANT:
      // - Rest days (sunday) should NOT be included in basic salary (paid separately)
      // - Saturday company benefit should NOT be included in basic salary (shown separately)
      // - Holidays should NOT be included in basic salary (paid separately)
      // - Account Supervisor's first rest day IS included in basic salary (it's part of their 6-day work week)
      // Basic Salary = ONLY regular work days (Mon-Fri) that were actually worked
      // PLUS Account Supervisor's first rest day (even if not worked, gets 8 BH from timesheet generator)
      const dateObj = new Date(date);
      const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

      if (dayType === "regular") {
        // REST DAY RULES:
        // - Office-based: Sunday is rest day - NOT PAID if not worked
        // - Client-based: Rest day (Mon/Tue/Wed) - NOT PAID if not worked
        // - Only paid if employee actually worked (regularHours > 0)
        // - Saturday: Office-based gets 8 BH even if not worked (regular work day per law)
        // - Client-based: Saturday is normal workday - must have clock entries to be paid

        // For hotel client-based account supervisors: Sunday is also a regular workday if NOT their rest day
        // Note: If dayType === "regular" and dayOfWeek === 0, it means Sunday is NOT a rest day for client-based account supervisors
        const isSundayRegularWorkday = dayOfWeek === 0 && (isClientBased || isAccountSupervisor);

        // Count regular work days (Mon-Sat for office-based, or Mon-Sat + Sun for client-based if not rest day)
        // Only include days with actual work OR Saturday (office-based only) with no work
        if ((dayOfWeek !== 0 || isSundayRegularWorkday) && (regularHours > 0 || (dayOfWeek === 6 && !isClientBased && regularHours === 0))) {
          earningsBreakdown.basic.days++;
          let hoursForBasic: number;
          const regularHoursNum = Number(regularHours) || 0;
          if (dayOfWeek === 6 && regularHoursNum === 0 && !isClientBased) {
            hoursForBasic = 8; // Saturday regular work day (office-based only) - paid even if not worked
          } else {
            hoursForBasic = regularHoursNum; // Use actual hours worked
          }
          const dayAmount = hoursForBasic * ratePerHour;
          earningsBreakdown.basic.amount += dayAmount;
        }
        // Sunday (dayOfWeek === 0) is rest day for office-based - NOT included in basic salary
        // But for client-based account supervisors, Sunday is included if NOT their rest day AND they worked
      }

      // Regular Overtime
      if (dayType === "regular" && overtimeHours > 0) {
        if (useFixedAllowances) {
          // For Account Supervisors and Office-based: use fixed allowance
          const allowance = calculateOTAllowance(overtimeHours);
          fixedAllowances.regularOT.amount += allowance;
        } else {
          // Regular employees: standard calculation
          earningsBreakdown.overtime.hours += overtimeHours;
          earningsBreakdown.overtime.amount += calculateRegularOT(
            overtimeHours,
            ratePerHour
          );
        }
      }

      // Night Differential (regular days only) - For AS and Office-based, goes to Other Pay
      // Holidays and rest days have their own separate night differential calculations
      if (dayType === "regular" && nightDiffHours > 0) {
        // Supervisory roles and client-based don't have ND (they have OT allowance)
        if (isRankAndFile) {
          // Office-based Rank and File: ND goes to earnings breakdown table
          earningsBreakdown.nightDiff.hours += nightDiffHours;
          earningsBreakdown.nightDiff.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // NDOT (Night Diff OT on regular days) - Supervisory roles and client-based don't have ND
      if (
        dayType === "regular" &&
        overtimeHours > 0 &&
        nightDiffHours > 0 &&
        isRankAndFile
      ) {
        const ndotHours = Math.min(overtimeHours, nightDiffHours);
        earningsBreakdown.NDOT.hours += ndotHours;
        earningsBreakdown.NDOT.amount += calculateNightDiff(
          ndotHours,
          ratePerHour
        );
      }

      // Legal Holiday
      if (dayType === "regular-holiday") {
        // All employees: Check "1 Day Before" rule
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // Determine hours to pay: if worked on holiday, use actual hours; if didn't work but eligible, use 8 hours (daily rate)
          const hoursToPay = regularHours > 0 ? regularHours : 8;

          if (useFixedAllowances) {
            // Supervisory/Managerial: Daily rate only (1x), no multiplier
            // If worked on holiday: pay for hours worked × 1.0 + allowance
            // If didn't work but eligible: pay 8 hours × 1.0 (daily rate entitlement only, no allowance)
            const dailyRateAmount = hoursToPay * ratePerHour;
            earningsBreakdown.legalHoliday.days++;
            earningsBreakdown.legalHoliday.amount += dailyRateAmount;

            // Add allowance ONLY if they actually worked on the holiday (clockInTime exists and regularHours >= 4)
            // If clockInTime doesn't exist, regularHours = 8 is just the daily rate entitlement (no allowance)
            if (clockInTime && regularHours >= 4) {
              const allowance = calculateHolidayRestDayAllowance(regularHours);
              if (allowance > 0) {
                fixedAllowances.legalHolidayAllowance.amount += allowance;
              }
            }
          } else {
            // Rank and File:
            // If worked on holiday: 2.0x multiplier (Daily Rate 1.0x + Premium 1.0x)
            // If didn't work but eligible: 1.0x multiplier (Daily Rate entitlement only)
            if (regularHours > 0) {
              // Worked on holiday: Premium pay (2.0x)
              const standardAmount = calculateRegularHoliday(
                regularHours,
                ratePerHour
              );
              earningsBreakdown.legalHoliday.days++;
              earningsBreakdown.legalHoliday.amount += standardAmount;
            } else {
              // Didn't work but eligible: Daily rate entitlement (1.0x)
              const dailyRateAmount = 8 * ratePerHour;
              earningsBreakdown.legalHoliday.days++;
              earningsBreakdown.legalHoliday.amount += dailyRateAmount;
            }
          }
        }
        // If not eligible, don't add daily rate (but OT allowance still applies if they worked OT)
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.legalHolidayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.legalHDOT.hours += overtimeHours;
            earningsBreakdown.legalHDOT.amount += calculateRegularHolidayOT(
              overtimeHours,
              ratePerHour
            );
          }
        }
        if (nightDiffHours > 0) {
          // Supervisory roles and client-based don't have ND
          if (isRankAndFile) {
            // Office-based Rank and File: Legal Holiday ND goes to earnings breakdown table
            earningsBreakdown.legalHDND.hours += nightDiffHours;
            earningsBreakdown.legalHDND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
        }
      }

      // Special Holiday
      if (dayType === "non-working-holiday") {
        // All employees: Check "1 Day Before" rule
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // Determine hours to pay: if worked on holiday, use actual hours; if didn't work but eligible, use 8 hours (daily rate)
          const hoursToPay = regularHours > 0 ? regularHours : 8;

          if (useFixedAllowances) {
            // Supervisory/Managerial: Daily rate only (1x), no multiplier
            // If worked on holiday: pay for hours worked × 1.0 + allowance
            // If didn't work but eligible: pay 8 hours × 1.0 (daily rate entitlement only, no allowance)
            const dailyRateAmount = hoursToPay * ratePerHour;
            earningsBreakdown.spHoliday.days++;
            earningsBreakdown.spHoliday.amount += dailyRateAmount;

            // Add allowance ONLY if they actually worked on the holiday (clockInTime exists and regularHours >= 4)
            // If clockInTime doesn't exist, regularHours = 8 is just the daily rate entitlement (no allowance)
            if (clockInTime && regularHours >= 4) {
              const allowance = calculateHolidayRestDayAllowance(regularHours);
              if (allowance > 0) {
                fixedAllowances.specialHolidayAllowance.amount += allowance;
              }
            }
          } else {
            // Rank and File:
            // If worked on holiday: 1.3x multiplier (Daily Rate 1.0x + Premium 0.3x)
            // If didn't work but eligible: 1.0x multiplier (Daily Rate entitlement only)
            if (regularHours > 0) {
              // Worked on holiday: Premium pay (1.3x)
              const standardAmount = calculateNonWorkingHoliday(
                regularHours,
                ratePerHour
              );
              earningsBreakdown.spHoliday.days++;
              earningsBreakdown.spHoliday.amount += standardAmount;
            } else {
              // Didn't work but eligible: Daily rate entitlement (1.0x)
              const dailyRateAmount = 8 * ratePerHour;
              earningsBreakdown.spHoliday.days++;
              earningsBreakdown.spHoliday.amount += dailyRateAmount;
            }
          }
        }
        // If not eligible, don't add daily rate (but OT allowance still applies if they worked OT)
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.specialHolidayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.SHOT.hours += overtimeHours;
            earningsBreakdown.SHOT.amount += calculateNonWorkingHolidayOT(
              overtimeHours,
              ratePerHour
            );
          }
        }
        if (nightDiffHours > 0) {
          // Supervisory roles and client-based don't have ND
          if (isRankAndFile) {
            // Office-based Rank and File: Special Holiday ND goes to earnings breakdown table
            earningsBreakdown.SHND.hours += nightDiffHours;
            earningsBreakdown.SHND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
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

        // Rest Day Overtime
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.restDayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.restDayOT.hours += overtimeHours;
            earningsBreakdown.restDayOT.amount += calculateSundayRestDayOT(
              overtimeHours,
              ratePerHour
            );
          }
        }

        // Rest Day Night Differential
        if (nightDiffHours > 0) {
          // Supervisory roles and client-based don't have ND
          if (isRankAndFile) {
            // Office-based Rank and File: Rest Day ND goes to earnings breakdown table
            earningsBreakdown.restDayND.hours += nightDiffHours;
            earningsBreakdown.restDayND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
        }
      }

      // Sunday + Special Holiday
      if (dayType === "sunday-special-holiday") {
        if (regularHours > 0) {
          // Supervisory/Managerial: Get daily rate (1x) + allowance (if worked)
          // Rank and File: Get 1.5x multiplier
          if (useFixedAllowances) {
            // Supervisory/Managerial: Daily rate only (1x), no multiplier
            const dailyRateAmount = regularHours * ratePerHour;
            earningsBreakdown.spHoliday.days++;
            earningsBreakdown.spHoliday.amount += dailyRateAmount;

            // Add allowance ONLY if they actually worked (clockInTime exists)
            if (clockInTime && regularHours >= 4) {
              const allowance = calculateHolidayRestDayAllowance(regularHours);
              if (allowance > 0) {
                fixedAllowances.specialHolidayOnRestDayAllowance.amount += allowance;
              }
            }
          } else {
            // Rank and File: Standard multiplier calculation (1.5x)
            const standardAmount = calculateSundaySpecialHoliday(
              regularHours,
              ratePerHour
            );
            earningsBreakdown.spHoliday.days++;
            earningsBreakdown.spHoliday.amount += standardAmount;
          }
        }
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.specialHolidayOnRestDayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.SHonRDOT.hours += overtimeHours;
            earningsBreakdown.SHonRDOT.amount +=
              calculateSundaySpecialHolidayOT(overtimeHours, ratePerHour);
          }
        }
        if (nightDiffHours > 0) {
          // Supervisory roles and client-based don't have ND
          if (isRankAndFile) {
            // Office-based Rank and File: Special Holiday on Rest Day ND goes to earnings breakdown table
            earningsBreakdown.SHND.hours += nightDiffHours;
            earningsBreakdown.SHND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
        }
      }

      // Sunday + Regular Holiday
      if (dayType === "sunday-regular-holiday") {
        if (regularHours > 0) {
          // Supervisory/Managerial: Get daily rate (1x) + allowance (if worked)
          // Rank and File: Get 2.6x multiplier
          if (useFixedAllowances) {
            // Supervisory/Managerial: Daily rate only (1x), no multiplier
            const dailyRateAmount = regularHours * ratePerHour;
            earningsBreakdown.legalHoliday.days++;
            earningsBreakdown.legalHoliday.amount += dailyRateAmount;

            // Add allowance ONLY if they actually worked (clockInTime exists)
            if (clockInTime && regularHours >= 4) {
              const allowance = calculateHolidayRestDayAllowance(regularHours);
              if (allowance > 0) {
                fixedAllowances.legalHolidayOnRestDayAllowance.amount += allowance;
              }
            }
          } else {
            // Rank and File: Standard multiplier calculation (2.6x)
            const standardAmount = calculateSundayRegularHoliday(
              regularHours,
              ratePerHour
            );
            earningsBreakdown.legalHoliday.days++;
            earningsBreakdown.legalHoliday.amount += standardAmount;
          }
        }
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.legalHolidayOnRestDayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.LHonRDOT.hours += overtimeHours;
            earningsBreakdown.LHonRDOT.amount +=
              calculateSundayRegularHolidayOT(overtimeHours, ratePerHour);
          }
        }
        if (nightDiffHours > 0) {
          // Supervisory roles and client-based don't have ND
          if (isRankAndFile) {
            // Office-based Rank and File: Legal Holiday on Rest Day ND goes to earnings breakdown table
            earningsBreakdown.legalHDND.hours += nightDiffHours;
            earningsBreakdown.legalHDND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
        }
      }
    });

    // For Account Supervisors and Office-based employees:
    // Total Salary = Basic + Legal Holiday + Special Holiday + Rest Day + Other Pay (OT Allowances)
    // For Rank and File:
    // Total Salary = Basic + all overtime/holiday earnings

    if (useFixedAllowances) {
      // Account Supervisors/Office-based: Total Salary includes Basic + Holidays + Rest Days + Working Dayoff + Other Pay
      // According to payroll rules: Total Salary = Basic + Legal Holiday + Special Holiday + Rest Day + Working Dayoff + Other Pay Total
      totalSalary =
        earningsBreakdown.basic.amount +
        earningsBreakdown.legalHoliday.amount +
        earningsBreakdown.spHoliday.amount +
        earningsBreakdown.restDay.amount +
        // Note: workingDayoff removed - Saturday is now included in basicSalary (regular work day per law)
        fixedAllowances.regularOT.amount +
        fixedAllowances.legalHolidayOT.amount +
        fixedAllowances.specialHolidayOT.amount +
        fixedAllowances.restDayOT.amount +
        fixedAllowances.specialHolidayOnRestDayOT.amount +
        fixedAllowances.legalHolidayOnRestDayOT.amount +
        fixedAllowances.legalHolidayAllowance.amount +
        fixedAllowances.specialHolidayAllowance.amount +
        fixedAllowances.restDayAllowance.amount +
        fixedAllowances.specialHolidayOnRestDayAllowance.amount +
        fixedAllowances.legalHolidayOnRestDayAllowance.amount;

      // Total Gross Pay = Total Salary (same for Account Supervisors)
      totalGrossPay = totalSalary;
    } else {
      // Rank and File: Total Salary = sum of all earnings breakdown items
      totalSalary = Object.values(earningsBreakdown).reduce((sum, item) => {
        if (typeof item === "object" && "amount" in item) {
          return sum + (item.amount || 0);
        }
        return sum;
      }, 0);

      // Total Gross Pay = Total Salary for Rank and File
      totalGrossPay = totalSalary;
    }
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

  // Calculate total deductions
  // Note: withholdingTax is already included in deductions.totalDeductions from props
  const totalDeductions = deductions.totalDeductions;
  const tardiness = 0; // Can be calculated later if needed

  // Ensure Total Salary is calculated if not already set
  if (totalSalary === 0 && earningsBreakdown.basic.amount > 0) {
    // Fallback: if totalSalary wasn't calculated above, use basic as minimum
    totalSalary = earningsBreakdown.basic.amount;
  }

  // Total Gross Pay = Total Salary (sum of all earnings)
  // Total Salary should equal Gross Pay (they are the same thing)
  // Tardiness is currently 0, but can be deducted in the future if needed
  totalGrossPay = totalSalary - tardiness;

  // Ensure Total Salary equals Total Gross Pay (they should be the same)
  // If they differ, use totalGrossPay as the source of truth
  totalSalary = totalGrossPay;

  // Calculate Net Pay = Gross Pay - Deductions
  // Use calculated value instead of prop to ensure accuracy
  const netPay = totalGrossPay - totalDeductions;

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
          src="/gp-logo.webp"
          alt="Green Pasture Logo"
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
              GREEN PASTURE PEOPLE M
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
                  No of
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
                  {earningsBreakdown.basic.days > 0
                    ? earningsBreakdown.basic.days.toFixed(2)
                    : "-"}
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
              {!useFixedAllowances && (
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
              {!useFixedAllowances && (
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
                  Legal Holiday
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.legalHoliday.days > 0
                    ? earningsBreakdown.legalHoliday.days.toFixed(2)
                    : "-"}
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
              {!useFixedAllowances && (
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Legal HD OT
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
              {!useFixedAllowances && (
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    Legal HD ND
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
                  {earningsBreakdown.spHoliday.days > 0
                    ? earningsBreakdown.spHoliday.days.toFixed(2)
                    : "-"}
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
              {!useFixedAllowances && (
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
              {!useFixedAllowances && (
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
              {!useFixedAllowances && (
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
              {!useFixedAllowances && (
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
              {!useFixedAllowances && (
                <tr>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      fontWeight: "bold",
                    }}
                  >
                    NDOT
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {earningsBreakdown.NDOT.hours > 0
                      ? earningsBreakdown.NDOT.hours.toFixed(2)
                      : "-"}
                  </td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "3px 5px",
                      textAlign: "right",
                    }}
                  >
                    {formatCurrencyOrDash(earningsBreakdown.NDOT.amount)}
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
                  Rest Day
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.restDay.days > 0
                    ? earningsBreakdown.restDay.days.toFixed(2)
                    : "-"}
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
              {!useFixedAllowances && (
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
              {!useFixedAllowances && (
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
                  (OT & ND Allowances -{" "}
                  {isAccountSupervisor ? "Account Supervisor" : "Office-based"})
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
                    {/* Fixed Allowances for Account Supervisors and Office-based */}
                    {fixedAllowances.regularOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Regular OT Allowance
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
                            fixedAllowances.regularOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.regularNightDiff.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Night Differential
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
                            fixedAllowances.regularNightDiff.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.legalHolidayOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Legal Holiday OT Allowance
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
                            fixedAllowances.legalHolidayOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.legalHolidayND.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Legal Holiday Night Differential
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
                            fixedAllowances.legalHolidayND.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.specialHolidayOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Special Holiday OT Allowance
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
                            fixedAllowances.specialHolidayOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.specialHolidayND.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Special Holiday Night Differential
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
                            fixedAllowances.specialHolidayND.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.restDayOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Rest Day OT Allowance
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
                            fixedAllowances.restDayOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.restDayND.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Rest Day Night Differential
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
                            fixedAllowances.restDayND.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.specialHolidayOnRestDayOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Special Holiday on Rest Day OT Allowance
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
                            fixedAllowances.specialHolidayOnRestDayOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.legalHolidayOnRestDayOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Legal Holiday on Rest Day OT Allowance
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
                            fixedAllowances.legalHolidayOnRestDayOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {fixedAllowances.regularNightdiffOT.amount > 0 && (
                      <tr>
                        <td
                          style={{
                            border: "1px solid #000",
                            padding: "3px 5px",
                            fontWeight: "bold",
                            width: "40%",
                          }}
                        >
                          Regular Night Differential OT Allowance
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
                            fixedAllowances.regularNightdiffOT.amount
                          )}
                        </td>
                      </tr>
                    )}
                    {/* Allowances for regular hours worked on holidays/rest days */}
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
                          Legal Holiday Allowance
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
                          Legal Holiday on Rest Day Allowance
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
                    {Object.values(fixedAllowances).some(
                      (item) =>
                        item &&
                        typeof item === "object" &&
                        "amount" in item &&
                        item.amount > 0
                    ) && (
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
                          {formatCurrencyOrDash(
                            Object.values(fixedAllowances).reduce(
                              (sum, item) =>
                                sum +
                                (item &&
                                typeof item === "object" &&
                                "amount" in item
                                  ? item.amount
                                  : 0),
                              0
                            )
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
                {formatCurrency(totalGrossPay)}
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
                {formatCurrency(netPay || netPayProp || 0)}
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