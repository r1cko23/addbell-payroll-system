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
import {
  calculateHoursWithinWindows,
  getBusinessDayPolicyByDay,
} from "@/utils/business-hours";
import {
  creditNightDiffHours,
  creditWorkHoursHalfHour,
} from "@/utils/overtime";
import {
  HOLIDAY_UNWORKED_CREDIT_HOURS,
  isEligibleForHolidayPayRule,
} from "@/utils/holidays";
import {
  buildPayslipPrintSyncFromDetailedBreakdown,
  type PayslipPrintEarningsSync,
} from "@/lib/payslip-print-sync";

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
  /** Keeps classic print/preview rows aligned with this breakdown. */
  onPrintSync?: (sync: PayslipPrintEarningsSync) => void;
}

function PayslipDetailedBreakdownComponent({
  employee,
  attendanceData,
  periodStart,
  periodEnd,
  restDays,
  holidays = [],
  onTotalGrossPayChange,
  onPrintSync,
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

    const dayPolicy = getBusinessDayPolicyByDay(workDate.getDay());

    // Calculate total hours worked
    const totalMs = clockOut.getTime() - clockIn.getTime();
    const totalHours = totalMs / (1000 * 60 * 60);

    // Calculate regular hours based on configured business windows by weekday.
    let regularHours = calculateHoursWithinWindows(
      clockIn,
      clockOut,
      workDate,
      dayPolicy.windows
    );

    // Night differential: only when OT overlaps 10PM–6AM Philippine time (all employees)
    const ndStartHour = 22; // 10PM – 6AM; 0 ND if outside this window
    let nightDiffHours = 0;

    // Same day: hours after ND start
    if (clockOut.getDate() === clockIn.getDate()) {
      const nightDiffStart = new Date(workDate);
      nightDiffStart.setHours(ndStartHour, 0, 0, 0);

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
      // Hours from ND start to midnight on first day
      const nightDiffStart = new Date(clockIn);
      nightDiffStart.setHours(ndStartHour, 0, 0, 0);
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
      regularHours: creditWorkHoursHalfHour(
        Math.round(regularHours * 100) / 100
      ),
      nightDiffHours: creditNightDiffHours(
        Math.round(nightDiffHours * 100) / 100
      ),
      totalHours: Math.round(totalHours * 100) / 100,
    };
  }

  // Calculate breakdown from attendance data
  // Use useMemo to ensure recalculation when employee type or attendance data changes
  const calculationResult = useMemo(() => {
    const isEligibleForHolidayPay = isEligibleForHolidayPayRule;

    // Weekly cutoff: base hours = scheduled work days in period × 8, minus absences (see calculateBasePay)
    let basePayHours = 0;
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

      basePayHours = basePayResult.finalBaseHours;
      basePayAmount = basePayHours * ratePerHour;
      absences = basePayResult.absences;
    }

    // Sum of generator regularHours on calendar "regular" days (matches timesheet BH column for Mon–Sat).
    const regularHoursWorked = attendanceData.reduce((sum, d) => {
      if (d.dayType === "regular") {
        return (
          sum +
          creditWorkHoursHalfHour(Math.round((d.regularHours || 0) * 100) / 100)
        );
      }
      return sum;
    }, 0);

    // Total hours for "Hours Work" - should match timesheet calculation exactly
    // Only count regular days (Mon–Sat per actual hours), and eligible holidays
    // Exclude Sundays from "Hours Work" (they're paid separately)
    let totalHours = 0; // Total hours for "Hours Work" display (matches timesheet BH)
    let totalRegularHours = 0; // Total regular hours for "Days Work" calculation
    let basicSalary = 0; // Basic salary from REGULAR WORK DAYS ONLY (excludes holidays, rest days, OT, allowances)

    // Base pay hours from scheduled slots (see calculateBasePay); used for absence diagnostics.
    if (useBasePayMethod) {
      totalRegularHours = regularHoursWorked;
      totalHours = regularHoursWorked;
    }

    const breakdown = {
      nightDifferential: { hours: 0, amount: 0 },
      legalHoliday: { hours: 0, amount: 0 },
      specialHoliday: { hours: 0, amount: 0 },
      restDay: { hours: 0, amount: 0 },
      restDayNightDiff: { hours: 0, amount: 0 },
      workingDayoff: { hours: 0, amount: 0 },
    };

    // Earnings breakdown — statutory OT/ND hours and amounts (all employees)
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

    // Other Pay — optional fixed work allowances on holidays/rest days (supervisory/client-based policy only)
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

      // Use regularHours from attendance_data (same as timesheet uses bh),
      // but apply current BH crediting (whole-hour floor) for consistency,
      // especially for legacy records that still have decimals.
      // The attendance_data is generated from time clock entries, so it already has the correct hours
      // Only recalculate from clock times if clock times are available AND regularHours is 0 (to catch missing data)
      let regularHours = creditWorkHoursHalfHour(
        Math.round((dayRegularHours || 0) * 100) / 100
      );
      let nightDiffHours = creditNightDiffHours(
        Math.round((dayNightDiffHours || 0) * 100) / 100
      );

      // Only recalculate from clock times if:
      // 1. Clock times are available
      // 2. regularHours is 0 (missing data)
      // 3. It's not a leave day with full hours
      const isLeaveDayWithFullHours = (dayRegularHours || 0) >= 8;
      const dayOfWeekForRecalc = new Date(date).getDay();
      if (
        clockInTime &&
        clockOutTime &&
        regularHours === 0 &&
        dayOfWeekForRecalc !== 6 &&
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

        // REST DAY RULES:
        // - Office-based: Sunday is rest day - NOT PAID if not worked
        // - Client-based: scheduled rest days - NOT PAID if not worked
        // - Mon–Sat: pay only actual regular hours (6-day week; no automatic 8h on unworked Saturday)

        if (dayOfWeek === 0 && (isClientBased || isAccountSupervisor) && finalRegularHours === 0) {
          // Sunday Regular Work Day for Client-Based Account Supervisors:
          // For client-based account supervisors, rest days are Monday, Tuesday, or Wednesday
          // If Sunday is NOT their rest day, it should be treated like Saturday (regular workday)
          const isSundayRestDay = restDays?.get(date) === true;
          if (!isSundayRestDay) {
            // Sunday is NOT their rest day - treat like Saturday (regular workday)
            // But client-based must have clock entries - no automatic 8 BH
            // This case should only apply if they actually worked (finalRegularHours > 0)
            // If no work, don't pay (unlike office-based Saturday)
          }
        } else if (finalRegularHours > 0) {
          // Regular day with work - count actual hours (Mon–Sat and eligible Sundays)
          hoursToCount = finalRegularHours;
          basicSalary += finalRegularHours * ratePerHour;
        }
        // If finalRegularHours === 0, don't pay basic for that day
        // Rest days (Sunday for office-based, or Mon/Tue/Wed for client-based) are NOT paid if not worked
      } else if (dayType === "regular-holiday") {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          finalRegularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const paidH = hasCompleteLog
            ? finalRegularHours
            : HOLIDAY_UNWORKED_CREDIT_HOURS;

          hoursToCount = paidH;
          breakdown.legalHoliday.hours += paidH;
          // Policy: eligible Regular Holiday pay always uses the multiplier,
          // even if credited hours (no complete log).
          breakdown.legalHoliday.amount += calculateRegularHoliday(
            paidH,
            ratePerHour
          );
        }
      } else if (dayType === "non-working-holiday") {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          finalRegularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const paidH = hasCompleteLog
            ? finalRegularHours
            : HOLIDAY_UNWORKED_CREDIT_HOURS;

          hoursToCount = paidH;
          breakdown.specialHoliday.hours += paidH;
          // Policy: eligible Special Holiday pay always uses the multiplier,
          // even if credited hours (no complete log).
          breakdown.specialHoliday.amount += calculateNonWorkingHoliday(
            paidH,
            ratePerHour
          );
        }
      }
      // Sundays are excluded (dayType === "sunday") - they're paid separately

      // When using weekly base pay, totalRegularHours/totalHours are set from basePayHours once; do not add per day.
      if (hoursToCount > 0 && !useBasePayMethod) {
        totalRegularHours += hoursToCount;
        totalHours += hoursToCount;
      }

      // Regular overtime — statutory (Labor Code) hourly OT for all employees
      const otHours =
        typeof overtimeHours === "string"
          ? parseFloat(overtimeHours)
          : overtimeHours || 0;
      if (dayType === "regular" && otHours > 0) {
        earningsOT.regularOvertime.hours += otHours;
        earningsOT.regularOvertime.amount += calculateRegularOT(otHours, ratePerHour);
      }

      // Night Differential (regular days only - holidays and rest days have separate ND calculations)
      // Policy: ND is derived from approved OT only (regular work ends at 6PM).
      // So we attribute all regular-day ND into the single "Night Differential" line.
      if (dayType === "regular" && nightDiffHours > 0) {
        breakdown.nightDifferential.hours += nightDiffHours;
        breakdown.nightDifferential.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }

      // Regular Holiday (regular-holiday) — computed separately from regular work hours.
      if (dayType === "regular-holiday") {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // Allowance only when they actually worked (clockInTime and regularHours >= 4)
          if (clockInTime && regularHours >= 4) {
            const allowance = calculateHolidayRestDayAllowance(
              regularHours,
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
          earningsOT.legalHolidayOT.hours += legalHolidayOTHours;
          earningsOT.legalHolidayOT.amount += calculateRegularHolidayOT(
            legalHolidayOTHours,
            ratePerHour
          );
        }

        if (nightDiffHours > 0) {
          earningsOT.legalHolidayND.hours += nightDiffHours;
          earningsOT.legalHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Special Holiday (non-working-holiday) — computed separately from regular work hours.
      if (dayType === "non-working-holiday") {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          // Allowance only when they actually worked (clockInTime and regularHours >= 4)
          if (clockInTime && regularHours >= 4) {
            const allowance = calculateHolidayRestDayAllowance(
              regularHours,
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
          earningsOT.shOT.hours += specialHolidayOTHours;
          earningsOT.shOT.amount += calculateNonWorkingHolidayOT(
            specialHolidayOTHours,
            ratePerHour
          );
        }

        if (nightDiffHours > 0) {
          earningsOT.shNightDiff.hours += nightDiffHours;
          earningsOT.shNightDiff.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
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
          // REST DAY PAY RULES:
          // - Office-based: Sunday is rest day - NOT PAID if not worked
          // - Client-based: Rest day (Mon/Tue/Wed) - NOT PAID if not worked
          // - Only paid if employee actually worked on rest day (regularHours > 0)
          if (regularHours > 0) {
            // Employee worked on rest day - calculate rest day pay
            if (!isClientBased && !isEligibleForAllowances) {
              // Office-based Rank and File: Standard multiplier calculation (1.3x)
              const standardAmount = calculateSundayRestDay(
                regularHours,
                ratePerHour
              );
              breakdown.restDay.hours += regularHours;
              breakdown.restDay.amount += standardAmount;
            } else {
              // Client-based Account Supervisors/Supervisory/Managerial:
              // Always get full daily rate (8 hours) regardless of actual hours worked
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
          }
          // If regularHours === 0, it means they didn't work on the rest day - NO PAY
        }

        // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
        // They only appear in Other Pay section as OT replacements

        // Move Rest Day OT based on employee type
        const restDayOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (restDayOTHours > 0) {
          earningsOT.restDayOT.hours += restDayOTHours;
          earningsOT.restDayOT.amount += calculateSundayRestDayOT(
            restDayOTHours,
            ratePerHour
          );
        }

        if (nightDiffHours > 0) {
          breakdown.restDayNightDiff.hours += nightDiffHours;
          breakdown.restDayNightDiff.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Special Holiday
      if (dayType === "sunday-special-holiday") {
        // Check if eligible for holiday pay (worked day before or worked on holiday)
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const paidH = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
          breakdown.specialHoliday.hours += paidH;
          // Policy: eligible Sunday+Special always uses 1.5x, even for credited hours.
          breakdown.specialHoliday.amount += paidH * ratePerHour * 1.5;
        }

        // Add allowance ONLY if they actually worked (clockInTime exists)
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
          earningsOT.shOnRDOT.hours += shOnRDOTHours;
          earningsOT.shOnRDOT.amount += calculateSundaySpecialHolidayOT(
            shOnRDOTHours,
            ratePerHour
          );
        }

        if (nightDiffHours > 0) {
          earningsOT.shNightDiff.hours += nightDiffHours;
          earningsOT.shNightDiff.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Regular Holiday
      if (dayType === "sunday-regular-holiday") {
        // Check if eligible for holiday pay (worked day before or worked on holiday)
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          date,
          regularHours,
          attendanceData
        );

        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(clockInTime && clockOutTime);
          const paidH = hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS;
          breakdown.legalHoliday.hours += paidH;
          // Policy: eligible Sunday+Regular always uses 2.6x, even for credited hours.
          breakdown.legalHoliday.amount += paidH * ratePerHour * 2.6;
        }

        // Add allowance ONLY if they actually worked (clockInTime exists)
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

        // Move OT based on employee type
        const lhOnRDOTHours =
          typeof overtimeHours === "string"
            ? parseFloat(overtimeHours)
            : overtimeHours || 0;
        if (lhOnRDOTHours > 0) {
          earningsOT.lhOnRDOT.hours += lhOnRDOTHours;
          earningsOT.lhOnRDOT.amount += calculateSundayRegularHolidayOT(
            lhOnRDOTHours,
            ratePerHour
          );
        }

        if (nightDiffHours > 0) {
          earningsOT.legalHolidayND.hours += nightDiffHours;
          earningsOT.legalHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Regular Nightdiff OT (regular day with OT and night diff)
      // Removed: "Regular Night Differential OT" line item.
      // ND is already fully represented under the single "Night Differential" line above.
    });

    // "Days Work" / BH display: weekly cutoff base from calculateBasePay, plus eligible holiday/rest-day BH from attendance when applicable.

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
      // Days Work can exceed scheduled window if employee works on rest days.
      // Office-based: Sunday is rest day (dayType === "sunday")
      // Account Supervisors: Rest days are Mon/Tue/Wed (from restDays map)
      const isRestDay = dayType === "sunday" ||
        (restDays && restDays.get(day.date) === true);
      if (isRestDay) {
        // If rest day was worked (has regularHours > 0), count it toward Days Work
        // If rest day was NOT worked (regularHours === 0), exclude it (paid separately as rest day pay for rank/file)
        if (regularHours > 0) {
          // Rest day was worked — count toward Days Work (no fixed cap vs. scheduled window).
          return sum + regularHours;
        } else {
          // Rest day was NOT worked - exclude from Days Work (paid separately)
          return sum;
        }
      }

      // Regular work days with hours (per attendance BH).
      if (dayType === "regular" && regularHours > 0) {
        return sum + regularHours;
      }

      // Count eligible holidays (legal and special) in Days Work
      // Days Work includes all days: regular, legal holidays, and special non-working holidays
      // When worked substantively: use actual regularHours; when eligible but absent/de minimis: credit hours
      if (
        dayType === "regular-holiday" || dayType === "non-working-holiday"
      ) {
        const eligibleForHolidayPay = isEligibleForHolidayPay(
          day.date,
          regularHours,
          attendanceData
        );
        if (eligibleForHolidayPay) {
          const hasCompleteLog = Boolean(day.clockInTime && day.clockOutTime);
          return sum + (hasCompleteLog ? regularHours : HOLIDAY_UNWORKED_CREDIT_HOURS);
        }
      }

      return sum;
    }, 0);

    // Hours Worked / "Hours Work (Regular)" = actual credited regular hours from attendance (sum of dayType regular).
    // Scheduled slot×8 from calculateBasePay is kept as basePayHours for absence messaging only.
    const hoursWorked =
      periodStart && periodEnd ? regularHoursWorked : basePayHours;

    const totalBHForHoursWork = actualTotalBH;

    // Ensure basicSalary = regular hours worked × hourly rate
    // IMPORTANT: Use rounded hourly rate to match displayed value
    const roundedRatePerHour = Math.round(ratePerHour * 100) / 100;
    const expectedBasicSalary = hoursWorked * roundedRatePerHour;
    // Use the calculated basicSalary if it's close to expected, otherwise use expected
    if (Math.abs(basicSalary - expectedBasicSalary) > 0.01) {
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
          hoursWorked,
          totalRegularHours,
          employeeName: employee.full_name,
        });
      }
    }

    // Gross = basic + statutory OT/ND (earningsOT + breakdown) + holiday/rest rows + optional fixed work allowances (Other Pay)
    const totalGrossPayUnrounded =
      basicSalary +
      breakdown.nightDifferential.amount +
      breakdown.restDay.amount +
      breakdown.restDayNightDiff.amount +
      earningsOT.regularOvertime.amount +
      earningsOT.legalHolidayOT.amount +
      earningsOT.legalHolidayND.amount +
      earningsOT.shOT.amount +
      earningsOT.shNightDiff.amount +
      earningsOT.shOnRDOT.amount +
      earningsOT.lhOnRDOT.amount +
      earningsOT.restDayOT.amount +
      earningsOT.regularNightdiffOT.amount +
      breakdown.legalHoliday.amount +
      breakdown.specialHoliday.amount +
      otherPay.legalHolidayAllowance.amount +
      otherPay.specialHolidayAllowance.amount +
      otherPay.restDayAllowance.amount +
      otherPay.specialHolidayOnRestDayAllowance.amount +
      otherPay.legalHolidayOnRestDayAllowance.amount;

    // Round all breakdown amounts to 2 decimals before summing
    const roundTo2Decimals = (val: number) => Math.round(val * 100) / 100;
    const roundedBreakdown = {
      nightDifferential: roundTo2Decimals(breakdown.nightDifferential.amount),
      restDay: roundTo2Decimals(breakdown.restDay.amount),
      restDayNightDiff: roundTo2Decimals(breakdown.restDayNightDiff.amount),
      legalHoliday: roundTo2Decimals(breakdown.legalHoliday.amount),
      specialHoliday: roundTo2Decimals(breakdown.specialHoliday.amount),
    };

    const roundedAllowances = {
      legalHolidayAllowance: roundTo2Decimals(otherPay.legalHolidayAllowance.amount),
      specialHolidayAllowance: roundTo2Decimals(otherPay.specialHolidayAllowance.amount),
      restDayAllowance: roundTo2Decimals(otherPay.restDayAllowance.amount),
      specialHolidayOnRestDayAllowance: roundTo2Decimals(
        otherPay.specialHolidayOnRestDayAllowance.amount
      ),
      legalHolidayOnRestDayAllowance: roundTo2Decimals(
        otherPay.legalHolidayOnRestDayAllowance.amount
      ),
    };

    const roundedEarningsOT = {
      regularOvertime: roundTo2Decimals(earningsOT.regularOvertime.amount),
      legalHolidayOT: roundTo2Decimals(earningsOT.legalHolidayOT.amount),
      legalHolidayND: roundTo2Decimals(earningsOT.legalHolidayND.amount),
      shOT: roundTo2Decimals(earningsOT.shOT.amount),
      shNightDiff: roundTo2Decimals(earningsOT.shNightDiff.amount),
      shOnRDOT: roundTo2Decimals(earningsOT.shOnRDOT.amount),
      lhOnRDOT: roundTo2Decimals(earningsOT.lhOnRDOT.amount),
      restDayOT: roundTo2Decimals(earningsOT.restDayOT.amount),
      regularNightdiffOT: roundTo2Decimals(earningsOT.regularNightdiffOT.amount),
    };

    const totalGrossPayUnroundedRounded =
      basicSalary +
      roundedBreakdown.nightDifferential +
      roundedBreakdown.restDay +
      roundedBreakdown.restDayNightDiff +
      roundedEarningsOT.regularOvertime +
      roundedEarningsOT.legalHolidayOT +
      roundedEarningsOT.legalHolidayND +
      roundedEarningsOT.shOT +
      roundedEarningsOT.shNightDiff +
      roundedEarningsOT.shOnRDOT +
      roundedEarningsOT.lhOnRDOT +
      roundedEarningsOT.restDayOT +
      roundedEarningsOT.regularNightdiffOT +
      roundedBreakdown.legalHoliday +
      roundedBreakdown.specialHoliday +
      roundedAllowances.legalHolidayAllowance +
      roundedAllowances.specialHolidayAllowance +
      roundedAllowances.restDayAllowance +
      roundedAllowances.specialHolidayOnRestDayAllowance +
      roundedAllowances.legalHolidayOnRestDayAllowance;
    const totalGrossPay = Math.round(totalGrossPayUnroundedRounded * 100) / 100;

    const otherPayAllowancesTotal = Math.round(
      (roundedAllowances.legalHolidayAllowance +
        roundedAllowances.specialHolidayAllowance +
        roundedAllowances.restDayAllowance +
        roundedAllowances.specialHolidayOnRestDayAllowance +
        roundedAllowances.legalHolidayOnRestDayAllowance) *
        100
    ) / 100;

    /** Basic + all amounts in the earnings table (excludes "Other Pay" allowances section below). */
    const earningsTableTotalExcludingAllowances = Math.round(
      (totalGrossPay - otherPayAllowancesTotal) * 100
    ) / 100;

    const premiumPaySubtotalExcludingBasic = Math.round(
      (earningsTableTotalExcludingAllowances - basicSalary) * 100
    ) / 100;

    return {
      totalHours,
      hoursWorked,
      basicSalary,
      totalRegularHours,
      breakdown,
      earningsOT,
      otherPay,
      basePayHours,
      absences,
      useBasePayMethod,
      totalGrossPay,
      otherPayAllowancesTotal,
      earningsTableTotalExcludingAllowances,
      premiumPaySubtotalExcludingBasic,
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
    hoursWorked,
    basicSalary,
    totalRegularHours,
    breakdown,
    earningsOT,
    otherPay,
    totalGrossPay,
    otherPayAllowancesTotal,
    earningsTableTotalExcludingAllowances,
    premiumPaySubtotalExcludingBasic,
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

  useEffect(() => {
    if (!onPrintSync || totalGrossPay === undefined || totalGrossPay < 0) return;
    onPrintSync(
      buildPayslipPrintSyncFromDetailedBreakdown({
        hoursWorked,
        basicSalary,
        totalGrossPay,
        breakdown,
        earningsOT,
        otherPay,
        useFixedAllowances: isClientBased || isEligibleForAllowances,
      })
    );
  }, [
    onPrintSync,
    hoursWorked,
    basicSalary,
    totalGrossPay,
    breakdown,
    earningsOT,
    otherPay,
    isClientBased,
    isEligibleForAllowances,
  ]);

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
                    Hours Worked
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
                    {hoursWorked.toFixed(2)}
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

      {/* Overtimes/Holiday Earning(s) Section — regular row uses weekly cutoff base hours; premiums below */}
      <div className="mt-3">
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-sm font-semibold text-gray-800">
            Overtimes/Holiday Earning(s)
          </h4>
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
                      {/* 1. Hours Work (Regular) = actual BH from Time Attendance for this cutoff. */}
                      {renderEarningRow(
                        "1. Hours Work (Regular)",
                      hoursWorked,
                        "—",
                        basicSalary
                      )}

                      {/* Night Differential */}
                      {renderEarningRow(
                        "2. Night Differential",
                        breakdown.nightDifferential.hours,
                        PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                        breakdown.nightDifferential.amount,
                        true
                      )}

                      {/* Regular Holiday (PH term) */}
                      {renderEarningRow(
                        "3. Regular Holiday",
                        breakdown.legalHoliday.hours,
                        PAYROLL_MULTIPLIERS.REGULAR_HOLIDAY,
                        breakdown.legalHoliday.amount,
                        true
                      )}

                      {/* Special Holiday */}
                      {renderEarningRow(
                        "4. Special Holiday",
                        breakdown.specialHoliday.hours,
                        PAYROLL_MULTIPLIERS.SPECIAL_HOLIDAY,
                        breakdown.specialHoliday.amount,
                        true
                      )}

                      {/* Rest Day */}
                      {renderEarningRow(
                        "5. Rest Day",
                        breakdown.restDay.hours,
                        PAYROLL_MULTIPLIERS.REST_DAY,
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

                      {/* Statutory overtime (Labor Code rates in payroll-calculator) */}
                      {renderEarningRow(
                        "8. Regular Overtime",
                        earningsOT.regularOvertime.hours,
                        PAYROLL_MULTIPLIERS.REGULAR_OT,
                        earningsOT.regularOvertime.amount,
                        true
                      )}
                      {renderEarningRow(
                        "9. Regular Holiday OT",
                        earningsOT.legalHolidayOT.hours,
                        PAYROLL_MULTIPLIERS.REGULAR_HOLIDAY *
                          PAYROLL_MULTIPLIERS.OT_PREMIUM,
                        earningsOT.legalHolidayOT.amount,
                        true
                      )}
                      {renderEarningRow(
                        "11. Special Holiday OT",
                        earningsOT.shOT.hours,
                        PAYROLL_MULTIPLIERS.SPECIAL_HOLIDAY *
                          PAYROLL_MULTIPLIERS.OT_PREMIUM,
                        earningsOT.shOT.amount,
                        true
                      )}
                      {renderEarningRow(
                        "13. Special Holiday on Rest Day OT",
                        earningsOT.shOnRDOT.hours,
                        PAYROLL_MULTIPLIERS.SUNDAY_SPECIAL_HOLIDAY *
                          PAYROLL_MULTIPLIERS.OT_PREMIUM,
                        earningsOT.shOnRDOT.amount,
                        true
                      )}
                      {renderEarningRow(
                        "14. Regular Holiday on Rest Day OT",
                        earningsOT.lhOnRDOT.hours,
                        PAYROLL_MULTIPLIERS.SUNDAY_REGULAR_HOLIDAY *
                          PAYROLL_MULTIPLIERS.OT_PREMIUM,
                        earningsOT.lhOnRDOT.amount,
                        true
                      )}
                      {renderEarningRow(
                        "15. Rest Day OT",
                        earningsOT.restDayOT.hours,
                        PAYROLL_MULTIPLIERS.REST_DAY *
                          PAYROLL_MULTIPLIERS.OT_PREMIUM,
                        earningsOT.restDayOT.amount,
                        true
                      )}

                      {/* ND from OT (10PM–6AM overlap) — all employees */}
                      {renderEarningRow(
                        "10. Regular Holiday ND",
                        earningsOT.legalHolidayND.hours,
                        PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                        earningsOT.legalHolidayND.amount,
                        true
                      )}
                      {renderEarningRow(
                        "12. Special Holiday ND",
                        earningsOT.shNightDiff.hours,
                        PAYROLL_MULTIPLIERS.NIGHT_DIFF,
                        earningsOT.shNightDiff.amount,
                        true
                      )}
                      {/* Removed: Regular Night Differential OT (ND is row 2) */}
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>

          {/* Summary: old "Total Earnings" omitted basic row 1 — show premium subtotal + table total vs gross */}
          <div className="bg-gray-50 border-t border-gray-200 px-2 py-1.5 space-y-1">
            <div className="flex justify-between items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-gray-700 min-w-0 shrink">
                Premium subtotal (OT, holidays, ND — excl. row 1):
              </span>
              <span className="text-xs font-semibold text-gray-900 shrink-0 tabular-nums text-right">
                {formatCurrency(
                  Number.isFinite(premiumPaySubtotalExcludingBasic)
                    ? premiumPaySubtotalExcludingBasic
                    : 0
                )}
              </span>
            </div>
            <div className="flex justify-between items-center gap-2 min-w-0">
              <span className="text-xs font-medium text-gray-700 min-w-0 shrink">
                Total (basic + table above
                {otherPayAllowancesTotal >= 0.01
                  ? ", excl. Other Pay below"
                  : ""}
                ):
              </span>
              <span className="text-sm font-bold text-primary-700 shrink-0 tabular-nums text-right">
                {formatCurrency(
                  Number.isFinite(earningsTableTotalExcludingAllowances)
                    ? earningsTableTotalExcludingAllowances
                    : 0
                )}
              </span>
            </div>
            {otherPayAllowancesTotal >= 0.01 && (
              <div className="flex justify-between items-center gap-2 min-w-0 border-t border-gray-200 pt-1">
                <span className="text-xs font-medium text-gray-700 min-w-0 shrink">
                  Other pay (allowances below):
                </span>
                <span className="text-xs font-semibold text-gray-900 shrink-0 tabular-nums text-right">
                  {formatCurrency(
                    Number.isFinite(otherPayAllowancesTotal)
                      ? otherPayAllowancesTotal
                      : 0
                  )}
                </span>
              </div>
            )}
            {otherPayAllowancesTotal >= 0.01 && (
              <div className="flex justify-between items-center gap-2 min-w-0">
                <span className="text-xs font-semibold text-gray-800 shrink">Gross pay:</span>
                <span className="text-sm font-bold text-primary-700 shrink-0 tabular-nums text-right">
                  {formatCurrency(
                    Number.isFinite(totalGrossPay) ? totalGrossPay : 0
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Other Pay: fixed work allowances on holidays/rest days (policy); OT/ND are in main earnings */}
      {(() => {
        const hasAllowances =
          otherPay.legalHolidayAllowance.amount > 0 ||
          otherPay.specialHolidayAllowance.amount > 0 ||
          otherPay.restDayAllowance.amount > 0 ||
          otherPay.specialHolidayOnRestDayAllowance.amount > 0 ||
          otherPay.legalHolidayOnRestDayAllowance.amount > 0;

        if (process.env.NODE_ENV === "development") {
          console.log("Other Pay Debug:", {
            isClientBased,
            isEligibleForAllowances,
            isAccountSupervisor,
            hasAllowances,
          });
        }

        return (isClientBased || isEligibleForAllowances) && hasAllowances;
      })() && (
        <div className="mt-3">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="text-sm font-semibold text-gray-800">Other Pay</h4>
            <span className="text-xs text-gray-500 italic">
              (Holiday / rest day work allowances)
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
                        {/* Fixed allowances for regular hours on holidays/rest days */}
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