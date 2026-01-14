"use client";

import { memo, useMemo, useEffect } from "react";
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
  PAYROLL_MULTIPLIERS,
  type DayType,
} from "@/utils/payroll-calculator";
import { calculateBasePay } from "@/utils/base-pay-calculator";
import { format, parseISO, startOfWeek } from "date-fns";

interface PayslipDetailedBreakdownProps {
  employee: {
    employee_id: string;
    full_name: string;
    rate_per_day: number;
    rate_per_hour: number;
    position?: string | null;
    assigned_hotel?: string | null;
    employee_type?: "office-based" | "client-based" | null;
    job_level?: string | null;
    hire_date?: string | null;
    termination_date?: string | null;
  };
  attendanceData: Array<{
    date: string;
    dayType: DayType;
    regularHours: number;
    overtimeHours: number;
    nightDiffHours: number;
    clockInTime?: string;
    clockOutTime?: string;
  }>;
  periodStart?: Date;
  periodEnd?: Date;
  restDays?: Map<string, boolean>;
  holidays?: Array<{ holiday_date: string }>;
  onTotalGrossPayChange?: (totalGrossPay: number) => void;
}

function PayslipDetailedBreakdownComponent({
  employee,
  attendanceData,
  periodStart,
  periodEnd,
  restDays,
  holidays = [],
  onTotalGrossPayChange,
}: PayslipDetailedBreakdownProps) {
  const ratePerHour = employee.rate_per_hour;
  const ratePerDay = employee.rate_per_day;

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
      const allowance = 200 + Math.max(0, hours - 2) * 100;
      return allowance;
    }
    // Office-based Rank and File: Standard calculation (1.25x hourly rate)
    return calculateRegularOT(hours, ratePerHour);
  }

  /**
   * Calculate holiday/rest day allowance for client-based and office-based supervisory/managerial
   * Sunday, Rest Day, Special Holiday, Legal Holiday: ₱350 for ≥4 hours, ₱700 for ≥8 hours
   * NO PRO-RATING - must meet exact hour requirements
   * This applies to both regular hours AND OT hours on these days
   */
  function calculateHolidayRestDayAllowance(
    hours: number,
    dayType: DayType
  ): number {
    const isEligibleDay =
      dayType === "sunday" ||
      dayType === "regular-holiday" ||
      dayType === "non-working-holiday" ||
      dayType === "sunday-special-holiday" ||
      dayType === "sunday-regular-holiday";

    if ((isClientBased || isEligibleForAllowances) && isEligibleDay) {
      if (hours >= 8) {
        return 700;
      } else if (hours >= 4) {
        return 350;
      }
      // No pro-rating - must meet 4 or 8 hour requirement
      return 0;
    }
    // Rank and file use standard calculation
    return 0; // Will be calculated separately
  }

  /**
   * Calculate OT allowance for holidays/rest days for client-based and office-based supervisory/managerial
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
    return 0; // Will be calculated separately
  }

  // Helper function to calculate hours from clock times
  function calculateHoursFromClockTimes(
    clockInTime: string | undefined,
    clockOutTime: string | undefined,
    date: string
  ): {
    regularHours: number;
    nightDiffHours: number;
    totalHours: number;
  } {
    if (!clockInTime || !clockOutTime) {
      return { regularHours: 0, nightDiffHours: 0, totalHours: 0 };
    }

    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);
    const workDate = new Date(date);

    // Regular work hours: 8AM (08:00) to 5PM (17:00) = 8 hours
    const regularStart = new Date(workDate);
    regularStart.setHours(8, 0, 0, 0);
    const regularEnd = new Date(workDate);
    regularEnd.setHours(17, 0, 0, 0);

    // Calculate total hours worked
    const totalMs = clockOut.getTime() - clockIn.getTime();
    const totalHours = totalMs / (1000 * 60 * 60);

    // Calculate regular hours (8AM-5PM, capped at 8 hours)
    const regularStartMs = Math.max(clockIn.getTime(), regularStart.getTime());
    const regularEndMs = Math.min(clockOut.getTime(), regularEnd.getTime());
    const regularHoursMs = Math.max(0, regularEndMs - regularStartMs);
    let regularHours = Math.min(regularHoursMs / (1000 * 60 * 60), 8);

    // Calculate night differential hours (after 5PM = 17:00)
    // Night diff starts at 5PM and continues until 6AM next day
    let nightDiffHours = 0;

    // Same day: hours after 5PM
    if (clockOut.getDate() === clockIn.getDate()) {
      const nightDiffStart = new Date(workDate);
      nightDiffStart.setHours(17, 0, 0, 0); // 5PM

      if (clockOut.getTime() > nightDiffStart.getTime()) {
        const nightStartMs = Math.max(
          clockIn.getTime(),
          nightDiffStart.getTime()
        );
        const nightEndMs = clockOut.getTime();
        nightDiffHours = Math.max(
          0,
          (nightEndMs - nightStartMs) / (1000 * 60 * 60)
        );
      }
    } else {
      // Work spans midnight
      // Hours from 5PM to midnight on first day
      const nightDiffStart = new Date(clockIn);
      nightDiffStart.setHours(17, 0, 0, 0); // 5PM
      const dayEnd = new Date(clockIn);
      dayEnd.setHours(23, 59, 59, 999);

      if (clockIn.getTime() < dayEnd.getTime()) {
        const firstDayNightStart = Math.max(
          clockIn.getTime(),
          nightDiffStart.getTime()
        );
        const firstDayNightEnd = Math.min(clockOut.getTime(), dayEnd.getTime());
        nightDiffHours += Math.max(
          0,
          (firstDayNightEnd - firstDayNightStart) / (1000 * 60 * 60)
        );
      }

      // Hours from midnight to 6AM on next day
      const nextDayStart = new Date(clockOut);
      nextDayStart.setHours(0, 0, 0, 0);
      const nextDayEnd = new Date(clockOut);
      nextDayEnd.setHours(6, 0, 0, 0);

      if (clockOut.getTime() > nextDayStart.getTime()) {
        const nextDayNightStart = Math.max(
          clockIn.getTime(),
          nextDayStart.getTime()
        );
        const nextDayNightEnd = Math.min(
          clockOut.getTime(),
          nextDayEnd.getTime()
        );
        nightDiffHours += Math.max(
          0,
          (nextDayNightEnd - nextDayNightStart) / (1000 * 60 * 60)
        );
      }
    }

    return {
      regularHours: Math.round(regularHours * 100) / 100,
      nightDiffHours: Math.round(nightDiffHours * 100) / 100,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  }

  // Calculate breakdown from attendance data
  // Use useMemo to ensure recalculation when employee type or attendance data changes
  const calculationResult = useMemo(() => {
    /**
     * Helper function to check "1 Day Before" rule for holidays
     * Returns true if employee is eligible for holiday daily rate:
     * - If they worked on the holiday itself (regularHours > 0), they get daily rate regardless
     * - If they didn't work on the holiday, they must have worked the day before (regularHours >= 8)
     * - CONSECUTIVE HOLIDAYS RULE: If holidays are consecutive, once the first holiday is eligible,
     *   all consecutive holidays are also eligible (they should still be paid and recorded as work/present)
     */
    const isEligibleForHolidayPay = (
      currentDate: string,
      currentRegularHours: number,
      attendanceDataArray: typeof attendanceData
    ): boolean => {
      // If employee worked on the holiday itself, they get daily rate regardless
      if (currentRegularHours > 0) {
        return true;
      }

      // Check if this is a consecutive holiday (previous day was also a holiday)
      const currentDateObj = new Date(currentDate);
      const prevDateObj = new Date(currentDateObj);
      prevDateObj.setDate(prevDateObj.getDate() - 1);
      const prevDateStr = prevDateObj.toISOString().split("T")[0];

      const prevDay = attendanceDataArray.find((day) => day.date === prevDateStr);
      const isPrevDayHoliday = prevDay && (
        prevDay.dayType === "regular-holiday" ||
        prevDay.dayType === "non-working-holiday"
      );

      // If previous day was a holiday and it was eligible (regularHours >= 8), this consecutive holiday is also eligible
      if (isPrevDayHoliday && prevDay && (prevDay.regularHours || 0) >= 8) {
        return true; // Consecutive holiday - eligible because previous holiday was eligible
      }

      // If they didn't work on the holiday, check if they worked a regular working day before
      // Search up to 7 days back to find the last REGULAR WORKING DAY (skip holidays and rest days)
      // This matches the timesheet logic
      for (let i = 1; i <= 7; i++) {
        const checkDateObj = new Date(currentDateObj);
        checkDateObj.setDate(checkDateObj.getDate() - i);
        const checkDateStr = checkDateObj.toISOString().split("T")[0];

        // Find the day in attendance data
        const checkDay = attendanceDataArray.find(
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

    // Calculate base pay using simplified 104-hour method
    // Base logic: 104 hours per cutoff (13 days × 8 hours), then subtract absences
    // This applies to both client-based and office-based employees
    let basePayHours = 104; // Start with 104 hours (13 days × 8 hours) per cutoff
    let basePayAmount = 0;
    let absences = 0;
    let useBasePayMethod = true; // Always use base pay method

    if (periodStart && periodEnd) {
      // Extract clock entries from attendance data
      const clockEntries = attendanceData
        .filter((day) => day.clockInTime && day.clockOutTime)
        .map((day) => ({
          clock_in_time: day.clockInTime!,
          clock_out_time: day.clockOutTime!,
        }));

      // Calculate base pay (104 hours - absences × 8)
      const basePayResult = calculateBasePay({
        periodStart,
        periodEnd,
        clockEntries,
        restDays: restDays || new Map(),
        holidays: holidays.map((h) => ({
          holiday_date: h.holiday_date || (h as any).date
        })),
        isClientBased: isClientBased || false,
        hireDate: employee.hire_date ? parseISO(employee.hire_date) : undefined,
        terminationDate: employee.termination_date
          ? parseISO(employee.termination_date)
          : undefined,
      });

      basePayHours = basePayResult.finalBaseHours; // This is 104 - (absences × 8)
      // Ensure basePayHours never exceeds 104 (13 days × 8 hours)
      // Holidays are already included in the 104 hours base, so they shouldn't add to it
      basePayHours = Math.min(basePayHours, 104);
      basePayAmount = basePayHours * ratePerHour;
      absences = basePayResult.absences;
    }

    // Total hours for "Hours Work" - should match timesheet calculation exactly
    // Only count regular days (Mon-Fri), Saturdays (company benefit), and eligible holidays
    // Exclude Sundays from "Hours Work" (they're paid separately)
    let totalHours = 0; // Total hours for "Hours Work" display (matches timesheet BH)
    let totalRegularHours = 0; // Total regular hours for "Days Work" calculation
    let basicSalary = 0; // Basic salary from REGULAR WORK DAYS ONLY (excludes holidays, rest days, OT, allowances)

    // If using base pay method, start with base pay hours but add eligible holidays
    // Base pay includes holidays as part of 13 days, but we need to verify eligibility
    // Basic Salary should still be calculated from actual regular work days rendered
    if (useBasePayMethod) {
      // Start with base pay hours (includes holidays as part of 13 days)
      totalRegularHours = basePayHours;
      totalHours = basePayHours; // For display purposes
      // Eligible holidays will be added in the loop below if they're not already counted
      // basicSalary will be calculated from actual regular work days in the loop below
    }

    const breakdown = {
      nightDifferential: { hours: 0, amount: 0 },
      legalHoliday: { hours: 0, amount: 0 },
      specialHoliday: { hours: 0, amount: 0 },
      restDay: { hours: 0, amount: 0 },
      restDayNightDiff: { hours: 0, amount: 0 },
      workingDayoff: { hours: 0, amount: 0 },
    };

    // Earnings breakdown - For regular employees, OT items go here (in earnings table)
    // For Account Supervisors/Office-based, OT and ND items go to Other Pay section
    const earningsOT = {
      regularOvertime: { hours: 0, amount: 0 },
      legalHolidayOT: { hours: 0, amount: 0 },
      legalHolidayND: { hours: 0, amount: 0 },
      shOT: { hours: 0, amount: 0 },
      shNightDiff: { hours: 0, amount: 0 },
      shOnRDOT: { hours: 0, amount: 0 },
      lhOnRDOT: { hours: 0, amount: 0 },
      restDayOT: { hours: 0, amount: 0 },
      regularNightdiffOT: { hours: 0, amount: 0 },
    };

    // Other Pay - All OT and ND items for Account Supervisors and Office-based employees
    // Combined into one section to avoid confusion
    const otherPay = {
      regularOT: { hours: 0, amount: 0 },
      regularNightDiff: { hours: 0, amount: 0 }, // Night Differential for regular days
      legalHolidayOT: { hours: 0, amount: 0 },
      legalHolidayND: { hours: 0, amount: 0 },
      specialHolidayOT: { hours: 0, amount: 0 },
      specialHolidayND: { hours: 0, amount: 0 },
      restDayOT: { hours: 0, amount: 0 },
      restDayND: { hours: 0, amount: 0 }, // Rest Day Night Differential
      specialHolidayOnRestDayOT: { hours: 0, amount: 0 },
      legalHolidayOnRestDayOT: { hours: 0, amount: 0 },
      regularNightdiffOT: { hours: 0, amount: 0 },
      // Allowances for regular hours worked on holidays/rest days (not OT)
      legalHolidayAllowance: { hours: 0, amount: 0 }, // Regular hours worked on legal holiday
      specialHolidayAllowance: { hours: 0, amount: 0 }, // Regular hours worked on special holiday
      restDayAllowance: { hours: 0, amount: 0 }, // Regular hours worked on rest day
      specialHolidayOnRestDayAllowance: { hours: 0, amount: 0 }, // Regular hours worked on special holiday + rest day
      legalHolidayOnRestDayAllowance: { hours: 0, amount: 0 }, // Regular hours worked on legal holiday + rest day
    };

    attendanceData.forEach((day) => {
      const {
        dayType,
        regularHours: dayRegularHours,
        overtimeHours: rawOvertimeHours,
        nightDiffHours: dayNightDiffHours,
        clockInTime,
        clockOutTime,
        date,
      } = day;

      // Convert overtimeHours to number if it's a string
      const overtimeHours =
        typeof rawOvertimeHours === "string"
          ? parseFloat(rawOvertimeHours)
          : rawOvertimeHours || 0;

      // Use regularHours directly from attendance_data (same as timesheet uses bh)
      // The attendance_data is generated from time clock entries, so it already has the correct hours
      // Only recalculate from clock times if clock times are available AND regularHours is 0 (to catch missing data)
      let regularHours = dayRegularHours;
      let nightDiffHours = dayNightDiffHours;

      // Only recalculate from clock times if:
      // 1. Clock times are available
      // 2. regularHours is 0 (missing data)
      // 3. It's not a leave day with full hours
      const isLeaveDayWithFullHours = (dayRegularHours || 0) >= 8;
      if (
        clockInTime &&
        clockOutTime &&
        regularHours === 0 &&
        !isLeaveDayWithFullHours
      ) {
        // Recalculate regular hours from clock times to fix missing data
        const calculated = calculateHoursFromClockTimes(
          clockInTime,
          clockOutTime,
          date
        );
        regularHours = calculated.regularHours;
      }

      // Use regularHours as-is (matches timesheet bh calculation)
      // This is the "bh" equivalent in the payslip
      const finalRegularHours = regularHours;

      // Calculate hours to count for this day (matches timesheet bh calculation)
      // Timesheet logic: sum bh where bh > 0 AND dayType is "regular", "regular-holiday", or "non-working-holiday"
      // Exclude Sundays (they have dayType === "sunday" and are excluded even if bh > 0)
      let hoursToCount = 0;

      if (dayType === "regular") {
        const dateObj = new Date(date);
        const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

        // Check if this is Account Supervisor's first rest day (treated as regular workday)
        // The first rest day gets 8 BH even if not worked (like Saturday company benefit)
        // The timesheet generator already sets regularHours = 8 for first rest day
        const isFirstRestDay = (isClientBased || isAccountSupervisor) && restDays?.get(date) === true;
        let isFirstRestDayChronologically = false;
        if (isFirstRestDay && restDays) {
          // Get the week start (Monday) for this date
          const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 }); // Monday = 1
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

          // Get all rest days in THIS WEEK (not the entire period)
          const restDaysInWeek = Array.from(restDays.keys())
            .filter(rd => {
              const rdDate = new Date(rd);
              return rdDate >= weekStart && rdDate <= weekEnd;
            })
            .sort((a, b) => a.localeCompare(b)); // Sort chronologically within the week

          // Check if this is the first rest day of THIS WEEK (chronologically)
          if (restDaysInWeek.length >= 1 && date === restDaysInWeek[0]) {
            isFirstRestDayChronologically = true;
          }
        }

        if (dayOfWeek === 6 && finalRegularHours === 0) {
          // Saturday with no work - regular work day: 8 hours (paid 6 days/week per law)
          hoursToCount = 8;
          // Saturday is included in Basic Salary (regular work day, not a separate benefit)
          basicSalary += 8 * ratePerHour;
        } else if (finalRegularHours > 0) {
          // Regular day or Saturday with work - count actual hours
          hoursToCount = finalRegularHours;
          // Basic Salary = Regular work days (Mon-Sat) that were actually worked
          // Exclude holidays and rest days (Sundays)
          // BUT include Account Supervisor's first rest day (it's part of their 6-day work week)
          // Saturday is a regular work day - included in basic salary
          basicSalary += finalRegularHours * ratePerHour;
          // Note: If first rest day falls on Saturday, it's treated as regular work day (included in basic salary)
        } else if (isFirstRestDayChronologically && finalRegularHours === 0) {
          // Account Supervisor's first rest day with no work - gets 8 BH (like Saturday regular work day)
          // This should not happen if timesheet generator is working correctly, but handle it just in case
          // This is part of their 6-day work week
          hoursToCount = 8;
          // Include in basic salary (it's a regular workday for them)
          // Saturday is also a regular work day, so include it too
          basicSalary += 8 * ratePerHour;
        }
      } else if (
        dayType === "regular-holiday" ||
        dayType === "non-working-holiday"
      ) {
        // Check if eligible for holiday pay (worked day before or worked on holiday)
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          finalRegularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // For Account Supervisors/Supervisory/Managerial: Always get full daily rate (8 hours) regardless of actual hours worked
          // For other employees: Use actual hours if worked, otherwise 8 hours
          if (isClientBased || isEligibleForAllowances) {
            // Account Supervisors/Supervisory/Managerial: Always get 8 hours (full daily rate) in basic salary
            hoursToCount = 8;
            basicSalary += 8 * ratePerHour; // Full daily rate
          } else {
            // Other employees: Use actual hours if worked, otherwise 8 hours
            if (finalRegularHours > 0) {
              hoursToCount = finalRegularHours;
              basicSalary += finalRegularHours * ratePerHour;
            } else {
              hoursToCount = 8;
              basicSalary += 8 * ratePerHour;
            }
          }
        }
      }
      // Sundays are excluded (dayType === "sunday") - they're paid separately

      // Add hours to both totals (they should match exactly)
      // For base pay method: basePayHours already includes all 13 days (104 hours) including holidays
      // So we should NOT add any hours to totalRegularHours - it's already set to basePayHours
      // For non-base pay method: count all eligible days including holidays
      // Rest days are separate and should still be counted for display purposes
      if (hoursToCount > 0) {
        if (useBasePayMethod) {
          // Base pay method: basePayHours already includes all regular days AND holidays (13 days = 104 hours)
          // Don't add any hours here - totalRegularHours is already set to basePayHours above
          // The base pay calculation already accounts for holidays as part of the 13 days
          // We only need to calculate basicSalary and other pay components here
        } else {
          // Non-base pay method: count all eligible days including holidays
          totalRegularHours += hoursToCount;
          totalHours += hoursToCount;
        }
      }

      // Regular Overtime - Move to allowances or Other Pay based on employee type
      // Convert overtimeHours to number if it's a string
      const otHours =
        typeof overtimeHours === "string"
          ? parseFloat(overtimeHours)
          : overtimeHours || 0;
      if (dayType === "regular" && otHours > 0) {
        if (isClientBased || isEligibleForAllowances) {
          // Client-based or Office-based Supervisory/Managerial: Fixed amounts - goes to Other Pay
          const allowance = calculateOTAllowance(otHours);
          if (allowance > 0) {
            otherPay.regularOT.hours += otHours;
            otherPay.regularOT.amount += allowance;
          }
        } else {
          // Office-based Rank and File: Standard calculation (1.25x hourly rate) - goes to earnings breakdown table
          earningsOT.regularOvertime.hours += otHours;
          earningsOT.regularOvertime.amount += calculateRegularOT(otHours, ratePerHour);
        }
      }

      // Night Differential (regular days only - holidays and rest days have separate ND calculations)
      // Supervisory roles (office-based) don't have ND (they have OT allowance already)
      // Client-based (Account Supervisors) don't have ND (they have OT allowance already)
      // Only Rank and File office-based employees get ND
      if (dayType === "regular" && nightDiffHours > 0) {
        if (isRankAndFile) {
          // Office-based Rank and File: ND goes to earnings breakdown table
          breakdown.nightDifferential.hours += nightDiffHours;
          breakdown.nightDifferential.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
        // Client-based and Office-based Supervisory/Managerial: NO ND (they have OT allowance)
      }

      // Legal Holiday (regular-holiday)
      // NOTE: Holidays are now included in basic salary (all days worked × daily rate)
      // Holiday pay is NOT added separately - it's already part of basicSalary
      // Only OT allowances and ND are added separately
      if (dayType === "regular-holiday") {
        // All employees: Check "1 Day Before" rule
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // For Account Supervisors (client-based/hotel-based): Always get full daily rate (8 hours) regardless of actual hours worked
          // For other employees: Use actual hours if worked, otherwise 8 hours
          let hoursToPay: number;
          if (isClientBased || isEligibleForAllowances) {
            // Account Supervisors: Always 8 hours (full daily rate) - guaranteed regardless of actual hours worked
            hoursToPay = 8;
          } else {
            // Other employees: Use actual hours if worked, otherwise 8 hours
            hoursToPay = regularHours > 0 ? regularHours : 8;
          }

          // Track hours and amount for display purposes (informational breakdown)
          // Note: This amount is already included in basicSalary, so it's not added to gross pay separately
          breakdown.legalHoliday.hours += hoursToPay;
          // Calculate amount for display: Always full daily rate (8 hours) for Account Supervisors/Supervisory/Managerial
          breakdown.legalHoliday.amount += ratePerDay; // Always full daily rate

          // Add allowance ONLY if they actually worked on the holiday (clockInTime exists and regularHours >= 4)
          // Allowance is based on ACTUAL hours worked, not the guaranteed daily rate
          // OT allowances are still added separately (not part of basic salary)
          if (clockInTime && regularHours >= 4) {
            const allowance = calculateHolidayRestDayAllowance(
              regularHours, // Use actual hours worked for allowance calculation
              dayType
            );
            if (allowance > 0) {
              otherPay.legalHolidayAllowance.hours += regularHours;
              otherPay.legalHolidayAllowance.amount += allowance;
            }
          }
        }
        // If not eligible, don't add daily rate (but OT allowance still applies if they worked OT)

        // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
        // They only appear in Other Pay section as OT replacements

        // Move OT and ND to allowances or Other Pay based on employee type
        const legalHolidayOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (legalHolidayOTHours > 0) {
          if (isClientBased || isEligibleForAllowances) {
            // Client-based or Office-based Supervisory/Managerial: Fixed amounts - goes to Other Pay
            const legalHolidayOTAllowance =
              calculateHolidayRestDayOTAllowance(legalHolidayOTHours);
            if (legalHolidayOTAllowance > 0) {
              otherPay.legalHolidayOT.hours += legalHolidayOTHours;
              otherPay.legalHolidayOT.amount += legalHolidayOTAllowance;
            }
          } else {
            // Office-based Rank and File: Standard calculation - goes to earnings breakdown table
            earningsOT.legalHolidayOT.hours += legalHolidayOTHours;
            earningsOT.legalHolidayOT.amount += calculateRegularHolidayOT(
              legalHolidayOTHours,
              ratePerHour
            );
          }
        }

        if (nightDiffHours > 0) {
          if (isRankAndFile) {
            // Office-based Rank and File: ND goes to earnings breakdown table
            earningsOT.legalHolidayND.hours += nightDiffHours;
            earningsOT.legalHolidayND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
          // Client-based and Office-based Supervisory/Managerial: NO ND (they have OT allowance)
        }
      }

      // Special Holiday (non-working-holiday)
      // NOTE: Holidays are now included in basic salary (all days worked × daily rate)
      // Holiday pay is NOT added separately - it's already part of basicSalary
      // Only OT allowances and ND are added separately
      if (dayType === "non-working-holiday") {
        // All employees: Check "1 Day Before" rule
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // For Account Supervisors (client-based/hotel-based): Always get full daily rate (8 hours) regardless of actual hours worked
          // For other employees: Use actual hours if worked, otherwise 8 hours
          let hoursToPay: number;
          if (isClientBased || isEligibleForAllowances) {
            // Account Supervisors: Always 8 hours (full daily rate) - guaranteed regardless of actual hours worked
            hoursToPay = 8;
          } else {
            // Other employees: Use actual hours if worked, otherwise 8 hours
            hoursToPay = regularHours > 0 ? regularHours : 8;
          }

          // Track hours and amount for display purposes (informational breakdown)
          // Note: This amount is already included in basicSalary, so it's not added to gross pay separately
          breakdown.specialHoliday.hours += hoursToPay;
          // Calculate amount for display: Always full daily rate (8 hours) for Account Supervisors/Supervisory/Managerial
          breakdown.specialHoliday.amount += ratePerDay; // Always full daily rate

          // Add allowance ONLY if they actually worked on the holiday (clockInTime exists and regularHours >= 4)
          // Allowance is based on ACTUAL hours worked, not the guaranteed daily rate
          // OT allowances are still added separately (not part of basic salary)
          if (clockInTime && regularHours >= 4) {
            const allowance = calculateHolidayRestDayAllowance(
              regularHours, // Use actual hours worked for allowance calculation
              dayType
            );
            if (allowance > 0) {
              otherPay.specialHolidayAllowance.hours += regularHours;
              otherPay.specialHolidayAllowance.amount += allowance;
            }
          }
        }
        // If not eligible, don't add daily rate (but OT allowance still applies if they worked OT)

        // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
        // They only appear in Other Pay section as OT replacements

        // Move OT to Other Pay (not allowances) - Apply fixed amounts for client-based/supervisory/managerial
        const specialHolidayOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (specialHolidayOTHours > 0) {
          if (isClientBased || isEligibleForAllowances) {
            // Fixed amounts only - goes to Other Pay
            const specialHolidayOTAllowance =
              calculateHolidayRestDayOTAllowance(specialHolidayOTHours);
            if (specialHolidayOTAllowance > 0) {
              otherPay.specialHolidayOT.hours += specialHolidayOTHours;
              otherPay.specialHolidayOT.amount += specialHolidayOTAllowance;
            }
          } else {
            // Office-based Rank and File: Standard calculation - goes to earnings breakdown table
            earningsOT.shOT.hours += specialHolidayOTHours;
            earningsOT.shOT.amount += calculateNonWorkingHolidayOT(
              specialHolidayOTHours,
              ratePerHour
            );
          }
        }

        if (nightDiffHours > 0) {
          if (isRankAndFile) {
            // Office-based Rank and File: ND goes to earnings breakdown table
            earningsOT.shNightDiff.hours += nightDiffHours;
            earningsOT.shNightDiff.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
          // Client-based and Office-based Supervisory/Managerial: NO ND (they have OT allowance)
        }
      }

      // Sunday/Rest Day (Sunday is the designated rest day for office-based employees)
      // For client-based Account Supervisors: Rest days can only be Monday, Tuesday, or Wednesday
      // Rest days that fall on holidays are treated as holidays (holiday takes priority)
      // The FIRST rest day (chronologically) is the ACTUAL REST DAY (only paid if worked)
      // - If worked: daily rate (hours × rate/hour × 1.0) + allowance (if worked ≥4 hours)
      // The SECOND rest day is treated as a REGULAR WORKDAY (like Mon-Sat for office-based)
      // - It's NOT a rest day - it's already processed above as dayType === "regular" and included in basic salary
      if (dayType === "sunday") {
        // IMPORTANT: For client-based employees, verify this is actually their rest day
        // Sunday should NOT be treated as rest day for client-based employees unless explicitly marked
        if (isClientBased || isAccountSupervisor) {
          // Check if this date is actually marked as a rest day in their schedule
          const isActuallyRestDay = restDays?.get(date) === true;
          if (!isActuallyRestDay) {
            // This is Sunday but NOT the employee's rest day - skip rest day processing
            // It should be treated as a regular work day (already processed above)
            return; // Skip this iteration in forEach
          }
        }

        // Verify this is NOT the second rest day for Account Supervisors
        // The second rest day should have dayType === "regular" (set by timesheet generator)
        // If dayType === "sunday", it should only be the first rest day (actual rest day)
        const isRestDay = (isClientBased || isAccountSupervisor) && restDays?.get(date) === true;
        let isSecondRestDayChronologically = false;
        if (isRestDay && restDays) {
          // Get the week start (Monday) for this date
          const dateObj = new Date(date);
          const weekStart = startOfWeek(dateObj, { weekStartsOn: 1 }); // Monday = 1
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekEnd.getDate() + 6); // Sunday

          // Get all rest days in THIS WEEK (not the entire period)
          const restDaysInWeek = Array.from(restDays.keys())
            .filter(rd => {
              const rdDate = new Date(rd);
              return rdDate >= weekStart && rdDate <= weekEnd;
            })
            .sort((a, b) => a.localeCompare(b)); // Sort chronologically within the week

          // Check if this is the second rest day of THIS WEEK (chronologically)
          if (restDaysInWeek.length >= 2 && date === restDaysInWeek[1]) {
            isSecondRestDayChronologically = true;
          }
        }

        // If this is the second rest day, it should NOT be processed here (should have dayType === "regular")
        // This is a safety check - if somehow the second rest day has dayType === "sunday", skip it
        if (isSecondRestDayChronologically) {
          // Second rest day should not be here - skip rest day processing
          // It should have been processed as dayType === "regular" above
        } else {
          // Rank and File: Always paid, even if didn't work (8 hours if didn't work)
          if (!isClientBased && !isEligibleForAllowances) {
            const hoursToPay = regularHours > 0 ? regularHours : 8;
            // Rank and File: Standard multiplier calculation (1.3x)
            const standardAmount = calculateSundayRestDay(
              hoursToPay,
              ratePerHour
            );
            breakdown.restDay.hours += hoursToPay;
            breakdown.restDay.amount += standardAmount;
          } else {
            // Client-based Account Supervisors/Supervisory/Managerial:
            // This is the FIRST rest day (the actual rest day)
            // Only paid if they worked on it (regularHours > 0 means they worked)
            if (regularHours > 0) {
              // Supervisory/Managerial: Always get full daily rate (8 hours) regardless of actual hours worked
              // This matches the holiday logic - full daily rate + allowance based on actual hours
              const dailyRateAmount = 8 * ratePerHour; // Always full daily rate
              breakdown.restDay.hours += 8; // Always show 8 hours for display
              breakdown.restDay.amount += dailyRateAmount;

              // Add allowance ONLY if they actually worked on the rest day (clockInTime exists and regularHours >= 4)
              // Allowance is based on ACTUAL hours worked, not the guaranteed daily rate
              if (clockInTime && regularHours >= 4) {
                const allowance = calculateHolidayRestDayAllowance(
                  regularHours, // Use actual hours worked for allowance calculation
                  dayType
                );
                if (allowance > 0) {
                  otherPay.restDayAllowance.hours += regularHours;
                  otherPay.restDayAllowance.amount += allowance;
                }
              }
            }
            // If regularHours === 0, it means they didn't work on the first rest day - no pay
          }
        }

        // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
        // They only appear in Other Pay section as OT replacements

        // Move Rest Day OT based on employee type
        const restDayOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (restDayOTHours > 0) {
          if (isClientBased || isEligibleForAllowances) {
            // Fixed amounts - goes to Other Pay
            const restDayOTAllowance =
              calculateHolidayRestDayOTAllowance(restDayOTHours);
            if (restDayOTAllowance > 0) {
              otherPay.restDayOT.hours += restDayOTHours;
              otherPay.restDayOT.amount += restDayOTAllowance;
            }
          } else {
            // Office-based Rank and File: Standard calculation - goes to earnings breakdown table
            earningsOT.restDayOT.hours += restDayOTHours;
            earningsOT.restDayOT.amount += calculateSundayRestDayOT(
              restDayOTHours,
              ratePerHour
            );
          }
        }

        if (nightDiffHours > 0) {
          if (isRankAndFile) {
            // Office-based Rank and File: Rest Day ND goes to earnings breakdown table
            breakdown.restDayNightDiff.hours += nightDiffHours;
            breakdown.restDayNightDiff.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
          // Client-based and Office-based Supervisory/Managerial: NO ND (they have OT allowance)
        }
      }

      // Sunday + Special Holiday
      // NOTE: Holidays are now included in basic salary (all days worked × daily rate)
      // Holiday pay is NOT added separately to gross pay - it's already part of basicSalary
      // Only OT allowances and ND are added separately
      if (dayType === "sunday-special-holiday") {
        // Check if eligible for holiday pay (worked day before or worked on holiday)
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // For Account Supervisors: Always get full daily rate (8 hours) regardless of actual hours worked
          // For other employees: Use actual hours if worked, otherwise 8 hours
          if (isClientBased || isEligibleForAllowances) {
            // Account Supervisors: Always get 8 hours (full daily rate) in basic salary
            basicSalary += 8 * ratePerHour; // Full daily rate
          } else {
            // Other employees: Use actual hours if worked, otherwise 8 hours
            if (regularHours > 0) {
              basicSalary += regularHours * ratePerHour;
            } else {
              basicSalary += 8 * ratePerHour;
            }
          }
        }

        // For Account Supervisors/Supervisory/Managerial: Always get full daily rate (8 hours) regardless of actual hours worked
        // For other employees: Use actual hours
        const hoursToDisplay = (isClientBased || isEligibleForAllowances) ? 8 : regularHours;

        // Track hours and amount for display purposes (informational breakdown)
        // Note: This amount is already included in basicSalary, so it's not added to gross pay separately
        breakdown.specialHoliday.hours += hoursToDisplay;
        // Calculate amount for display: Always full daily rate for Account Supervisors/Supervisory/Managerial
        breakdown.specialHoliday.amount += (isClientBased || isEligibleForAllowances) ? ratePerDay : ((regularHours / 8) * ratePerDay);

        // Add allowance ONLY if they actually worked (clockInTime exists)
        // OT allowances are still added separately (not part of basic salary)
        if (clockInTime && regularHours >= 4) {
          const allowance = calculateHolidayRestDayAllowance(
            regularHours,
            dayType
          );
          if (allowance > 0) {
            otherPay.specialHolidayOnRestDayAllowance.hours += regularHours;
            otherPay.specialHolidayOnRestDayAllowance.amount += allowance;
          }
        }

        // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
        // They only appear in Other Pay section as OT replacements

        // Move OT to allowances or Other Pay based on employee type
        const shOnRDOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (shOnRDOTHours > 0) {
          if (isClientBased || isEligibleForAllowances) {
            // Fixed amounts - goes to Other Pay
            const shOnRDOTAllowance =
              calculateHolidayRestDayOTAllowance(shOnRDOTHours);
            if (shOnRDOTAllowance > 0) {
              otherPay.specialHolidayOnRestDayOT.hours += shOnRDOTHours;
              otherPay.specialHolidayOnRestDayOT.amount += shOnRDOTAllowance;
            }
          } else {
            // Office-based Rank and File: Standard calculation - goes to earnings breakdown table
            earningsOT.shOnRDOT.hours += shOnRDOTHours;
            earningsOT.shOnRDOT.amount += calculateSundaySpecialHolidayOT(
              shOnRDOTHours,
              ratePerHour
            );
          }
        }

        if (nightDiffHours > 0) {
          if (isRankAndFile) {
            // Office-based Rank and File: ND goes to earnings breakdown table
            earningsOT.shNightDiff.hours += nightDiffHours;
            earningsOT.shNightDiff.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
          // Client-based and Office-based Supervisory/Managerial: NO ND (they have OT allowance)
        }
      }

      // Sunday + Regular Holiday
      // NOTE: Holidays are now included in basic salary (all days worked × daily rate)
      // Holiday pay is NOT added separately to gross pay - it's already part of basicSalary
      // Only OT allowances and ND are added separately
      if (dayType === "sunday-regular-holiday") {
        // Check if eligible for holiday pay (worked day before or worked on holiday)
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // For Account Supervisors: Always get full daily rate (8 hours) regardless of actual hours worked
          // For other employees: Use actual hours if worked, otherwise 8 hours
          if (isClientBased || isEligibleForAllowances) {
            // Account Supervisors: Always get 8 hours (full daily rate) in basic salary
            basicSalary += 8 * ratePerHour; // Full daily rate
          } else {
            // Other employees: Use actual hours if worked, otherwise 8 hours
            if (regularHours > 0) {
              basicSalary += regularHours * ratePerHour;
            } else {
              basicSalary += 8 * ratePerHour;
            }
          }
        }

        // For Account Supervisors/Supervisory/Managerial: Always get full daily rate (8 hours) regardless of actual hours worked
        // For other employees: Use actual hours
        const hoursToDisplay = (isClientBased || isEligibleForAllowances) ? 8 : regularHours;

        // Track hours and amount for display purposes (informational breakdown)
        // Note: This amount is already included in basicSalary, so it's not added to gross pay separately
        breakdown.legalHoliday.hours += hoursToDisplay;
        // Calculate amount for display: Always full daily rate for Account Supervisors/Supervisory/Managerial
        breakdown.legalHoliday.amount += (isClientBased || isEligibleForAllowances) ? ratePerDay : ((regularHours / 8) * ratePerDay);

        // Add allowance ONLY if they actually worked (clockInTime exists)
        // OT allowances are still added separately (not part of basic salary)
        if (clockInTime && regularHours >= 4) {
          const allowance = calculateHolidayRestDayAllowance(
            regularHours,
            dayType
          );
          if (allowance > 0) {
            otherPay.legalHolidayOnRestDayAllowance.hours += regularHours;
            otherPay.legalHolidayOnRestDayAllowance.amount += allowance;
          }
        }

        // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
        // They only appear in Other Pay section as OT replacements

        // Move OT based on employee type
        const lhOnRDOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (lhOnRDOTHours > 0) {
          if (isClientBased || isEligibleForAllowances) {
            // Fixed amounts - goes to Other Pay
            const lhOnRDOTAllowance =
              calculateHolidayRestDayOTAllowance(lhOnRDOTHours);
            if (lhOnRDOTAllowance > 0) {
              otherPay.legalHolidayOnRestDayOT.hours += lhOnRDOTHours;
              otherPay.legalHolidayOnRestDayOT.amount += lhOnRDOTAllowance;
            }
          } else {
            // Office-based Rank and File: Standard calculation - goes to earnings breakdown table
            earningsOT.lhOnRDOT.hours += lhOnRDOTHours;
            earningsOT.lhOnRDOT.amount += calculateSundayRegularHolidayOT(
              lhOnRDOTHours,
              ratePerHour
            );
          }
        }

        if (nightDiffHours > 0) {
          if (isRankAndFile) {
            // Office-based Rank and File: ND goes to earnings breakdown table
            earningsOT.legalHolidayND.hours += nightDiffHours;
            earningsOT.legalHolidayND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          }
          // Client-based and Office-based Supervisory/Managerial: NO ND (they have OT allowance)
        }
      }

      // Regular Nightdiff OT (regular day with OT and night diff)
      // Supervisory roles and client-based don't have ND, so no NDOT
      if (dayType === "regular" && overtimeHours > 0 && nightDiffHours > 0) {
        if (isRankAndFile) {
          // Office-based Rank and File: NDOT goes to earnings breakdown table
          earningsOT.regularNightdiffOT.hours += Math.min(
            overtimeHours,
            nightDiffHours
          );
          earningsOT.regularNightdiffOT.amount += calculateNightDiff(
            Math.min(overtimeHours, nightDiffHours),
            ratePerHour
          );
        }
        // Client-based and Office-based Supervisory/Managerial: NO NDOT (they have OT allowance, no ND)
      }
    });

    // Calculate "Days Work" as: (104 hours - absence hours) / 8
    // Base logic: 104 hours per cutoff (13 days × 8 hours), then subtract absences
    // Each absence = 8 hours deduction
    // IMPORTANT: "Days Work" should count actual BH including eligible holidays with BH > 0
    // basePayHours = 104 - (absences × 8), but this doesn't account for eligible holidays
    // Eligible holidays (with BH > 0) should also count toward "Days Work"
    // Basic Salary = Days Worked × Daily Rate (includes all days worked: regular days + holidays)

    // Calculate actual total BH from attendance data (includes eligible holidays with BH > 0)
    // IMPORTANT: Only count days that are today or earlier (exclude future dates)
    // This matches the time attendance calculation which only shows days up to today
    const todayForDaysWork = new Date();
    todayForDaysWork.setHours(0, 0, 0, 0);

    const actualTotalBH = attendanceData.reduce((sum, day) => {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);

      // Only count days that are today or earlier (not future dates)
      if (dayDate > todayForDaysWork) {
        return sum;
      }

      const { dayType, regularHours } = day;

      // Rest days: Only exclude if NOT worked
      // If employee works on rest day, it counts toward Days Work AND they get rest day premium pay
      // Days Work can exceed 13 if employee works on rest days (e.g., 13 regular days + 2 rest days = 15 days)
      // Office-based: Sunday is rest day (dayType === "sunday")
      // Account Supervisors: Rest days are Mon/Tue/Wed (from restDays map)
      const isRestDay = dayType === "sunday" ||
        (restDays && restDays.get(day.date) === true);
      if (isRestDay) {
        // If rest day was worked (has regularHours > 0), count it toward Days Work
        // If rest day was NOT worked (regularHours === 0), exclude it (paid separately as rest day pay for rank/file)
        if (regularHours > 0) {
          // Rest day was worked - count it toward Days Work (no cap, can exceed 13 days)
          return sum + regularHours;
        } else {
          // Rest day was NOT worked - exclude from Days Work (paid separately)
          return sum;
        }
      }

      // Count regular days with hours
      // Regular work days (Mon-Sat for office-based, or excluding rest days for account supervisors) count toward the 13 days
      if (dayType === "regular" && regularHours > 0) {
        return sum + regularHours;
      }

      // Count eligible holidays with BH > 0
      // Holidays count toward the 13 days (they're included in the 104-hour base)
      if (
        (dayType === "regular-holiday" || dayType === "non-working-holiday") &&
        regularHours > 0
      ) {
        // Check if eligible for holiday pay
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          day.date,
          regularHours,
          attendanceData
        );
        if (eligibleForHolidayPay) {
          return sum + regularHours;
        }
      }

      return sum;
    }, 0);

    // Use the maximum of basePayHours and actualTotalBH to ensure eligible holidays are counted
    // basePayHours represents the minimum (104 - absences), but eligible holidays add to it
    const totalBHForDaysWork = Math.max(basePayHours, actualTotalBH);
    let daysWorked = totalBHForDaysWork / 8;

    // NOTE: Days Work can exceed 13 if employee works on rest days
    // Rest day work counts toward Days Work AND gets premium pay separately
    // Maximum is not capped at 13 to allow for rest day work (e.g., 13 regular days + 1 rest day = 14 days)

    // Ensure basicSalary = daysWorked × daily rate (all days worked including holidays)
    // This ensures consistency: basicSalary should equal daysWorked × ratePerDay
    // The basicSalary was calculated by summing individual days, but we verify it matches daysWorked × ratePerDay
    // IMPORTANT: Use rounded daily rate to match displayed value (ensures Daily Rate × Days = Basic Salary)
    const roundedRatePerDay = Math.round(ratePerDay * 100) / 100;
    const expectedBasicSalary = daysWorked * roundedRatePerDay;
    // Use the calculated basicSalary if it's close to expected, otherwise use expected
    // This handles any rounding differences
    if (Math.abs(basicSalary - expectedBasicSalary) > 0.01) {
      // If there's a significant difference, use the expected calculation
      basicSalary = expectedBasicSalary;
    }
    // Round basicSalary to 2 decimal places before using in further calculations
    basicSalary = Math.round(basicSalary * 100) / 100;

    // Debug logging to verify calculation
    if (periodStart && periodEnd) {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");
      if (periodStartStr.includes("2025-12") || periodEndStr.includes("2025-12")) {
        console.log("[PayslipDetailedBreakdown] Days Work calculation:", {
          useBasePayMethod,
          basePayHours,
          absences,
          daysWorked,
          totalRegularHours,
          employeeName: employee.full_name,
        });
      }
    }

    // Calculate total gross pay (sum of all earnings)
    // Basic Salary already includes all days worked (holidays and regular days) at daily rate
    // Holiday amounts (breakdown.legalHoliday.amount and breakdown.specialHoliday.amount) are for display only
    // They're already included in basicSalary, so we don't add them again to gross pay
    const totalGrossPayUnrounded =
      basicSalary +
      breakdown.nightDifferential.amount +
      // breakdown.legalHoliday.amount and breakdown.specialHoliday.amount NOT added - already in basicSalary
      breakdown.restDay.amount +
      breakdown.restDayNightDiff.amount +
      // Note: workingDayoff removed - Saturday is now included in basicSalary (regular work day per law)
      // Add OT and ND items based on employee type
      (isClientBased || isEligibleForAllowances
        ? // Client-based/Supervisory/Managerial: All OT items in Other Pay
          otherPay.regularOT.amount +
          otherPay.legalHolidayOT.amount +
          otherPay.legalHolidayND.amount +
          otherPay.specialHolidayOT.amount +
          otherPay.specialHolidayND.amount +
          otherPay.restDayOT.amount +
          otherPay.restDayND.amount +
          otherPay.specialHolidayOnRestDayOT.amount +
          otherPay.legalHolidayOnRestDayOT.amount +
          otherPay.regularNightdiffOT.amount +
          otherPay.legalHolidayAllowance.amount +
          otherPay.specialHolidayAllowance.amount +
          otherPay.restDayAllowance.amount +
          otherPay.specialHolidayOnRestDayAllowance.amount +
          otherPay.legalHolidayOnRestDayAllowance.amount
        : // Regular employees: OT and ND items in earnings breakdown table
          earningsOT.regularOvertime.amount +
          earningsOT.legalHolidayOT.amount +
          earningsOT.legalHolidayND.amount +
          earningsOT.shOT.amount +
          earningsOT.shNightDiff.amount +
          earningsOT.shOnRDOT.amount +
          earningsOT.lhOnRDOT.amount +
          earningsOT.restDayOT.amount +
          earningsOT.regularNightdiffOT.amount);
    
    // Round all breakdown amounts to 2 decimals before summing
    const roundTo2Decimals = (val: number) => Math.round(val * 100) / 100;
    const roundedBreakdown = {
      nightDifferential: roundTo2Decimals(breakdown.nightDifferential.amount),
      restDay: roundTo2Decimals(breakdown.restDay.amount),
      restDayNightDiff: roundTo2Decimals(breakdown.restDayNightDiff.amount),
    };
    
    const roundedOtherPay = isClientBased || isEligibleForAllowances ? {
      regularOT: roundTo2Decimals(otherPay.regularOT.amount),
      legalHolidayOT: roundTo2Decimals(otherPay.legalHolidayOT.amount),
      legalHolidayND: roundTo2Decimals(otherPay.legalHolidayND.amount),
      specialHolidayOT: roundTo2Decimals(otherPay.specialHolidayOT.amount),
      specialHolidayND: roundTo2Decimals(otherPay.specialHolidayND.amount),
      restDayOT: roundTo2Decimals(otherPay.restDayOT.amount),
      restDayND: roundTo2Decimals(otherPay.restDayND.amount),
      specialHolidayOnRestDayOT: roundTo2Decimals(otherPay.specialHolidayOnRestDayOT.amount),
      legalHolidayOnRestDayOT: roundTo2Decimals(otherPay.legalHolidayOnRestDayOT.amount),
      regularNightdiffOT: roundTo2Decimals(otherPay.regularNightdiffOT.amount),
      legalHolidayAllowance: roundTo2Decimals(otherPay.legalHolidayAllowance.amount),
      specialHolidayAllowance: roundTo2Decimals(otherPay.specialHolidayAllowance.amount),
      restDayAllowance: roundTo2Decimals(otherPay.restDayAllowance.amount),
      specialHolidayOnRestDayAllowance: roundTo2Decimals(otherPay.specialHolidayOnRestDayAllowance.amount),
      legalHolidayOnRestDayAllowance: roundTo2Decimals(otherPay.legalHolidayOnRestDayAllowance.amount),
    } : null;
    
    const roundedEarningsOT = !(isClientBased || isEligibleForAllowances) ? {
      regularOvertime: roundTo2Decimals(earningsOT.regularOvertime.amount),
      legalHolidayOT: roundTo2Decimals(earningsOT.legalHolidayOT.amount),
      legalHolidayND: roundTo2Decimals(earningsOT.legalHolidayND.amount),
      shOT: roundTo2Decimals(earningsOT.shOT.amount),
      shNightDiff: roundTo2Decimals(earningsOT.shNightDiff.amount),
      shOnRDOT: roundTo2Decimals(earningsOT.shOnRDOT.amount),
      lhOnRDOT: roundTo2Decimals(earningsOT.lhOnRDOT.amount),
      restDayOT: roundTo2Decimals(earningsOT.restDayOT.amount),
      regularNightdiffOT: roundTo2Decimals(earningsOT.regularNightdiffOT.amount),
    } : null;
    
    // Calculate total gross pay using rounded values
    const totalGrossPayUnroundedRounded = basicSalary +
      roundedBreakdown.nightDifferential +
      roundedBreakdown.restDay +
      roundedBreakdown.restDayNightDiff +
      (isClientBased || isEligibleForAllowances
        ? roundedOtherPay!.regularOT +
          roundedOtherPay!.legalHolidayOT +
          roundedOtherPay!.legalHolidayND +
          roundedOtherPay!.specialHolidayOT +
          roundedOtherPay!.specialHolidayND +
          roundedOtherPay!.restDayOT +
          roundedOtherPay!.restDayND +
          roundedOtherPay!.specialHolidayOnRestDayOT +
          roundedOtherPay!.legalHolidayOnRestDayOT +
          roundedOtherPay!.regularNightdiffOT +
          roundedOtherPay!.legalHolidayAllowance +
          roundedOtherPay!.specialHolidayAllowance +
          roundedOtherPay!.restDayAllowance +
          roundedOtherPay!.specialHolidayOnRestDayAllowance +
          roundedOtherPay!.legalHolidayOnRestDayAllowance
        : roundedEarningsOT!.regularOvertime +
          roundedEarningsOT!.legalHolidayOT +
          roundedEarningsOT!.legalHolidayND +
          roundedEarningsOT!.shOT +
          roundedEarningsOT!.shNightDiff +
          roundedEarningsOT!.shOnRDOT +
          roundedEarningsOT!.lhOnRDOT +
          roundedEarningsOT!.restDayOT +
          roundedEarningsOT!.regularNightdiffOT);
    const totalGrossPay = Math.round(totalGrossPayUnroundedRounded * 100) / 100;

    return {
      totalHours,
      daysWorked,
      basicSalary,
      totalRegularHours,
      breakdown,
      earningsOT,
      otherPay,
      basePayHours,
      absences,
      useBasePayMethod,
      totalGrossPay,
    };
  }, [
    attendanceData,
    isClientBased,
    isEligibleForAllowances,
    isRankAndFile,
    ratePerHour,
    ratePerDay,
    periodStart,
    periodEnd,
    restDays,
    holidays,
    employee.hire_date,
    employee.termination_date,
  ]);

  const {
    totalHours,
    daysWorked,
    basicSalary,
    totalRegularHours,
    breakdown,
    earningsOT,
    otherPay,
    totalGrossPay,
  } = calculationResult;
  const totalSalary = basicSalary;

  // Notify parent component of total gross pay change
  // This ensures Payslip Summary always has the correct Gross Pay value
  // Call immediately whenever totalGrossPay is calculated or changes
  useEffect(() => {
    console.log('[PayslipDetailedBreakdown] useEffect triggered:', {
      hasCallback: !!onTotalGrossPayChange,
      totalGrossPay,
      isUndefined: totalGrossPay === undefined,
      isNegative: totalGrossPay < 0,
    });

    if (onTotalGrossPayChange && totalGrossPay !== undefined && totalGrossPay >= 0) {
      console.log('[PayslipDetailedBreakdown] Calling onTotalGrossPayChange with:', totalGrossPay);
      onTotalGrossPayChange(totalGrossPay);
    } else {
      console.warn('[PayslipDetailedBreakdown] Cannot call onTotalGrossPayChange:', {
        hasCallback: !!onTotalGrossPayChange,
        totalGrossPay,
        isUndefined: totalGrossPay === undefined,
        isNegative: totalGrossPay < 0,
      });
    }
  }, [onTotalGrossPayChange, totalGrossPay]);

  return (
    <div className="w-full">
      {/* Employee Name - Compact */}
      <div className="mb-2">
        <h3 className="text-sm font-semibold text-gray-700">
          {employee.full_name}
        </h3>
      </div>

      {/* Basic Earning(s) Section - Compact */}
      <div className="mb-3">
        <h4 className="text-sm font-semibold mb-2 text-gray-800">
          Basic Earning(s)
        </h4>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">
                    Days Work
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Daily Rate
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Hourly Rate
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Basic Salary
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Gross Pay
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                    {daysWorked.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                    {formatCurrency(ratePerDay)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono text-gray-700">
                    {(Math.round(ratePerHour * 100) / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">
                    {formatCurrency(basicSalary)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-bold text-primary-700">
                    {formatCurrency(totalGrossPay)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Overtimes/Holiday Earning(s) Section - Compact */}
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-800">
            Overtimes/Holiday Earning(s)
          </h4>
          {(isClientBased || isEligibleForAllowances) && (
            <span className="text-xs text-gray-500 italic">
              (OT items shown in Other Pay section)
            </span>
          )}
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">
                    Component
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    #Hours
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Rate Multiplier
                  </th>
                  <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {/* Helper function to render earning row */}
                {(() => {
                  const renderEarningRow = (
                    label: string,
                    hours: number,
                    rate: number | string,
                    amount: number,
                    showCalculation: boolean = false
                  ) => {
                    const hoursValue = hours.toFixed(2);
                    const amountValue = amount;
                    const rateDisplay =
                      typeof rate === "number" ? rate.toFixed(2) : rate;
                    const hasValue = hours > 0 || amount > 0;

                    return (
                      <tr
                        className={`transition-colors ${
                          hasValue
                            ? "bg-white hover:bg-gray-50"
                            : "bg-gray-50/50 opacity-60"
                        }`}
                      >
                        <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                          {label}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right text-gray-700 font-mono">
                          {hoursValue}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right">
                          {showCalculation && hasValue ? (
                            <span
                              className="inline-flex items-center gap-0.5 text-gray-600 cursor-help"
                              title={`Formula: ${hoursValue} hrs × ₱${ratePerHour.toFixed(
                                2
                              )}/hr × ${rateDisplay} = ${formatCurrency(
                                amountValue
                              )}`}
                            >
                              <span className="font-mono">{hoursValue}</span>
                              <span className="text-gray-400">×</span>
                              <span className="font-semibold text-primary-600">
                                {typeof rate === "number" && rate >= 1
                                  ? `${rateDisplay}x`
                                  : rateDisplay}
                              </span>
                            </span>
                          ) : (
                            <span className="text-gray-500">
                              {typeof rate === "number" && rate >= 1
                                ? `${rateDisplay}x`
                                : rateDisplay}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">
                          {formatCurrency(amountValue)}
                        </td>
                      </tr>
                    );
                  };

                  return (
                    <>
                      {/* Hours Work - Total hours worked (including rest days, excluding holidays) */}
                      {renderEarningRow("1. Hours Work", totalHours, "—", 0)}

                      {/* Night Differential */}
                      {renderEarningRow(
                        "2. Night Differential",
                        breakdown.nightDifferential.hours,
                        PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                        breakdown.nightDifferential.amount,
                        true
                      )}

                      {/* Legal Holiday */}
                      {renderEarningRow(
                        "3. Legal Holiday",
                        breakdown.legalHoliday.hours,
                        // Supervisory/Managerial: 1.0x (daily rate only, no multiplier)
                        // Rank and File: 2.0x multiplier
                        isClientBased || isEligibleForAllowances
                          ? 1.0
                          : PAYROLL_MULTIPLIERS.REGULAR_HOLIDAY,
                        breakdown.legalHoliday.amount,
                        true
                      )}

                      {/* Special Holiday */}
                      {renderEarningRow(
                        "4. Special Holiday",
                        breakdown.specialHoliday.hours,
                        // Supervisory/Managerial: 1.0x (daily rate only, no multiplier)
                        // Rank and File: 1.3x multiplier
                        isClientBased || isEligibleForAllowances
                          ? 1.0
                          : PAYROLL_MULTIPLIERS.SPECIAL_HOLIDAY,
                        breakdown.specialHoliday.amount,
                        true
                      )}

                      {/* Rest Day */}
                      {renderEarningRow(
                        "5. Rest Day",
                        breakdown.restDay.hours,
                        // Supervisory/Managerial: 1.0x (daily rate only, no multiplier)
                        // Rank and File: 1.3x multiplier
                        isClientBased || isEligibleForAllowances
                          ? 1.0
                          : PAYROLL_MULTIPLIERS.REST_DAY,
                        breakdown.restDay.amount,
                        true
                      )}

                      {/* Rest Day Night Diff */}
                      {renderEarningRow(
                        "6. Rest Day ND",
                        breakdown.restDayNightDiff.hours,
                        PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                        breakdown.restDayNightDiff.amount,
                        true
                      )}

                      {/* Working Day Off removed - Saturday is now included in Basic Salary (regular work day per law) */}

                      {/* OT Items - Only show for regular employees (deployed) */}
                      {!isAccountSupervisor && !isOfficeBased && (
                        <>
                          {/* Regular Overtime */}
                          {renderEarningRow(
                            "8. Regular Overtime",
                            earningsOT.regularOvertime.hours,
                            PAYROLL_MULTIPLIERS.REGULAR_OT,
                            earningsOT.regularOvertime.amount,
                            true
                          )}

                          {/* Legal Holiday OT */}
                          {renderEarningRow(
                            "9. Legal Holiday OT",
                            earningsOT.legalHolidayOT.hours,
                            PAYROLL_MULTIPLIERS.REGULAR_HOLIDAY *
                              PAYROLL_MULTIPLIERS.OT_PREMIUM,
                            earningsOT.legalHolidayOT.amount,
                            true
                          )}

                          {/* Legal Holiday ND */}
                          {renderEarningRow(
                            "10. Legal Holiday ND",
                            earningsOT.legalHolidayND.hours,
                            PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                            earningsOT.legalHolidayND.amount,
                            true
                          )}

                          {/* Special Holiday OT */}
                          {renderEarningRow(
                            "11. Special Holiday OT",
                            earningsOT.shOT.hours,
                            PAYROLL_MULTIPLIERS.SPECIAL_HOLIDAY *
                              PAYROLL_MULTIPLIERS.OT_PREMIUM,
                            earningsOT.shOT.amount,
                            true
                          )}

                          {/* Special Holiday ND */}
                          {renderEarningRow(
                            "12. Special Holiday ND",
                            earningsOT.shNightDiff.hours,
                            PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                            earningsOT.shNightDiff.amount,
                            true
                          )}

                          {/* Special Holiday on Rest Day OT */}
                          {renderEarningRow(
                            "13. Special Holiday on Rest Day OT",
                            earningsOT.shOnRDOT.hours,
                            PAYROLL_MULTIPLIERS.SUNDAY_SPECIAL_HOLIDAY *
                              PAYROLL_MULTIPLIERS.OT_PREMIUM,
                            earningsOT.shOnRDOT.amount,
                            true
                          )}

                          {/* Legal Holiday on Rest Day OT */}
                          {renderEarningRow(
                            "14. Legal Holiday on Rest Day OT",
                            earningsOT.lhOnRDOT.hours,
                            PAYROLL_MULTIPLIERS.SUNDAY_REGULAR_HOLIDAY *
                              PAYROLL_MULTIPLIERS.OT_PREMIUM,
                            earningsOT.lhOnRDOT.amount,
                            true
                          )}

                          {/* Rest Day OT */}
                          {renderEarningRow(
                            "15. Rest Day OT",
                            earningsOT.restDayOT.hours,
                            PAYROLL_MULTIPLIERS.REST_DAY *
                              PAYROLL_MULTIPLIERS.OT_PREMIUM,
                            earningsOT.restDayOT.amount,
                            true
                          )}

                          {/* Regular Night Differential OT */}
                          {renderEarningRow(
                            "16. Regular Night Differential OT",
                            earningsOT.regularNightdiffOT.hours,
                            PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                            earningsOT.regularNightdiffOT.amount,
                            true
                          )}
                        </>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Summary Footer - Compact */}
          <div className="bg-gray-50 border-t border-gray-200 px-2 py-1.5">
            <div className="flex justify-between items-center">
              <span className="text-xs font-medium text-gray-700">
                Total Earnings:
              </span>
              <span className="text-sm font-bold text-primary-700">
                {formatCurrency(
                  breakdown.nightDifferential.amount +
                    // breakdown.legalHoliday.amount and breakdown.specialHoliday.amount removed - already in basicSalary
                    breakdown.restDay.amount +
                    breakdown.restDayNightDiff.amount +
                    // Note: workingDayoff removed - Saturday is now included in basicSalary (regular work day per law)
                    // Add OT items for regular employees
                    (isClientBased || isEligibleForAllowances
                      ? 0
                      : earningsOT.regularOvertime.amount +
                        earningsOT.legalHolidayOT.amount +
                        earningsOT.legalHolidayND.amount +
                        earningsOT.shOT.amount +
                        earningsOT.shNightDiff.amount +
                        earningsOT.shOnRDOT.amount +
                        earningsOT.lhOnRDOT.amount +
                        earningsOT.restDayOT.amount +
                        earningsOT.regularNightdiffOT.amount)
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Other Pay Section - For Account Supervisors and Office-based employees */}
      {/* Contains all OT and ND items combined in one table */}
      {/* Debug: Check if employee is eligible and if allowances are calculated */}
      {(() => {
        const hasAllowances =
          otherPay.regularOT.amount > 0 ||
          otherPay.legalHolidayOT.amount > 0 ||
          otherPay.specialHolidayOT.amount > 0 ||
          otherPay.restDayOT.amount > 0 ||
          otherPay.specialHolidayOnRestDayOT.amount > 0 ||
          otherPay.legalHolidayOnRestDayOT.amount > 0 ||
          otherPay.legalHolidayAllowance.amount > 0 ||
          otherPay.specialHolidayAllowance.amount > 0 ||
          otherPay.restDayAllowance.amount > 0 ||
          otherPay.specialHolidayOnRestDayAllowance.amount > 0 ||
          otherPay.legalHolidayOnRestDayAllowance.amount > 0;

        // Debug log (remove in production)
        if (process.env.NODE_ENV === "development") {
          console.log("Other Pay Debug:", {
            isClientBased,
            isEligibleForAllowances,
            isAccountSupervisor,
            hasAllowances,
            otherPay: {
              regularOT: otherPay.regularOT.amount,
              legalHolidayOT: otherPay.legalHolidayOT.amount,
              specialHolidayOT: otherPay.specialHolidayOT.amount,
              restDayOT: otherPay.restDayOT.amount,
            },
          });
        }

        return (isClientBased || isEligibleForAllowances) && hasAllowances;
      })() && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-semibold text-gray-800">Other Pay</h4>
            <span className="text-xs text-gray-500 italic">
              (OT & ND -{" "}
              {isAccountSupervisor ? "Account Supervisor" : "Office-based"})
            </span>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-2 py-1.5 text-left text-xs font-semibold text-gray-700">
                      Component
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                      #Hours
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                      Rate
                    </th>
                    <th className="px-2 py-1.5 text-right text-xs font-semibold text-gray-700">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const renderAllowanceRow = (
                      label: string,
                      hours: number,
                      rate: number | string,
                      amount: number,
                      showCalculation: boolean = false
                    ) => {
                      const hoursValue = hours.toFixed(2);
                      const amountValue = amount;
                      const rateDisplay =
                        typeof rate === "number" ? rate.toFixed(2) : rate;
                      const hasValue = hours > 0 || amount > 0;

                      return (
                        <tr
                          className={`transition-colors ${
                            hasValue
                              ? "bg-white hover:bg-gray-50"
                              : "bg-gray-50/50 opacity-60"
                          }`}
                        >
                          <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                            {label}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-right text-gray-700 font-mono">
                            {hoursValue}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-right">
                            {showCalculation && hasValue ? (
                              <span
                                className="inline-flex items-center gap-0.5 text-gray-600 cursor-help"
                                title={`Formula: ${hoursValue} hrs × ₱${ratePerHour.toFixed(
                                  2
                                )}/hr × ${rateDisplay} = ${formatCurrency(
                                  amountValue
                                )}`}
                              >
                                <span className="font-mono">{hoursValue}</span>
                                <span className="text-gray-400">×</span>
                                <span className="font-semibold text-primary-600">
                                  {typeof rate === "number" && rate >= 1
                                    ? `${rateDisplay}x`
                                    : rateDisplay}
                                </span>
                              </span>
                            ) : (
                              <span className="text-gray-500">
                                {typeof rate === "number" && rate >= 1
                                  ? `${rateDisplay}x`
                                  : rateDisplay}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">
                            {formatCurrency(amountValue)}
                          </td>
                        </tr>
                      );
                    };

                    return (
                      <>
                        {/* OT Allowances - Fixed amounts replacing OT calculations */}
                        {otherPay.regularOT.amount > 0 &&
                          renderAllowanceRow(
                            "Regular OT Allowance",
                            otherPay.regularOT.hours,
                            "Fixed Amount",
                            otherPay.regularOT.amount,
                            false
                          )}
                        {/* Night Differential Allowances */}
                        {otherPay.regularNightDiff.amount > 0 &&
                          renderAllowanceRow(
                            "Night Differential",
                            otherPay.regularNightDiff.hours,
                            PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                            otherPay.regularNightDiff.amount,
                            true
                          )}
                        {otherPay.legalHolidayOT.amount > 0 &&
                          renderAllowanceRow(
                            "Legal Holiday OT Allowance",
                            otherPay.legalHolidayOT.hours,
                            "Fixed Amount",
                            otherPay.legalHolidayOT.amount,
                            false
                          )}
                        {otherPay.specialHolidayOT.amount > 0 &&
                          renderAllowanceRow(
                            "Special Holiday OT Allowance",
                            otherPay.specialHolidayOT.hours,
                            "Fixed Amount",
                            otherPay.specialHolidayOT.amount,
                            false
                          )}
                        {otherPay.restDayOT.amount > 0 &&
                          renderAllowanceRow(
                            "Rest Day OT Allowance",
                            otherPay.restDayOT.hours,
                            "Fixed Amount",
                            otherPay.restDayOT.amount,
                            false
                          )}
                        {otherPay.restDayND.amount > 0 &&
                          renderAllowanceRow(
                            "Rest Day Night Differential",
                            otherPay.restDayND.hours,
                            PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                            otherPay.restDayND.amount,
                            true
                          )}
                        {otherPay.specialHolidayOnRestDayOT.amount > 0 &&
                          renderAllowanceRow(
                            "Special Holiday on Rest Day OT Allowance",
                            otherPay.specialHolidayOnRestDayOT.hours,
                            "Fixed Amount",
                            otherPay.specialHolidayOnRestDayOT.amount,
                            false
                          )}
                        {otherPay.legalHolidayOnRestDayOT.amount > 0 &&
                          renderAllowanceRow(
                            "Legal Holiday on Rest Day OT Allowance",
                            otherPay.legalHolidayOnRestDayOT.hours,
                            "Fixed Amount",
                            otherPay.legalHolidayOnRestDayOT.amount,
                            false
                          )}
                        {/* Allowances for regular hours worked on holidays/rest days */}
                        {otherPay.legalHolidayAllowance.amount > 0 &&
                          renderAllowanceRow(
                            "Legal Holiday Allowance",
                            otherPay.legalHolidayAllowance.hours,
                            "Fixed Amount",
                            otherPay.legalHolidayAllowance.amount,
                            false
                          )}
                        {otherPay.specialHolidayAllowance.amount > 0 &&
                          renderAllowanceRow(
                            "Special Holiday Allowance",
                            otherPay.specialHolidayAllowance.hours,
                            "Fixed Amount",
                            otherPay.specialHolidayAllowance.amount,
                            false
                          )}
                        {otherPay.restDayAllowance.amount > 0 &&
                          renderAllowanceRow(
                            "Rest Day Allowance",
                            otherPay.restDayAllowance.hours,
                            "Fixed Amount",
                            otherPay.restDayAllowance.amount,
                            false
                          )}
                        {otherPay.specialHolidayOnRestDayAllowance.amount > 0 &&
                          renderAllowanceRow(
                            "Special Holiday on Rest Day Allowance",
                            otherPay.specialHolidayOnRestDayAllowance.hours,
                            "Fixed Amount",
                            otherPay.specialHolidayOnRestDayAllowance.amount,
                            false
                          )}
                        {otherPay.legalHolidayOnRestDayAllowance.amount > 0 &&
                          renderAllowanceRow(
                            "Legal Holiday on Rest Day Allowance",
                            otherPay.legalHolidayOnRestDayAllowance.hours,
                            "Fixed Amount",
                            otherPay.legalHolidayOnRestDayAllowance.amount,
                            false
                          )}

                        {/* Note: Supervisory roles and client-based employees don't have ND (they have OT allowance) */}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
            {/* Summary Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-2 py-1.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-gray-700">
                  Total Other Pay:
                </span>
                <span className="text-sm font-bold text-primary-700">
                  {formatCurrency(
                    otherPay.regularOT.amount +
                      otherPay.legalHolidayOT.amount +
                      otherPay.specialHolidayOT.amount +
                      otherPay.restDayOT.amount +
                      otherPay.specialHolidayOnRestDayOT.amount +
                      otherPay.legalHolidayOnRestDayOT.amount +
                      otherPay.legalHolidayAllowance.amount +
                      otherPay.specialHolidayAllowance.amount +
                      otherPay.restDayAllowance.amount +
                      otherPay.specialHolidayOnRestDayAllowance.amount +
                      otherPay.legalHolidayOnRestDayAllowance.amount
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Memoize to prevent expensive recalculations on parent re-renders
export const PayslipDetailedBreakdown = memo(PayslipDetailedBreakdownComponent);