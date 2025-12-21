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
    deployed?: boolean | null; // true = deployed employee (regular), false/null = office-based
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
    sssContribution: number;
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
    netPay,
    workingDays,
    preparedBy,
  } = props;

  // Calculate detailed earnings breakdown from attendance data
  const ratePerHour = employee.rate_per_hour || 0;
  const ratePerDay = employee.rate_per_day || 0;

  // Account Supervisors have flexi time, so they should not have night differential
  const isAccountSupervisor =
    employee.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
  // Office-based employees are NOT deployed
  const isOfficeBased =
    !isAccountSupervisor && (employee.deployed === false || employee.deployed === null);
  const useFixedAllowances = isAccountSupervisor || isOfficeBased;

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
    legalHolidayOT: { amount: 0 },
    legalHolidayND: { amount: 0 },
    specialHolidayOT: { amount: 0 },
    specialHolidayND: { amount: 0 },
    restDayOT: { amount: 0 },
    restDayND: { amount: 0 },
    specialHolidayOnRestDayOT: { amount: 0 },
    legalHolidayOnRestDayOT: { amount: 0 },
    regularNightdiffOT: { amount: 0 },
  };

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
   * Calculate holiday/rest day allowance for AS and Office Based (for regular hours)
   * Uses same fixed amounts: 350 = 4 hours, 700 = 8 hours
   * NO PRO-RATING - must meet exact hour requirements
   */
  function calculateHolidayRestDayAllowance(hours: number): number {
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
    return 0;
  }

  /**
   * Calculate holiday/rest day OT allowance for AS and Office Based
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
    return 0;
  }

  let totalSalary = 0;
  let totalGrossPay = 0;

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
    }>;

    attendanceData.forEach((day) => {
      const {
        dayType = "regular",
        regularHours,
        overtimeHours,
        nightDiffHours,
      } = day;

      // Basic salary (regular working days)
      // IMPORTANT: Rest days (sunday) should NOT be included in basic salary since they're paid separately with premium
      // Count days with regularHours >= 8 as working days, but exclude rest days
      if (dayType === "regular" && regularHours >= 8) {
        // Only count regular days (not rest days) as basic earning
        // Leave days with regularHours >= 8 should have dayType === "regular" to be counted
        earningsBreakdown.basic.days++;
        const dayAmount = regularHours * ratePerHour;
        earningsBreakdown.basic.amount += dayAmount;
        totalSalary += dayAmount;
      } else if (dayType === "regular" && regularHours > 0) {
        // Partial days (< 8 hours) on regular days still count towards basic salary
        // Rest days are excluded (they have dayType === "sunday", not "regular")
        earningsBreakdown.basic.days++;
        const dayAmount = regularHours * ratePerHour;
        earningsBreakdown.basic.amount += dayAmount;
        totalSalary += dayAmount;
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

      // Night Differential (regular days only) - Account Supervisors have flexi time, so no night diff
      // Holidays and rest days have their own separate night differential calculations
      if (dayType === "regular" && nightDiffHours > 0 && !isAccountSupervisor) {
        earningsBreakdown.nightDiff.hours += nightDiffHours;
        earningsBreakdown.nightDiff.amount += calculateNightDiff(
          nightDiffHours,
          ratePerHour
        );
      }

      // NDOT (Night Diff OT on regular days) - Account Supervisors and Office-based don't use this
      if (
        dayType === "regular" &&
        overtimeHours > 0 &&
        nightDiffHours > 0 &&
        !useFixedAllowances
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
        if (regularHours > 0) {
          // Standard multiplier calculation (applies to all employees)
          const standardAmount = calculateRegularHoliday(
            regularHours,
            ratePerHour
          );
          earningsBreakdown.legalHoliday.days++;
          earningsBreakdown.legalHoliday.amount += standardAmount;

          // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
          // They only appear in Other Pay section as OT replacements
        }
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
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.legalHDND.hours += nightDiffHours;
          earningsBreakdown.legalHDND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Special Holiday
      if (dayType === "non-working-holiday") {
        if (regularHours > 0) {
          // Standard multiplier calculation (applies to all employees)
          const standardAmount = calculateNonWorkingHoliday(
            regularHours,
            ratePerHour
          );
          earningsBreakdown.spHoliday.days++;
          earningsBreakdown.spHoliday.amount += standardAmount;

          // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
          // They only appear in Other Pay section as OT replacements
        }
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
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.SHND.hours += nightDiffHours;
          earningsBreakdown.SHND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Rest Day (Sunday)
      if (dayType === "sunday") {
        if (regularHours > 0) {
          // Standard multiplier calculation (applies to all employees)
          const standardAmount = calculateSundayRestDay(
            regularHours,
            ratePerHour
          );
          earningsBreakdown.restDay.days++;
          earningsBreakdown.restDay.amount += standardAmount;

          // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
          // They only appear in Other Pay section as OT replacements
        }
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
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: ND goes to Other Pay
            fixedAllowances.restDayND.amount += calculateNightDiff(
              nightDiffHours,
              ratePerHour
            );
          } else {
            // Regular employees: ND goes to earnings breakdown table
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
          // Standard multiplier calculation (applies to all employees)
          const standardAmount = calculateSundaySpecialHoliday(
            regularHours,
            ratePerHour
          );
          earningsBreakdown.spHoliday.days++;
          earningsBreakdown.spHoliday.amount += standardAmount;

          // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
          // They only appear in Other Pay section as OT replacements
        }
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.specialHolidayOnRestDayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.SHonRDOT.hours += overtimeHours;
            earningsBreakdown.SHonRDOT.amount += calculateSundaySpecialHolidayOT(
              overtimeHours,
              ratePerHour
            );
          }
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.SHND.hours += nightDiffHours;
          earningsBreakdown.SHND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }

      // Sunday + Regular Holiday
      if (dayType === "sunday-regular-holiday") {
        if (regularHours > 0) {
          // Standard multiplier calculation (applies to all employees)
          const standardAmount = calculateSundayRegularHoliday(
            regularHours,
            ratePerHour
          );
          earningsBreakdown.legalHoliday.days++;
          earningsBreakdown.legalHoliday.amount += standardAmount;

          // Note: Fixed allowances for Account Supervisors and Office-based are NOT added here
          // They only appear in Other Pay section as OT replacements
        }
        if (overtimeHours > 0) {
          if (useFixedAllowances) {
            // For Account Supervisors and Office-based: use fixed allowance
            const allowance = calculateHolidayRestDayOTAllowance(overtimeHours);
            fixedAllowances.legalHolidayOnRestDayOT.amount += allowance;
          } else {
            // Regular employees: standard calculation
            earningsBreakdown.LHonRDOT.hours += overtimeHours;
            earningsBreakdown.LHonRDOT.amount += calculateSundayRegularHolidayOT(
              overtimeHours,
              ratePerHour
            );
          }
        }
        if (nightDiffHours > 0 && !isAccountSupervisor) {
          earningsBreakdown.legalHDND.hours += nightDiffHours;
          earningsBreakdown.legalHDND.amount += calculateNightDiff(
            nightDiffHours,
            ratePerHour
          );
        }
      }
    });

    // Calculate total gross pay (sum of all earnings)
    totalGrossPay = Object.values(earningsBreakdown).reduce((sum, item) => {
      if (typeof item === "object" && "amount" in item) {
        return sum + (item.amount || 0);
      }
      return sum;
    }, 0);

    // Add fixed allowances for Account Supervisors and Office-based employees
    if (useFixedAllowances) {
      const totalFixedAllowances = Object.values(fixedAllowances).reduce(
        (sum, item) => sum + (item.amount || 0),
        0
      );
      totalGrossPay += totalFixedAllowances;
    }

    // Total Salary should equal Basic amount (as shown in sample)
    totalSalary = earningsBreakdown.basic.amount;
  } else {
    // Fallback to provided earnings
    totalSalary = props.earnings.regularPay;
    totalGrossPay = props.earnings.grossIncome || props.earnings.regularPay;
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

  // Ensure Total Salary equals Basic amount (for display consistency with sample)
  if (totalSalary === 0 && earningsBreakdown.basic.amount > 0) {
    totalSalary = earningsBreakdown.basic.amount;
  }

  // Total Gross Pay = Total Salary - Tardiness (as shown in sample)
  // If we have calculated earnings, use that; otherwise use Total Salary
  if (totalGrossPay === 0) {
    totalGrossPay = totalSalary - tardiness;
  } else {
    // If we have calculated totalGrossPay from all earnings, use that
    // But ensure it's at least Total Salary
    totalGrossPay = Math.max(totalGrossPay, totalSalary - tardiness);
  }

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
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  Working Dayoff
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {earningsBreakdown.workingDayoff.days > 0
                    ? earningsBreakdown.workingDayoff.days.toFixed(2)
                    : "-"}
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  {formatCurrencyOrDash(earningsBreakdown.workingDayoff.amount)}
                </td>
              </tr>
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
                  (OT & ND Allowances - {isAccountSupervisor ? "Account Supervisor" : "Office-based"})
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
                          {formatCurrencyOrDash(fixedAllowances.regularOT.amount)}
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
                          {formatCurrencyOrDash(fixedAllowances.restDayOT.amount)}
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
                    {/* Total Other Pay */}
                    {Object.values(fixedAllowances).some(
                      (item) => item && typeof item === "object" && "amount" in item && item.amount > 0
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
                              (sum, item) => sum + (item && typeof item === "object" && "amount" in item ? item.amount : 0),
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
                  SSS
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
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    fontWeight: "bold",
                  }}
                >
                  SSS Providen
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "3px 5px",
                    textAlign: "right",
                  }}
                >
                  -
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
                  {formatCurrencyOrDash(deductions.withholdingTax || 0)}
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
              {!deductions.monthlyLoans && (deductions.monthlyLoan || 0) > 0 && (
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
                {formatCurrency(netPay)}
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
