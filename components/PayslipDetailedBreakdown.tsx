"use client";

import { memo, useMemo } from "react";
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

interface PayslipDetailedBreakdownProps {
  employee: {
    employee_id: string;
    full_name: string;
    rate_per_day: number;
    rate_per_hour: number;
    position?: string | null;
    assigned_hotel?: string | null;
    deployed?: boolean | null; // true = deployed employee (regular), false/null = office-based
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
}

function PayslipDetailedBreakdownComponent({
  employee,
  attendanceData,
}: PayslipDetailedBreakdownProps) {
  const ratePerHour = employee.rate_per_hour;
  const ratePerDay = employee.rate_per_day;

  // Identify employee type
  const isAccountSupervisor =
    employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
  // Office-based employees are NOT deployed
  // Regular employees (deployed) can have assigned_hotel (hotel industry) or not (non-hotel industry)
  // Account Supervisors can also have assigned_hotel but are identified by position
  const isOfficeBased =
    !isAccountSupervisor && (employee.deployed === false || employee.deployed === null);

  /**
   * Calculate OT allowance for Account Supervisors and Office-based employees
   * Account Supervisors: 3-4 hours = 500 (fixed per day, no succeeding hours)
   * Office-based: 2 hours = 200, succeeding = 100 per hour
   */
  function calculateOTAllowance(hours: number): number {
    if (isAccountSupervisor) {
      // Fixed ₱500 per day if they work 3-4 hours OT, regardless of how many hours over 4
      if (hours >= 3 && hours <= 4) {
        return 500;
      }
      // If more than 4 hours, still ₱500 (fixed amount)
      if (hours > 4) {
        return 500;
      }
      // Less than 3 hours = no OT allowance
      return 0;
    } else if (isOfficeBased) {
      // Office-based: 2 hours = 200, succeeding = 100 per hour
      if (hours >= 2) {
        return 200 + (hours - 2) * 100;
      }
      return 0;
    }
    // Regular employees use standard calculation
    return calculateRegularOT(hours, ratePerHour);
  }

  /**
   * Calculate holiday/rest day allowance for AS and Office Based
   * Sunday, Rest Day, Special Holiday, Legal Holiday: 350 = 4 hours, 700 = 8 hours
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

    if ((isAccountSupervisor || isOfficeBased) && isEligibleDay) {
      if (hours >= 8) {
        return 700;
      } else if (hours >= 4) {
        return 350;
      }
      // No pro-rating - must meet 4 or 8 hour requirement
      return 0;
    }
    // Regular employees use standard calculation
    return 0; // Will be calculated separately
  }

  /**
   * Calculate OT allowance for holidays/rest days for AS and Office Based
   * Uses same fixed amounts: 350 = 4 hours, 700 = 8 hours
   * NO PRO-RATING - must meet exact hour requirements
   */
  function calculateHolidayRestDayOTAllowance(hours: number): number {
    if (isAccountSupervisor || isOfficeBased) {
      if (hours >= 8) {
        return 700;
      } else if (hours >= 4) {
        return 350;
      }
      // No pro-rating - must meet 4 or 8 hour requirement
      return 0;
    }
    // Regular employees use standard calculation
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
    let totalHours = 0; // Total hours including all day types (regular + rest days + holidays)
    let daysWorked = 0; // Total days worked (regular + rest days, excluding holidays)
    let basicSalary = 0; // Basic salary from regular days only
    let totalRegularHours = 0;

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
      legalHolidayOT: { hours: 0, amount: 0 },
      legalHolidayND: { hours: 0, amount: 0 },
      specialHolidayOT: { hours: 0, amount: 0 },
      specialHolidayND: { hours: 0, amount: 0 },
      restDayOT: { hours: 0, amount: 0 },
      specialHolidayOnRestDayOT: { hours: 0, amount: 0 },
      legalHolidayOnRestDayOT: { hours: 0, amount: 0 },
      regularNightdiffOT: { hours: 0, amount: 0 },
    };

    attendanceData.forEach((day) => {
    const {
      dayType,
      regularHours: dayRegularHours,
      overtimeHours,
      nightDiffHours: dayNightDiffHours,
      clockInTime,
      clockOutTime,
      date,
    } = day;

    // Calculate hours from clock times if available, otherwise use provided values
    let regularHours = dayRegularHours;
    let nightDiffHours = dayNightDiffHours;

    // IMPORTANT: If regularHours is already 8 (e.g., for leave days), don't recalculate from clock times
    // This ensures leave days with BH = 8 are counted correctly even if they have clock times
    const isLeaveDayWithFullHours = (dayRegularHours || 0) >= 8;

    if (clockInTime && clockOutTime && !isLeaveDayWithFullHours) {
      // Only recalculate regular hours from clock times if needed
      // IMPORTANT: Night differential should come from approved OT requests only, NOT from clock times
      // The nightDiffHours from attendance_data already comes from approved OT requests (via timesheet generator)
      const calculated = calculateHoursFromClockTimes(
        clockInTime,
        clockOutTime,
        date
      );
      regularHours = calculated.regularHours;
      // DO NOT override nightDiffHours - it should come from approved OT requests only
      // nightDiffHours remains as dayNightDiffHours (from approved OT requests)
      totalHours += calculated.totalHours;
    } else {
      totalHours += regularHours + overtimeHours;
    }

    // Count days worked and calculate basic salary
    // Days with regularHours >= 8 count as 1 working day (matches timesheet logic where BH = 8 = 1 day)
    // IMPORTANT:
    // - "Days Work" = ALL days worked (regular + rest days, excluding holidays)
    // - Basic Salary = ONLY regular days (rest days and holidays paid separately)
    // - Rest days count in "Days Work" but are paid with premium separately

    // Count all days with 8+ hours as working days (including rest days, excluding holidays)
    if (regularHours >= 8) {
      // Count rest days and regular days as "Days Work" (but not holidays)
      if (
        dayType === "regular" ||
        dayType === "sunday" ||
        dayType === "sunday-special-holiday" ||
        dayType === "sunday-regular-holiday"
      ) {
        daysWorked++;
      }

      totalRegularHours += regularHours;

      // Only add to basic salary if it's a regular day
      // Rest days and holidays are paid separately with premium
      if (dayType === "regular") {
        // Basic salary = regular hours × hourly rate
        // This represents the base pay for regular working hours (8AM-5PM)
        basicSalary += regularHours * ratePerHour;
      }
    } else if (regularHours > 0 && dayType === "regular") {
      // Partial days (< 8 hours) on regular days still count towards total hours and basic salary
      // but don't count as a full working day
      totalRegularHours += regularHours;
      basicSalary += regularHours * ratePerHour;
    }

    // Regular Overtime - Move to allowances or Other Pay based on employee type
    if (dayType === "regular" && overtimeHours > 0) {
      if (isAccountSupervisor || isOfficeBased) {
        // Fixed amounts - goes to Other Pay
        const allowance = calculateOTAllowance(overtimeHours);
        if (allowance > 0) {
          otherPay.regularOT.hours += overtimeHours;
          otherPay.regularOT.amount += allowance;
        }
        } else {
          // Regular employees - goes to earnings breakdown table
          earningsOT.regularOvertime.hours += overtimeHours;
          earningsOT.regularOvertime.amount += calculateOTAllowance(overtimeHours);
        }
    }

    // Night Differential (regular days only - holidays and rest days have separate ND calculations)
    // Account Supervisors have flexi time, so they should not have night differential
    // Only count night differential for regular days
    // Holidays and rest days have their own separate night differential calculations
    if (dayType === "regular" && nightDiffHours > 0 && !isAccountSupervisor) {
      breakdown.nightDifferential.hours += nightDiffHours;
      breakdown.nightDifferential.amount += calculateNightDiff(
        nightDiffHours,
        ratePerHour
      );
    }

    // Legal Holiday (regular-holiday)
    if (dayType === "regular-holiday") {
      // Standard multiplier calculation (applies to all employees)
      const standardAmount = calculateRegularHoliday(
        regularHours,
        ratePerHour
      );
      breakdown.legalHoliday.hours += regularHours;
      breakdown.legalHoliday.amount += standardAmount;

      // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
      // They only appear in Other Pay section as OT replacements

      // Move OT and ND to allowances or Other Pay based on employee type
      if (overtimeHours > 0) {
        if (isAccountSupervisor || isOfficeBased) {
          // Fixed amounts - goes to Other Pay
          const legalHolidayOTAllowance = calculateHolidayRestDayOTAllowance(overtimeHours);
          if (legalHolidayOTAllowance > 0) {
            otherPay.legalHolidayOT.hours += overtimeHours;
            otherPay.legalHolidayOT.amount += legalHolidayOTAllowance;
          }
        } else {
          // Regular employees use standard calculation - goes to earnings breakdown table
          earningsOT.legalHolidayOT.hours += overtimeHours;
          earningsOT.legalHolidayOT.amount += calculateRegularHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        if (isOfficeBased) {
          // For Office-based, ND goes to Other Pay section
          otherPay.legalHolidayND.hours += nightDiffHours;
          otherPay.legalHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        } else {
          // Regular employees - ND goes to earnings breakdown table
          earningsOT.legalHolidayND.hours += nightDiffHours;
          earningsOT.legalHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }
    }

    // Special Holiday (non-working-holiday)
    if (dayType === "non-working-holiday") {
      // Standard multiplier calculation (applies to all employees)
      const standardAmount = calculateNonWorkingHoliday(
        regularHours,
        ratePerHour
      );
      breakdown.specialHoliday.hours += regularHours;
      breakdown.specialHoliday.amount += standardAmount;

      // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
      // They only appear in Other Pay section as OT replacements

      // Move OT to Other Pay (not allowances) - Apply fixed amounts for AS/Office-based
      if (overtimeHours > 0) {
        if (isAccountSupervisor || isOfficeBased) {
          // Fixed amounts only - goes to Other Pay
          const specialHolidayOTAllowance = calculateHolidayRestDayOTAllowance(overtimeHours);
          if (specialHolidayOTAllowance > 0) {
            otherPay.specialHolidayOT.hours += overtimeHours;
            otherPay.specialHolidayOT.amount += specialHolidayOTAllowance;
          }
        } else {
          // Regular employees use standard calculation - goes to earnings breakdown table
          earningsOT.shOT.hours += overtimeHours;
          earningsOT.shOT.amount += calculateNonWorkingHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        if (isOfficeBased) {
          // For Office-based, ND goes to Other Pay section
          otherPay.specialHolidayND.hours += nightDiffHours;
          otherPay.specialHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        } else {
          // Regular employees - ND goes to earnings breakdown table
          earningsOT.shNightDiff.hours += nightDiffHours;
          earningsOT.shNightDiff.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }
    }

    // Sunday/Rest Day
    if (dayType === "sunday") {
      // Standard multiplier calculation (applies to all employees)
      const standardAmount = calculateSundayRestDay(
        regularHours,
        ratePerHour
      );
      breakdown.restDay.hours += regularHours;
      breakdown.restDay.amount += standardAmount;

      // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
      // They only appear in Other Pay section as OT replacements

      // Move Rest Day OT based on employee type
      if (overtimeHours > 0) {
        if (isAccountSupervisor || isOfficeBased) {
          // Fixed amounts - goes to Other Pay
          const restDayOTAllowance = calculateHolidayRestDayOTAllowance(overtimeHours);
          if (restDayOTAllowance > 0) {
            otherPay.restDayOT.hours += overtimeHours;
            otherPay.restDayOT.amount += restDayOTAllowance;
          }
        } else {
          // Regular employees use standard calculation - goes to earnings breakdown table
          earningsOT.restDayOT.hours += overtimeHours;
          earningsOT.restDayOT.amount += calculateSundayRestDayOT(
            overtimeHours,
            ratePerHour
          );
        }
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        breakdown.restDayNightDiff.hours += nightDiffHours;
        breakdown.restDayNightDiff.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }
    }

    // Sunday + Special Holiday
    if (dayType === "sunday-special-holiday") {
      // Standard multiplier calculation (applies to all employees)
      const standardAmount = calculateSundaySpecialHoliday(
        regularHours,
        ratePerHour
      );
      breakdown.specialHoliday.hours += regularHours;
      breakdown.specialHoliday.amount += standardAmount;

      // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
      // They only appear in Other Pay section as OT replacements

      // Move OT to allowances or Other Pay based on employee type
      if (overtimeHours > 0) {
        if (isAccountSupervisor || isOfficeBased) {
          // Fixed amounts - goes to Other Pay
          const shOnRDOTAllowance = calculateHolidayRestDayOTAllowance(overtimeHours);
          if (shOnRDOTAllowance > 0) {
            otherPay.specialHolidayOnRestDayOT.hours += overtimeHours;
            otherPay.specialHolidayOnRestDayOT.amount += shOnRDOTAllowance;
          }
        } else {
          // Regular employees use standard calculation - goes to earnings breakdown table
          earningsOT.shOnRDOT.hours += overtimeHours;
          earningsOT.shOnRDOT.amount += calculateSundaySpecialHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        if (isOfficeBased) {
          // For Office-based, ND goes to Other Pay section
          otherPay.specialHolidayND.hours += nightDiffHours;
          otherPay.specialHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        } else {
          // Regular employees - ND goes to earnings breakdown table
          earningsOT.shNightDiff.hours += nightDiffHours;
          earningsOT.shNightDiff.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }
    }

    // Sunday + Regular Holiday
    if (dayType === "sunday-regular-holiday") {
      // Standard multiplier calculation (applies to all employees)
      const standardAmount = calculateSundayRegularHoliday(
        regularHours,
        ratePerHour
      );
      breakdown.legalHoliday.hours += regularHours;
      breakdown.legalHoliday.amount += standardAmount;

      // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
      // They only appear in Other Pay section as OT replacements

      // Move OT based on employee type
      if (overtimeHours > 0) {
        if (isAccountSupervisor || isOfficeBased) {
          // Fixed amounts - goes to Other Pay
          const lhOnRDOTAllowance = calculateHolidayRestDayOTAllowance(overtimeHours);
          if (lhOnRDOTAllowance > 0) {
            otherPay.legalHolidayOnRestDayOT.hours += overtimeHours;
            otherPay.legalHolidayOnRestDayOT.amount += lhOnRDOTAllowance;
          }
        } else {
          // Regular employees use standard calculation - goes to earnings breakdown table
          earningsOT.lhOnRDOT.hours += overtimeHours;
          earningsOT.lhOnRDOT.amount += calculateSundayRegularHolidayOT(
            overtimeHours,
            ratePerHour
          );
        }
      }

      if (nightDiffHours > 0 && !isAccountSupervisor) {
        if (isOfficeBased) {
          // For Office-based, ND goes to Other Pay section
          otherPay.legalHolidayND.hours += nightDiffHours;
          otherPay.legalHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        } else {
          // Regular employees - ND goes to earnings breakdown table
          earningsOT.legalHolidayND.hours += nightDiffHours;
          earningsOT.legalHolidayND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }
    }

    // Regular Nightdiff OT (regular day with OT and night diff)
    // Account Supervisors have flexi time, so no night diff
    if (
      dayType === "regular" &&
      overtimeHours > 0 &&
      nightDiffHours > 0 &&
      !isAccountSupervisor
    ) {
      if (isOfficeBased) {
        // For Office-based, NDOT goes to Other Pay
        otherPay.regularNightdiffOT.hours += Math.min(
          overtimeHours,
          nightDiffHours
        );
        otherPay.regularNightdiffOT.amount += calculateNightDiff(
          Math.min(overtimeHours, nightDiffHours),
          ratePerHour
        );
      } else {
        // Regular employees - NDOT goes to earnings breakdown table
        earningsOT.regularNightdiffOT.hours += Math.min(
          overtimeHours,
          nightDiffHours
        );
        earningsOT.regularNightdiffOT.amount += calculateNightDiff(
          Math.min(overtimeHours, nightDiffHours),
          ratePerHour
        );
      }
    }
    });

    return {
      totalHours,
      daysWorked,
      basicSalary,
      totalRegularHours,
      breakdown,
      earningsOT,
      otherPay,
    };
  }, [attendanceData, isAccountSupervisor, isOfficeBased, ratePerHour, ratePerDay]);

  const { totalHours, daysWorked, basicSalary, totalRegularHours, breakdown, earningsOT, otherPay } = calculationResult;
  const totalSalary = basicSalary;

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
                    Total Salary
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-2 py-1.5 text-xs font-medium text-gray-900">
                    {daysWorked}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-700">
                    {formatCurrency(ratePerDay)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-mono text-gray-700">
                    {ratePerHour.toFixed(3)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-semibold text-gray-900">
                    {formatCurrency(basicSalary)}
                  </td>
                  <td className="px-2 py-1.5 text-xs text-right font-bold text-primary-700">
                    {formatCurrency(
                      basicSalary +
                        breakdown.nightDifferential.amount +
                        breakdown.legalHoliday.amount +
                        breakdown.specialHoliday.amount +
                        breakdown.restDay.amount +
                        breakdown.restDayNightDiff.amount +
                        breakdown.workingDayoff.amount +
                        // Add OT and ND items based on employee type
                        (isAccountSupervisor || isOfficeBased
                          ? // Account Supervisors/Office-based: All OT and ND items in Other Pay
                            otherPay.regularOT.amount +
                            otherPay.legalHolidayOT.amount +
                            otherPay.legalHolidayND.amount +
                            otherPay.specialHolidayOT.amount +
                            otherPay.specialHolidayND.amount +
                            otherPay.restDayOT.amount +
                            otherPay.specialHolidayOnRestDayOT.amount +
                            otherPay.legalHolidayOnRestDayOT.amount +
                            otherPay.regularNightdiffOT.amount
                          : // Regular employees: OT and ND items in earnings breakdown table
                            earningsOT.regularOvertime.amount +
                            earningsOT.legalHolidayOT.amount +
                            earningsOT.legalHolidayND.amount +
                            earningsOT.shOT.amount +
                            earningsOT.shNightDiff.amount +
                            earningsOT.shOnRDOT.amount +
                            earningsOT.lhOnRDOT.amount +
                            earningsOT.restDayOT.amount +
                            earningsOT.regularNightdiffOT.amount)
                    )}
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
          {(isAccountSupervisor || isOfficeBased) && (
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
                              title={`Formula: ${hoursValue} hrs × ₱${ratePerHour.toFixed(2)}/hr × ${rateDisplay} = ${formatCurrency(amountValue)}`}
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

                      {/* Working Dayoff */}
                      {renderEarningRow(
                        "7. Working Day Off",
                        breakdown.workingDayoff.hours,
                        PAYROLL_MULTIPLIERS.REST_DAY,
                        breakdown.workingDayoff.amount,
                        true
                      )}

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
                    breakdown.legalHoliday.amount +
                    breakdown.specialHoliday.amount +
                    breakdown.restDay.amount +
                    breakdown.restDayNightDiff.amount +
                    breakdown.workingDayoff.amount +
                    // Add OT items for regular employees
                    (isAccountSupervisor || isOfficeBased
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
      {(isAccountSupervisor || isOfficeBased) &&
        (otherPay.regularOT.amount > 0 ||
          otherPay.legalHolidayOT.amount > 0 ||
          otherPay.legalHolidayND.amount > 0 ||
          otherPay.specialHolidayOT.amount > 0 ||
          otherPay.specialHolidayND.amount > 0 ||
          otherPay.restDayOT.amount > 0 ||
          otherPay.specialHolidayOnRestDayOT.amount > 0 ||
          otherPay.legalHolidayOnRestDayOT.amount > 0 ||
          otherPay.regularNightdiffOT.amount > 0) && (
          <div className="mt-3">
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold text-gray-800">
                Other Pay
              </h4>
              <span className="text-xs text-gray-500 italic">
                (OT & ND - {isAccountSupervisor ? "Account Supervisor" : "Office-based"})
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
                                  title={`Formula: ${hoursValue} hrs × ₱${ratePerHour.toFixed(2)}/hr × ${rateDisplay} = ${formatCurrency(amountValue)}`}
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
                          
                          {/* ND Allowances - Fixed amounts replacing ND calculations */}
                          {otherPay.legalHolidayND.amount > 0 &&
                            renderAllowanceRow(
                              "Legal Holiday ND Allowance",
                              otherPay.legalHolidayND.hours,
                              "Fixed Amount",
                              otherPay.legalHolidayND.amount,
                              false
                            )}
                          {otherPay.specialHolidayND.amount > 0 &&
                            renderAllowanceRow(
                              "Special Holiday ND Allowance",
                              otherPay.specialHolidayND.hours,
                              "Fixed Amount",
                              otherPay.specialHolidayND.amount,
                              false
                            )}
                          {otherPay.regularNightdiffOT.amount > 0 &&
                            renderAllowanceRow(
                              "Regular Night Differential OT Allowance",
                              otherPay.regularNightdiffOT.hours,
                              "Fixed Amount",
                              otherPay.regularNightdiffOT.amount,
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
                      otherPay.regularOT.amount +
                        otherPay.legalHolidayOT.amount +
                        otherPay.legalHolidayND.amount +
                        otherPay.specialHolidayOT.amount +
                        otherPay.specialHolidayND.amount +
                        otherPay.restDayOT.amount +
                        otherPay.specialHolidayOnRestDayOT.amount +
                        otherPay.legalHolidayOnRestDayOT.amount +
                        otherPay.regularNightdiffOT.amount
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
