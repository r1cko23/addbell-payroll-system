"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayslipPrint } from "@/components/PayslipPrint";
import { PayslipDetailedBreakdown } from "@/components/PayslipDetailedBreakdown";
import {
  H1,
  H2,
  H3,
  H4,
  BodySmall,
  Caption,
  Label,
} from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { format, addDays, getWeek } from "date-fns";
import { formatCurrency, generatePayslipNumber } from "@/utils/format";
import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateMonthlySalary,
  calculateWithholdingTax,
} from "@/utils/ph-deductions";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import { getWeekOfMonth } from "@/utils/holidays";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { useUserRole } from "@/lib/hooks/useUserRole";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  monthly_rate?: number | null;
  per_day?: number | null;
  position?: string | null;
  eligible_for_ot?: boolean | null;
  assigned_hotel?: string | null;
  deployed?: boolean | null; // true = deployed employee (regular), false/null = office-based
  // Computed fields for backward compatibility
  rate_per_day?: number; // Alias for per_day
  rate_per_hour?: number; // Computed from per_day / 8
}

interface WeeklyAttendance {
  id: string;
  period_start: string;
  period_end: string;
  attendance_data: any;
  gross_pay: number;
}

interface EmployeeDeductions {
  vale_amount: number;
  sss_salary_loan: number;
  sss_calamity_loan: number;
  pagibig_salary_loan: number;
  pagibig_calamity_loan: number;
  monthly_loans?: {
    sssLoan?: number;
    pagibigLoan?: number;
    companyLoan?: number;
    emergencyLoan?: number;
    otherLoan?: number;
  }; // Manual loan deductions for 1st cutoff (1-15) only, separated by loan type
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
}

export default function PayslipsPage() {
  const router = useRouter();
  const { canAccessSalaryInfo, loading: roleLoading } = useUserRole();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [periodStart, setPeriodStart] = useState<Date>(
    getBiMonthlyPeriodStart(new Date()) // Bi-monthly period starts on Monday
  );
  const [attendance, setAttendance] = useState<WeeklyAttendance | null>(null);
  const [deductions, setDeductions] = useState<EmployeeDeductions | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockEntries, setClockEntries] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  // Redirect HR users without salary access
  useEffect(() => {
    if (!roleLoading && !canAccessSalaryInfo) {
      toast.error("You do not have permission to access this page.");
      router.push("/dashboard");
    }
  }, [canAccessSalaryInfo, roleLoading, router]);

  // Helper function to check if current period is second cutoff (deductions applied monthly)
  const isSecondCutoff = () => {
    return periodStart.getDate() >= 16;
  };

  // Helper function to check if current period is first cutoff (1-15)
  const isFirstCutoff = () => {
    return periodStart.getDate() <= 15;
  };

  // State for manual monthly loans input (only for 1st cutoff) - separated by loan type
  const [monthlyLoans, setMonthlyLoans] = useState<{
    sssLoan: number;
    pagibigLoan: number;
    companyLoan: number;
    emergencyLoan: number;
    otherLoan: number;
  }>({
    sssLoan: 0,
    pagibigLoan: 0,
    companyLoan: 0,
    emergencyLoan: 0,
    otherLoan: 0,
  });

  // Payslip form data - Mandatory deductions are now always applied
  const [applySss] = useState(true); // Always true - mandatory
  const [applyPhilhealth] = useState(true); // Always true - mandatory
  const [applyPagibig] = useState(true); // Always true - mandatory
  const [preparedBy, setPreparedBy] = useState("Melanie R. Sapinoso");
  const [showPrintModal, setShowPrintModal] = useState(false);

  const supabase = createClient();

  function handlePrintPayslip() {
    // Find the payslip container
    const payslipContainer = document.getElementById("payslip-print-content");
    if (!payslipContainer) {
      toast.error("Payslip content not found");
      return;
    }

    // Create a new window for printing
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print payslip");
      return;
    }

    // Get the payslip HTML content
    const payslipHTML = payslipContainer.outerHTML;

    // Write the HTML document with print styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Payslip - ${selectedEmployee?.full_name || "Employee"}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            html, body {
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
              background: white;
              color: black;
              font-family: Arial, sans-serif;
            }
            .payslip-container {
              width: 8.5in;
              padding: 0.5in;
              margin: 0 auto;
              background: white;
              color: black;
            }
            @media print {
              @page {
                size: letter portrait;
                margin: 0.5in;
              }
              html, body {
                margin: 0;
                padding: 0;
                background: white;
              }
              .payslip-container {
                margin: 0 auto;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          ${payslipHTML}
          <script>
            // Auto-print when window loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      setSelectedEmployee(emp || null);
      // Only load attendance if employee is found in the list
      if (emp) {
        loadAttendanceAndDeductions();
      } else if (employees.length > 0) {
        // Employee not found in list - might be a stale selection
        console.warn(
          `Employee ${selectedEmployeeId} not found in employees list`
        );
      }
    }
  }, [selectedEmployeeId, periodStart, employees]);

  async function loadEmployees() {
    try {
      console.log("Loading employees for payslip generation...");
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_id, full_name, monthly_rate, per_day, position, eligible_for_ot, assigned_hotel, deployed"
        )
        .eq("is_active", true)
        .order("full_name");

      if (error) {
        console.error("Error loading employees:", error);
        console.error("Error details:", {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        });
        throw error;
      }

      console.log(`Loaded ${data?.length || 0} active employees`);
      if (data && data.length > 0) {
        console.log("Sample employee:", data[0]);
        // Map employees to include computed rate fields
        const mappedEmployees = data.map((emp: any) => ({
          ...emp,
          rate_per_day: emp.per_day || undefined,
          rate_per_hour: emp.per_day ? emp.per_day / 8 : undefined,
        }));
        setEmployees(mappedEmployees);
      } else {
        console.warn(
          "No active employees found. Checking if there are any employees at all..."
        );
        // Check if there are any employees (including inactive)
        const { data: allEmployees, error: allEmpError } = await supabase
          .from("employees")
          .select("id, employee_id, full_name, is_active")
          .limit(10);

        if (allEmpError) {
          console.error("Error checking for all employees:", allEmpError);
        } else {
          console.log(
            "Total employees in database:",
            allEmployees?.length || 0
          );
          if (allEmployees && allEmployees.length > 0) {
            const inactiveCount = (allEmployees as any[]).filter(
              (emp) => !emp.is_active
            ).length;
            const activeCount = (allEmployees as any[]).filter(
              (emp) => emp.is_active
            ).length;
            console.log(
              `Found ${activeCount} active and ${inactiveCount} inactive employees`
            );
            if (inactiveCount > 0) {
              console.log(
                "Inactive employees:",
                (allEmployees as any[]).filter((emp) => !emp.is_active)
              );
            }
          } else {
            console.warn(
              "No employees found in database at all. Please create employees first."
            );
          }
        }
      }

      // Already set above if data exists
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
      // Set empty array so UI doesn't break
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceAndDeductions() {
    if (!selectedEmployeeId) return;

    // Validate employee_id is a valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(selectedEmployeeId)) {
      console.error("Invalid employee ID format:", selectedEmployeeId);
      toast.error("Invalid employee selected. Please select a valid employee.");
      return;
    }

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEnd = getBiMonthlyPeriodEnd(periodStart);
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      console.log("Loading attendance for employee:", {
        employeeId: selectedEmployeeId,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        periodStartDate: periodStart.toISOString(),
        periodEndDate: periodEnd.toISOString(),
      });

      // Load attendance - use same query as timesheet page (period_start only)
      let { data: attData, error: attError } = await supabase
        .from("weekly_attendance")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .maybeSingle();

      if (attError) {
        console.error("Attendance error:", attError);
        console.error("Error details:", {
          message: attError.message,
          code: attError.code,
          details: attError.details,
          hint: attError.hint,
        });
        // Don't throw - continue to generate from clock entries
      }

      // Load leave requests for the period (needed for both existing and new attendance)
      const { data: leaveData, error: leaveError } = await supabase
        .from("leave_requests")
        .select("id, leave_type, start_date, end_date, status, selected_dates")
        .eq("employee_id", selectedEmployeeId)
        .lte("start_date", periodEndStr)
        .gte("end_date", periodStartStr)
        .in("status", ["approved_by_manager", "approved_by_hr"]);

      if (leaveError) {
        console.warn("Error loading leave requests:", leaveError);
      }

      // Create a map of leave dates with their leave types
      // Prioritize SIL over other leave types when multiple leaves exist on the same date
      const leaveDatesMap = new Map<
        string,
        { leaveType: string; status: string }
      >();
      if (leaveData) {
        leaveData.forEach((leave: any) => {
          // Handle selected_dates if available (for multi-day leaves)
          if (leave.selected_dates && Array.isArray(leave.selected_dates)) {
            leave.selected_dates.forEach((dateStr: string) => {
              if (dateStr >= periodStartStr && dateStr <= periodEndStr) {
                const existing = leaveDatesMap.get(dateStr);
                // Prioritize SIL over other leave types
                if (!existing || leave.leave_type === "SIL") {
                  leaveDatesMap.set(dateStr, {
                    leaveType: leave.leave_type,
                    status: leave.status,
                  });
                }
              }
            });
          } else {
            // Handle date range (start_date to end_date)
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
              const dateStr = format(currentDate, "yyyy-MM-dd");
              if (dateStr >= periodStartStr && dateStr <= periodEndStr) {
                const existing = leaveDatesMap.get(dateStr);
                // Prioritize SIL over other leave types
                if (!existing || leave.leave_type === "SIL") {
                  leaveDatesMap.set(dateStr, {
                    leaveType: leave.leave_type,
                    status: leave.status,
                  });
                }
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
      }

      console.log("Leave dates map:", Array.from(leaveDatesMap.entries()));

      if (attData) {
        const att = attData as any;
        console.log("Found attendance record:", {
          period_start: att.period_start,
          period_end: att.period_end,
          gross_pay: att.gross_pay,
          status: att.status,
        });

        // Update existing attendance_data to include leave days with BH = 8
        if (att.attendance_data && Array.isArray(att.attendance_data)) {
          att.attendance_data = att.attendance_data.map((day: any) => {
            const leaveInfo = leaveDatesMap.get(day.date);
            if (leaveInfo) {
              // If this day has an approved leave request
              if (leaveInfo.leaveType === "SIL") {
                // SIL (Sick Leave) counts as 8 hours working day
                // Set regularHours to 8 and dayType to "regular" for SIL leaves
                // This ensures they count as working days even if there are clock entries
                return {
                  ...day,
                  regularHours: 8, // Always set to 8 for SIL leaves
                  dayType: "regular", // Set dayType to "regular" so it counts in basic earnings
                };
              }
              // All other leave types (LWOP, CTO, OB, etc.) - do not count as working day
              // Return day as-is (no hours added)
            }
            return day;
          });

          // Recalculate total_regular_hours after updating leave days
          att.total_regular_hours =
            Math.round(
              att.attendance_data.reduce(
                (sum: number, day: any) => sum + (day.regularHours || 0),
                0
              ) * 100
            ) / 100;

          // Recalculate gross_pay if needed (if it was calculated from hours)
          // Note: This is a simple recalculation - full payroll calculation happens later
          if (selectedEmployee) {
            const ratePerHour =
              selectedEmployee.rate_per_hour ||
              (selectedEmployee.per_day
                ? selectedEmployee.per_day / 8
                : selectedEmployee.monthly_rate
                ? selectedEmployee.monthly_rate / (22 * 8)
                : 0);
            if (ratePerHour > 0 && att.gross_pay) {
              // Only update if gross_pay seems to be based on hours
              // Otherwise, keep the existing gross_pay
              const calculatedFromHours = att.total_regular_hours * ratePerHour;
              // If the difference is small, update it
              if (Math.abs(att.gross_pay - calculatedFromHours) < 100) {
                att.gross_pay = Math.round(calculatedFromHours * 100) / 100;
              }
            }
          }
        }
      }

      // If no attendance record exists, generate it directly from time clock entries
      if (!attData) {
        console.log(
          "No attendance record found. Generating from time clock entries..."
        );

        try {
          // Load time clock entries for this period
          // Use wider date range like timesheet page to account for timezone differences
          const periodStartDate = new Date(periodStart);
          periodStartDate.setHours(0, 0, 0, 0);
          periodStartDate.setDate(periodStartDate.getDate() - 1); // Start 1 day earlier

          const periodEndDate = new Date(periodEnd);
          periodEndDate.setHours(23, 59, 59, 999);
          periodEndDate.setDate(periodEndDate.getDate() + 1); // End 1 day later

          // Use the same column selection as timesheet page
          const { data: clockEntries, error: clockError } = await supabase
            .from("time_clock_entries")
            .select(
              "id, clock_in_time, clock_out_time, regular_hours, total_hours, total_night_diff_hours, status"
            )
            .eq("employee_id", selectedEmployeeId)
            .gte("clock_in_time", periodStartDate.toISOString())
            .lte("clock_in_time", periodEndDate.toISOString())
            .order("clock_in_time", { ascending: true });

          if (clockError) {
            console.error("Error loading clock entries:", clockError);
            throw clockError;
          }

          if (clockError) {
            console.error("Error loading clock entries:", clockError);
            throw clockError;
          }

          if (!clockEntries || clockEntries.length === 0) {
            console.log("No time clock entries found for this period");
            // Set attendance to null - will show "No Attendance Data" message
            setAttendance(null);
            return;
          }

          // Filter entries by date in Asia/Manila timezone like timesheet page does
          const filteredClockEntries = (clockEntries || []).filter(
            (entry: any) => {
              const entryDate = new Date(entry.clock_in_time);
              // Convert to Asia/Manila timezone for date comparison
              const entryDatePH = new Date(
                entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
              );
              const entryDateStr = format(entryDatePH, "yyyy-MM-dd");
              // Check if entry date falls within the period
              return (
                entryDateStr >= periodStartStr && entryDateStr <= periodEndStr
              );
            }
          );

          if (filteredClockEntries.length === 0) {
            console.log(
              "No time clock entries found after filtering for period"
            );
            setAttendance(null);
            return;
          }

          console.log(
            `Found ${clockEntries.length} clock entries, ${filteredClockEntries.length} within period`
          );

          // Load holidays for this period
          const { data: holidaysData } = await supabase
            .from("holidays")
            .select("holiday_date, name, is_regular")
            .gte("holiday_date", periodStartStr)
            .lte("holiday_date", periodEndStr);

          const holidays = (holidaysData || []).map((h: any) => ({
            holiday_date: h.holiday_date,
            holiday_type: h.is_regular ? "regular" : "non-working",
          }));

          // Load employee schedules to determine rest days (for Account Supervisors and others)
          const { data: scheduleData } = await supabase
            .from("employee_week_schedules")
            .select("schedule_date, day_off")
            .eq("employee_id", selectedEmployeeId)
            .gte("schedule_date", periodStartStr)
            .lte("schedule_date", periodEndStr);

          // Create a map of rest days from schedules
          const restDaysMap = new Map<string, boolean>();
          if (scheduleData) {
            scheduleData.forEach((schedule: any) => {
              if (schedule.day_off) {
                restDaysMap.set(schedule.schedule_date, true);
              }
            });
          }

          // Check if employee is eligible for OT (default to true if not set)
          const isEligibleForOT = selectedEmployee?.eligible_for_ot !== false;

          // Check if employee is Account Supervisor (for ND eligibility)
          const isAccountSupervisor =
            selectedEmployee?.position
              ?.toUpperCase()
              .includes("ACCOUNT SUPERVISOR") || false;
          const isEligibleForNightDiff = !isAccountSupervisor;

          // Fetch approved overtime requests for this period
          // OT and ND should come from overtime_requests once approved
          let approvedOTByDate = new Map<string, number>();
          let approvedNDByDate = new Map<string, number>();
          if (isEligibleForOT) {
            const { data: otRequests, error: otError } = await supabase
              .from("overtime_requests")
              .select("ot_date, end_date, start_time, end_time, total_hours")
              .eq("employee_id", selectedEmployeeId)
              .eq("status", "approved")
              .gte("ot_date", periodStartStr)
              .lte("ot_date", periodEndStr);

            if (otError) {
              console.warn("Error loading OT requests:", otError);
            } else if (otRequests) {
              // Group OT hours and calculate ND by date
              otRequests.forEach((ot: any) => {
                const dateStr =
                  typeof ot.ot_date === "string"
                    ? ot.ot_date.split("T")[0]
                    : format(new Date(ot.ot_date), "yyyy-MM-dd");

                // Add OT hours
                const existingOT = approvedOTByDate.get(dateStr) || 0;
                approvedOTByDate.set(
                  dateStr,
                  existingOT + (ot.total_hours || 0)
                );

                // Calculate night differential from start_time and end_time
                // ND applies from 5PM (17:00) to 6AM (06:00) next day
                if (isEligibleForNightDiff && ot.start_time && ot.end_time) {
                  const startTime = ot.start_time.includes("T")
                    ? ot.start_time.split("T")[1].substring(0, 8)
                    : ot.start_time.substring(0, 8);
                  const endTime = ot.end_time.includes("T")
                    ? ot.end_time.split("T")[1].substring(0, 8)
                    : ot.end_time.substring(0, 8);

                  const startHour = parseInt(startTime.split(":")[0]);
                  const startMin = parseInt(startTime.split(":")[1]);
                  const endHour = parseInt(endTime.split(":")[0]);
                  const endMin = parseInt(endTime.split(":")[1]);

                  // Check if end_date is different from ot_date (OT spans midnight)
                  const endDateStr = ot.end_date
                    ? typeof ot.end_date === "string"
                      ? ot.end_date.split("T")[0]
                      : format(new Date(ot.end_date), "yyyy-MM-dd")
                    : dateStr;
                  const spansMidnight = endDateStr !== dateStr;

                  let ndHours = 0;
                  const nightStart = 17; // 5PM
                  const nightEnd = 6; // 6AM

                  // Convert times to minutes for easier calculation
                  const startTotalMin = startHour * 60 + startMin;
                  const endTotalMin = endHour * 60 + endMin;
                  const nightStartMin = nightStart * 60; // 5PM = 1020 minutes
                  const nightEndMin = nightEnd * 60; // 6AM = 360 minutes

                  if (spansMidnight) {
                    // OT spans midnight
                    // Calculate ND from max(start_time, 5PM) to midnight, plus midnight to min(end_time, 6AM)
                    const ndStartMin = Math.max(startTotalMin, nightStartMin);
                    const hoursToMidnight = (24 * 60 - ndStartMin) / 60;

                    let hoursFromMidnight = 0;
                    if (endTotalMin <= nightEndMin) {
                      // Ends before or at 6AM
                      hoursFromMidnight = endTotalMin / 60;
                    } else {
                      // Ends after 6AM, cap at 6AM
                      hoursFromMidnight = nightEndMin / 60;
                    }

                    ndHours = hoursToMidnight + hoursFromMidnight;
                  } else {
                    // OT on same day
                    if (startTotalMin >= nightStartMin) {
                      // Starts at or after 5PM
                      ndHours = (endTotalMin - startTotalMin) / 60;
                    } else if (endTotalMin >= nightStartMin) {
                      // Starts before 5PM, ends after 5PM
                      ndHours = (endTotalMin - nightStartMin) / 60;
                    }
                    // If both start and end are before 5PM, ND = 0
                  }

                  // Cap ND hours at total_hours (can't exceed OT hours) and ensure non-negative
                  ndHours = Math.min(Math.max(0, ndHours), ot.total_hours || 0);

                  if (ndHours > 0) {
                    console.log(
                      `Night Differential calculated for ${dateStr}:`,
                      {
                        ot_date: dateStr,
                        start_time: ot.start_time,
                        end_time: ot.end_time,
                        end_date: ot.end_date,
                        total_hours: ot.total_hours,
                        nd_hours: ndHours,
                        spansMidnight,
                      }
                    );
                  }

                  const existingND = approvedNDByDate.get(dateStr) || 0;
                  approvedNDByDate.set(dateStr, existingND + ndHours);
                }
              });
              console.log("Approved OT requests by date:", approvedOTByDate);
              console.log("Approved ND by date:", approvedNDByDate);
            }
          }

          // Map clock entries to match the generator function's expected format
          // Overtime hours and night differential should come from approved OT requests, not calculated from clock entries
          const mappedClockEntries = filteredClockEntries.map((entry: any) => {
            const entryDate = entry.clock_in_time?.split("T")[0];
            // Get overtime hours from approved OT requests for this date
            const otHoursFromRequest = isEligibleForOT
              ? approvedOTByDate.get(entryDate) || 0
              : 0;

            // Get night differential hours from approved OT requests for this date
            const ndHoursFromRequest = isEligibleForNightDiff
              ? approvedNDByDate.get(entryDate) || 0
              : 0;

            return {
              ...entry,
              overtime_hours: otHoursFromRequest, // Use OT from approved requests only
              night_diff_hours: ndHoursFromRequest, // Use ND from approved requests only
            };
          });

          // Generate attendance data from mapped clock entries with rest days
          // Note: leaveDatesMap is already created above for existing attendance records
          // isAccountSupervisor and isEligibleForNightDiff are already defined above
          const timesheetData = generateTimesheetFromClockEntries(
            mappedClockEntries as any,
            periodStart,
            periodEnd,
            holidays,
            restDaysMap,
            isEligibleForOT,
            isEligibleForNightDiff
          );

          // Update attendance_data to include leave days
          // Only SIL (Sick Leave) counts as a working day (8 hours)
          // All other leaves are not paid and not recorded as a working day
          timesheetData.attendance_data = timesheetData.attendance_data.map(
            (day: any) => {
              const leaveInfo = leaveDatesMap.get(day.date);
              if (leaveInfo) {
                // If this day has an approved leave request
                if (leaveInfo.leaveType === "SIL") {
                  // SIL (Sick Leave) counts as 8 hours working day
                  // Set regularHours to 8 and dayType to "regular" for SIL leaves
                  // This ensures they count as working days even if there are no clock entries
                  return {
                    ...day,
                    regularHours: 8, // Always set to 8 for SIL leaves
                    dayType: "regular", // Set dayType to "regular" so it counts in basic earnings
                  };
                }
                // All other leave types (LWOP, CTO, OB, etc.) - do not count as working day
                // Return day as-is (no hours added)
              }
              return day;
            }
          );

          // Recalculate totals after updating leave days
          timesheetData.total_regular_hours =
            Math.round(
              timesheetData.attendance_data.reduce(
                (sum: number, day: any) => sum + day.regularHours,
                0
              ) * 100
            ) / 100;

          // Calculate gross pay - try to get from employee's monthly_rate or per_day
          let grossPay = 0;
          const selectedEmp = employees.find(
            (e) => e.id === selectedEmployeeId
          );
          if (selectedEmp && timesheetData.attendance_data.length > 0) {
            let ratePerHour = 0;
            const workingDaysPerMonth = 22;

            if (selectedEmp.monthly_rate) {
              ratePerHour =
                selectedEmp.monthly_rate / (workingDaysPerMonth * 8);
            } else if (selectedEmp.per_day) {
              ratePerHour = selectedEmp.per_day / 8;
            }

            if (ratePerHour > 0) {
              try {
                const payrollResult = calculateWeeklyPayroll(
                  timesheetData.attendance_data,
                  ratePerHour
                );
                grossPay = Math.round(payrollResult.grossPay * 100) / 100;
              } catch (calcError) {
                console.error("Error calculating payroll:", calcError);
                // Fallback: estimate from hours
                grossPay =
                  Math.round(
                    timesheetData.total_regular_hours * ratePerHour * 100
                  ) / 100;
              }
            }
          }

          // Create attendance object from clock entries data
          attData = {
            id: `temp-${selectedEmployeeId}-${periodStartStr}`,
            employee_id: selectedEmployeeId,
            period_start: periodStartStr,
            period_end: periodEndStr,
            period_type: "bimonthly",
            attendance_data: timesheetData.attendance_data,
            total_regular_hours: timesheetData.total_regular_hours,
            total_overtime_hours: timesheetData.total_overtime_hours,
            total_night_diff_hours: timesheetData.total_night_diff_hours,
            gross_pay: grossPay,
            status: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: null,
          } as any;

          console.log("Generated attendance data from clock entries:", attData);
          toast.success("Attendance data generated from time clock entries");
        } catch (genError: any) {
          console.error(
            "Error generating attendance from clock entries:",
            genError
          );
          toast.error(
            `Failed to generate attendance data: ${
              genError.message || "Unknown error"
            }`
          );
          setAttendance(null);
          return;
        }
      }

      console.log("Attendance data loaded:", attData ? "Found" : "Not found");
      if (attData) {
        const att = attData as any;
        console.log("Attendance data:", {
          id: att.id,
          period_start: att.period_start,
          gross_pay: att.gross_pay,
          total_regular_hours: att.total_regular_hours,
          total_overtime_hours: att.total_overtime_hours,
          total_night_diff_hours: att.total_night_diff_hours,
          attendance_data_length: Array.isArray(att.attendance_data)
            ? att.attendance_data.length
            : "Not an array",
          sample_day:
            Array.isArray(att.attendance_data) && att.attendance_data.length > 0
              ? att.attendance_data[0]
              : "No days",
        });

        // Ensure attendance_data is an array
        if (!Array.isArray(att.attendance_data)) {
          console.warn(
            "attendance_data is not an array, setting to empty array"
          );
          att.attendance_data = [];
        }

        // Ensure totals are numbers
        att.total_regular_hours = att.total_regular_hours || 0;
        att.total_overtime_hours = att.total_overtime_hours || 0;
        att.total_night_diff_hours = att.total_night_diff_hours || 0;
      } else {
        console.warn(
          "No attendance record found after auto-generation attempt."
        );
        // Check if there are time clock entries for this period
        const periodStartISO = new Date(
          `${periodStartStr}T00:00:00`
        ).toISOString();
        const periodEndISO = new Date(`${periodEndStr}T23:59:59`).toISOString();

        const { data: clockEntries, error: clockEntriesError } = await supabase
          .from("time_clock_entries")
          .select("clock_in_time, clock_out_time")
          .eq("employee_id", selectedEmployeeId)
          .gte("clock_in_time", periodStartISO)
          .lte("clock_in_time", periodEndISO)
          .limit(5);

        if (clockEntriesError) {
          console.error("Error checking for clock entries:", clockEntriesError);
        }

        // This code block is no longer needed since we generate directly from clock entries above
      }

      // Only set attendance if attData exists and has valid structure
      if (attData) {
        setAttendance(attData as any);
      } else {
        console.warn("No attendance data to set - attData is null/undefined");
        setAttendance(null);
      }

      // Load time clock entries for this period to get actual clock in/out times
      try {
        // Validate employee_id is a valid UUID before querying
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(selectedEmployeeId)) {
          console.error(
            "Invalid employee_id format for clock entries:",
            selectedEmployeeId
          );
          setClockEntries([]);
        } else {
          // Use ISO string format for date comparisons
          const periodStartISO = new Date(
            `${periodStartStr}T00:00:00`
          ).toISOString();
          const periodEndISO = new Date(
            `${periodEndStr}T23:59:59`
          ).toISOString();

          // Use the same query structure as timesheet page
          // Use wider date range to account for timezone differences
          const periodStartDateWide = new Date(periodStart);
          periodStartDateWide.setHours(0, 0, 0, 0);
          periodStartDateWide.setDate(periodStartDateWide.getDate() - 1);

          const periodEndDateWide = new Date(periodEnd);
          periodEndDateWide.setHours(23, 59, 59, 999);
          periodEndDateWide.setDate(periodEndDateWide.getDate() + 1);

          let { data: clockData, error: clockDataError } = await supabase
            .from("time_clock_entries")
            .select(
              "id, clock_in_time, clock_out_time, regular_hours, total_hours, total_night_diff_hours, status"
            )
            .eq("employee_id", selectedEmployeeId)
            .gte("clock_in_time", periodStartDateWide.toISOString())
            .lte("clock_in_time", periodEndDateWide.toISOString())
            .order("clock_in_time", { ascending: true });

          // Filter by date in Asia/Manila timezone and status (like timesheet page)
          if (!clockDataError && clockData) {
            // Filter by date first
            const filteredByDate = clockData.filter((entry: any) => {
              const entryDate = new Date(entry.clock_in_time);
              const entryDatePH = new Date(
                entryDate.toLocaleString("en-US", { timeZone: "Asia/Manila" })
              );
              const entryDateStr = format(entryDatePH, "yyyy-MM-dd");
              return (
                entryDateStr >= periodStartStr && entryDateStr <= periodEndStr
              );
            });

            // Then filter by status
            const validStatuses = ["clocked_out", "approved", "auto_approved"];
            clockData = filteredByDate.filter((entry: any) =>
              validStatuses.includes(entry.status)
            );
          }

          if (clockDataError) {
            console.error("Error loading clock entries:", clockDataError);
            console.error("Query parameters:", {
              employee_id: selectedEmployeeId,
              periodStart: periodStartStr,
              periodEnd: periodEndStr,
              periodStartISO,
              periodEndISO,
            });
            console.error("Full error details:", {
              message: clockDataError.message,
              code: clockDataError.code,
              details: clockDataError.details,
              hint: clockDataError.hint,
            });
            // Don't throw - just log and continue with empty array
          }
          setClockEntries(clockData || []);
        }
      } catch (clockErr) {
        console.error("Exception loading clock entries:", clockErr);
        setClockEntries([]);
      }

      // Load deductions for this period
      // NOTE: The employee_deductions table schema has changed from the original design
      // The current table uses deduction_type/amount/description instead of specific amount fields
      // For now, we'll skip loading deductions to avoid 400 errors
      // TODO: Update this to work with the new schema or restore the old schema
      try {
        // Temporarily disable deductions loading until schema is aligned
        // The new schema doesn't match what the payslip code expects
        console.warn(
          "Deductions loading skipped - schema mismatch between code and database"
        );
        setDeductions(null);
      } catch (dedErr) {
        console.error("Exception loading deductions:", dedErr);
        setDeductions(null);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load attendance/deductions");
    }
  }

  function changePeriod(direction: "prev" | "next") {
    if (direction === "prev") {
      setPeriodStart(getPreviousBiMonthlyPeriod(periodStart));
    } else {
      setPeriodStart(getNextBiMonthlyPeriod(periodStart));
    }
  }

  async function generatePayslip() {
    if (!selectedEmployee || !attendance) {
      toast.error("Missing attendance data");
      return;
    }

    // Note: rate_per_day was removed from employees table
    // Gross pay is already calculated in weekly_attendance table
    // Government contributions will need to be calculated differently
    // For now, we'll proceed without rate validation

    setGenerating(true);

    try {
      // Calculate gross pay from attendance data if not already calculated
      let grossPay = attendance.gross_pay || 0;

      // If gross_pay is 0 or missing, calculate it from attendance_data
      if (
        grossPay === 0 &&
        attendance.attendance_data &&
        Array.isArray(attendance.attendance_data)
      ) {
        const ratePerHour =
          selectedEmployee.rate_per_hour ||
          (selectedEmployee.per_day
            ? selectedEmployee.per_day / 8
            : selectedEmployee.rate_per_day
            ? selectedEmployee.rate_per_day / 8
            : 0);
        if (ratePerHour > 0) {
          const payrollResult = calculateWeeklyPayroll(
            attendance.attendance_data,
            ratePerHour
          );
          grossPay = Math.round(payrollResult.grossPay * 100) / 100;
        }
      }

      // Calculate monthly basic salary for government contributions
      const workingDaysPerMonth = 22;
      let monthlyBasicSalary = 0;

      if (selectedEmployee.monthly_rate) {
        // Use monthly_rate directly if available
        monthlyBasicSalary = selectedEmployee.monthly_rate;
      } else if (selectedEmployee.per_day) {
        // Calculate from per_day if monthly_rate not available
        monthlyBasicSalary = calculateMonthlySalary(
          selectedEmployee.per_day,
          workingDaysPerMonth
        );
      } else if (selectedEmployee.rate_per_day) {
        // Backward compatibility
        monthlyBasicSalary = calculateMonthlySalary(
          selectedEmployee.rate_per_day,
          workingDaysPerMonth
        );
      } else {
        // Estimate from bi-monthly gross pay as last resort
        monthlyBasicSalary = grossPay * 2;
      }

      // Calculate mandatory government contributions based on monthly basic salary
      // Ensure monthlyBasicSalary is valid (not NaN, undefined, or negative)
      const validMonthlySalary =
        monthlyBasicSalary && monthlyBasicSalary > 0 ? monthlyBasicSalary : 0;

      const sssContribution = calculateSSS(validMonthlySalary);
      const philhealthContribution = calculatePhilHealth(validMonthlySalary);
      const pagibigContribution = calculatePagIBIG(validMonthlySalary);

      // Deductions are applied monthly, so only deduct during second cutoff (day 16+)
      // Since deductions are applied once per month (not bi-monthly), use FULL monthly amounts
      const applyMonthlyDeductions = isSecondCutoff();

      // Note: Only employee shares are deducted
      // Ensure values are valid numbers (not NaN or undefined)
      const sssAmount =
        applyMonthlyDeductions && !isNaN(sssContribution?.employeeShare)
          ? Math.round(sssContribution.employeeShare * 100) / 100
          : 0;
      const philhealthAmount =
        applyMonthlyDeductions && !isNaN(philhealthContribution?.employeeShare)
          ? Math.round(philhealthContribution.employeeShare * 100) / 100
          : 0;
      const pagibigAmount =
        applyMonthlyDeductions && !isNaN(pagibigContribution?.employeeShare)
          ? Math.round(pagibigContribution.employeeShare * 100) / 100
          : 0;

      // Weekly deductions (always applied) - default to 0 if no deduction record
      let totalDeductions =
        (deductions?.vale_amount || 0) +
        (deductions?.sss_salary_loan || 0) +
        (deductions?.sss_calamity_loan || 0) +
        (deductions?.pagibig_salary_loan || 0) +
        (deductions?.pagibig_calamity_loan || 0) +
        (isFirstCutoff()
          ? (monthlyLoans.sssLoan || 0) +
            (monthlyLoans.pagibigLoan || 0) +
            (monthlyLoans.companyLoan || 0) +
            (monthlyLoans.emergencyLoan || 0) +
            (monthlyLoans.otherLoan || 0)
          : 0); // Monthly loans only for 1st cutoff

      // Add mandatory government contributions (only during second cutoff)
      totalDeductions += sssAmount + philhealthAmount + pagibigAmount;

      // Calculate withholding tax automatically if not in deductions (only during second cutoff)
      // Since deductions are applied once per month, use FULL monthly tax amount
      let withholdingTax = 0;
      if (applyMonthlyDeductions) {
        withholdingTax = deductions?.withholding_tax || 0;
        if (withholdingTax === 0 && validMonthlySalary > 0) {
          const monthlyContributions =
            sssContribution.employeeShare +
            philhealthContribution.employeeShare +
            pagibigContribution.employeeShare;
          const monthlyTaxableIncome =
            validMonthlySalary - monthlyContributions;
          const monthlyTax = calculateWithholdingTax(monthlyTaxableIncome);
          withholdingTax = Math.round(monthlyTax * 100) / 100;
        }
      }
      totalDeductions += withholdingTax;

      // Adjustment and Allowance removed - always 0
      const adjustment = 0;
      const allowance = 0;

      // Net pay
      const netPay = grossPay - totalDeductions + allowance;

      // Create deductions breakdown - default all to 0 if no deduction record
      const deductionsBreakdown: any = {
        weekly: {
          vale: deductions?.vale_amount || 0,
          sss_loan: deductions?.sss_salary_loan || 0,
          sss_calamity: deductions?.sss_calamity_loan || 0,
          pagibig_loan: deductions?.pagibig_salary_loan || 0,
          pagibig_calamity: deductions?.pagibig_calamity_loan || 0,
          monthly_loans: isFirstCutoff()
            ? {
                sssLoan: monthlyLoans.sssLoan || 0,
                pagibigLoan: monthlyLoans.pagibigLoan || 0,
                companyLoan: monthlyLoans.companyLoan || 0,
                emergencyLoan: monthlyLoans.emergencyLoan || 0,
                otherLoan: monthlyLoans.otherLoan || 0,
              }
            : undefined, // Monthly loans only for 1st cutoff
        },
        tax: withholdingTax,
      };

      // Mandatory government contributions (always included)
      deductionsBreakdown.sss = sssAmount;
      deductionsBreakdown.philhealth = philhealthAmount;
      deductionsBreakdown.pagibig = pagibigAmount;

      // Generate payslip number
      const year = periodStart.getFullYear();
      const periodNumber = Math.ceil(
        (periodStart.getDate() +
          (periodStart.getDay() === 0 ? 7 : periodStart.getDay() - 1)) /
          14
      );
      const payslipNumber = generatePayslipNumber(
        selectedEmployee.employee_id,
        periodNumber,
        year
      );

      const periodEnd = getBiMonthlyPeriodEnd(periodStart);

      // Validate required fields before creating payslip data
      if (!attendance.attendance_data) {
        throw new Error(
          "Attendance data is missing. Please load attendance first."
        );
      }

      if (!deductionsBreakdown) {
        throw new Error("Deductions breakdown is missing.");
      }

      // Ensure all required numeric fields are valid
      if (isNaN(grossPay) || grossPay === null || grossPay === undefined) {
        throw new Error("Gross pay is invalid. Please recalculate.");
      }

      if (isNaN(netPay) || netPay === null || netPay === undefined) {
        throw new Error("Net pay is invalid. Please recalculate.");
      }

      if (
        isNaN(totalDeductions) ||
        totalDeductions === null ||
        totalDeductions === undefined
      ) {
        totalDeductions = 0; // Default to 0 if invalid
      }

      const payslipData = {
        employee_id: selectedEmployee.id,
        payslip_number: payslipNumber,
        week_number: periodNumber,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        period_type: "bimonthly",
        earnings_breakdown: attendance.attendance_data || [], // Ensure it's never null
        gross_pay: grossPay,
        deductions_breakdown: deductionsBreakdown || {}, // Ensure it's never null
        total_deductions: totalDeductions,
        apply_sss: applySss,
        apply_philhealth: applyPhilhealth,
        apply_pagibig: applyPagibig,
        // Ensure all amounts are valid numbers (not NaN or undefined)
        sss_amount: isNaN(sssAmount) ? 0 : sssAmount,
        philhealth_amount: isNaN(philhealthAmount) ? 0 : philhealthAmount,
        pagibig_amount: isNaN(pagibigAmount) ? 0 : pagibigAmount,
        adjustment_amount: 0,
        adjustment_reason: null,
        allowance_amount: 0,
        net_pay: netPay,
        status: "draft",
        created_by: null, // Set to null initially to avoid RLS issues
      };

      console.log("Saving payslip to database:", {
        payslipNumber,
        employee: selectedEmployee.full_name,
        grossPay,
        netPay,
        totalDeductions,
      });

      // Check authentication status before querying
      // Refresh session to ensure it's current
      const {
        data: { session: authSession },
        error: sessionError,
      } = await supabase.auth.getSession();

      // If no session, try to refresh
      if (!authSession) {
        console.warn("⚠️ No session found, attempting to refresh...");
        await supabase.auth.refreshSession();
      }

      console.log("🔐 Payslip Save - Auth Status:", {
        hasSession: !!authSession,
        userId: authSession?.user?.id || null,
        userEmail: authSession?.user?.email || null,
        sessionError: sessionError?.message || null,
      });

      // Verify user role
      if (authSession?.user?.id) {
        const { data: userRoleData, error: roleError } = await supabase
          .from("users")
          .select("role, is_active")
          .eq("id", authSession.user.id)
          .single();

        const roleData = userRoleData as {
          role: string;
          is_active: boolean;
        } | null;

        console.log("👤 User Role Check:", {
          userId: authSession.user.id,
          role: roleData?.role || null,
          isActive: roleData?.is_active || null,
          roleError: roleError?.message || null,
        });
      }

      // Check if payslip already exists
      const { data: existing, error: checkError } = await supabase
        .from("payslips")
        .select("id, payslip_number")
        .eq("payslip_number", payslipNumber)
        .maybeSingle();

      if (checkError) {
        console.error("❌ Error checking for existing payslip:", {
          error: checkError,
          code: checkError.code,
          message: checkError.message,
          details: checkError.details,
          hint: checkError.hint,
          authSession: !!authSession,
          userId: authSession?.user?.id || null,
        });
        throw checkError;
      }

      const existingPayslip = existing as {
        id: string;
        payslip_number: string;
      } | null;

      if (existingPayslip) {
        console.log("Updating existing payslip:", existingPayslip.id);
        // Update
        const { error, data: updatedData } = await (
          supabase.from("payslips") as any
        )
          .update(payslipData)
          .eq("id", existingPayslip.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating payslip:", error);
          throw error;
        }
        console.log("Payslip updated successfully:", updatedData);
        toast.success("Payslip updated successfully");
      } else {
        console.log("Creating new payslip...");
        // Create
        const { error, data: insertedData } = await (
          supabase.from("payslips") as any
        )
          .insert([payslipData])
          .select()
          .single();

        if (error) {
          console.error("❌ Error creating payslip:", {
            error: error,
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint,
            payslipData: {
              ...payslipData,
              earnings_breakdown: Array.isArray(payslipData.earnings_breakdown)
                ? `Array with ${payslipData.earnings_breakdown.length} items`
                : typeof payslipData.earnings_breakdown,
              deductions_breakdown: typeof payslipData.deductions_breakdown,
            },
            authSession: !!authSession,
            userId: authSession?.user?.id || null,
          });
          throw error;
        }
        console.log("Payslip created successfully:", insertedData);
        toast.success("Payslip generated and saved successfully");
      }
    } catch (error: any) {
      console.error("Error generating payslip:", error);
      toast.error(error.message || "Failed to generate payslip");
    } finally {
      setGenerating(false);
    }
  }

  // Show loading or access denied
  if (roleLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  // Show access denied message if user doesn't have permission
  if (!canAccessSalaryInfo) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <VStack gap="4" align="center">
                <Icon
                  name="Lock"
                  size={IconSizes.xl}
                  className="text-destructive"
                />
                <H3>Access Denied</H3>
                <BodySmall className="text-center text-muted-foreground">
                  You do not have permission to access the payslip management page.
                  Please contact your administrator if you need access.
                </BodySmall>
                <Button onClick={() => router.push("/dashboard")}>
                  Return to Dashboard
                </Button>
              </VStack>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // Calculate preview
  const grossPay = attendance?.gross_pay || 0;
  const weeklyDed =
    (deductions?.vale_amount || 0) +
    (deductions?.sss_salary_loan || 0) +
    (deductions?.sss_calamity_loan || 0) +
    (deductions?.pagibig_salary_loan || 0) +
    (deductions?.pagibig_calamity_loan || 0) +
    (isFirstCutoff()
      ? (monthlyLoans.sssLoan || 0) +
        (monthlyLoans.pagibigLoan || 0) +
        (monthlyLoans.companyLoan || 0) +
        (monthlyLoans.emergencyLoan || 0) +
        (monthlyLoans.otherLoan || 0)
      : 0); // Monthly loans only for 1st cutoff

  // Calculate mandatory government contributions based on monthly basic salary
  let govDed = 0;
  const workingDaysPerMonth = 22;
  let monthlyBasicSalary = 0;

  if (selectedEmployee?.monthly_rate) {
    // Use monthly_rate directly if available
    monthlyBasicSalary = selectedEmployee.monthly_rate;
  } else if (selectedEmployee?.per_day) {
    // Calculate from per_day if monthly_rate not available
    monthlyBasicSalary = calculateMonthlySalary(
      selectedEmployee.per_day,
      workingDaysPerMonth
    );
  } else if (selectedEmployee?.rate_per_day) {
    // Backward compatibility
    monthlyBasicSalary = calculateMonthlySalary(
      selectedEmployee.rate_per_day,
      workingDaysPerMonth
    );
  } else if (grossPay > 0) {
    // Estimate from bi-monthly gross pay as last resort
    monthlyBasicSalary = grossPay * 2;
  }

  // Deductions are applied monthly, so only deduct during second cutoff (day 16+)
  const applyMonthlyDeductions = isSecondCutoff();

  if (monthlyBasicSalary > 0 && applyMonthlyDeductions) {
    const validMonthlySalary =
      monthlyBasicSalary && monthlyBasicSalary > 0 ? monthlyBasicSalary : 0;
    const sssContribution = calculateSSS(validMonthlySalary);
    const philhealthContribution = calculatePhilHealth(validMonthlySalary);
    const pagibigContribution = calculatePagIBIG(validMonthlySalary);

    // Since deductions are applied once per month (not bi-monthly), use FULL monthly amounts
    // Note: Only employee shares are deducted
    // Ensure values are valid numbers (not NaN or undefined)
    const sssAmt = isNaN(sssContribution?.employeeShare)
      ? 0
      : Math.round(sssContribution.employeeShare * 100) / 100;
    const philhealthAmt = isNaN(philhealthContribution?.employeeShare)
      ? 0
      : Math.round(philhealthContribution.employeeShare * 100) / 100;
    const pagibigAmt = isNaN(pagibigContribution?.employeeShare)
      ? 0
      : Math.round(pagibigContribution.employeeShare * 100) / 100;

    govDed = sssAmt + philhealthAmt + pagibigAmt;
  } else {
    govDed = 0;
  }
  // Auto-calculate withholding tax if monthly salary is available (only during second cutoff)
  // Since deductions are applied once per month, use FULL monthly tax amount
  let tax = 0;
  if (applyMonthlyDeductions && monthlyBasicSalary > 0) {
    tax = deductions?.withholding_tax || 0;
    if (tax === 0) {
      const sss = calculateSSS(monthlyBasicSalary);
      const philhealth = calculatePhilHealth(monthlyBasicSalary);
      const pagibig = calculatePagIBIG(monthlyBasicSalary);

      // Taxable income = gross salary minus mandatory contributions
      const monthlyContributions =
        sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare;
      const monthlyTaxableIncome = monthlyBasicSalary - monthlyContributions;

      // Calculate monthly withholding tax (full amount, not divided)
      const monthlyTax = calculateWithholdingTax(monthlyTaxableIncome);
      tax = Math.round(monthlyTax * 100) / 100;
    }
  }
  // Adjustment and Allowance removed - always 0
  const adjustment = 0;
  const allowance = 0;
  const totalDed = weeklyDed + govDed + tax + adjustment;
  const netPay = grossPay - totalDed + allowance;

  const periodEnd = getBiMonthlyPeriodEnd(periodStart);

  // Helper function to calculate earnings breakdown from attendance data
  function calculateEarningsBreakdown() {
    // Return empty breakdown since rates are removed
    return {
      regularPay: 0,
      regularOT: 0,
      regularOTHours: 0,
      nightDiff: 0,
      nightDiffHours: 0,
      sundayRestDay: 0,
      sundayRestDayHours: 0,
      specialHoliday: 0,
      specialHolidayHours: 0,
      regularHoliday: 0,
      regularHolidayHours: 0,
      grossIncome: attendance?.gross_pay || 0,
    };
  }

  function calculateWorkingDays() {
    if (!attendance || !attendance.attendance_data) return 0;
    const days = attendance.attendance_data as any[];
    // Count days with regularHours >= 8 (including leave days with BH = 8)
    // IMPORTANT: "Days Work" = ALL days worked (regular + rest days)
    // Basic salary is calculated separately using only regular days
    // Rest days are paid separately with premium but still count as "Days Work"
    // Only exclude holidays since they're paid separately with different rates
    return days.filter((day: any) => {
      const regularHours = day.regularHours || 0;
      const dayType = day.dayType || "regular";
      // Count all days with 8+ hours, including rest days (sunday)
      // Exclude only holidays: regular-holiday, non-working-holiday, and their combinations
      return (
        regularHours >= 8 &&
        dayType !== "regular-holiday" &&
        dayType !== "non-working-holiday" &&
        dayType !== "sunday-special-holiday" &&
        dayType !== "sunday-regular-holiday"
      );
    }).length;
  }

  return (
    <>
      <DashboardLayout>
        <VStack gap="3" className="w-full print:hidden pb-24">
          <H1 className="text-xl">Payslip Generation</H1>

          <CardSection className="py-3">
            <HStack gap="4" align="start" className="flex-wrap">
              {/* Period Navigation */}
              <VStack gap="1" align="start">
                <Label className="text-xs text-muted-foreground">
                  Select Cut-off Period
                </Label>
                <HStack gap="1" align="center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => changePeriod("prev")}
                  >
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                  </Button>
                  <span className="font-medium text-sm min-w-[140px] text-center">
                    {formatBiMonthlyPeriod(periodStart, periodEnd)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => changePeriod("next")}
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </HStack>
              </VStack>

              {/* Employee Selection */}
              <VStack gap="1" align="start">
                <Label className="text-xs text-muted-foreground">
                  Employee
                </Label>
                {employees.length === 0 ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => (window.location.href = "/employees")}
                  >
                    <Icon name="UsersThree" size={IconSizes.sm} />
                    Add Employees
                  </Button>
                ) : (
                  <Select
                    value={selectedEmployeeId}
                    onValueChange={(value) => setSelectedEmployeeId(value)}
                  >
                    <SelectTrigger className="w-[200px] h-8">
                      <SelectValue placeholder="Select employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name} ({emp.employee_id})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </VStack>
            </HStack>
          </CardSection>

          {/* Missing Data Messages */}
          {selectedEmployee && !attendance && (
            <CardSection
              title={
                <HStack gap="2" align="center">
                  <Icon
                    name="WarningCircle"
                    size={IconSizes.md}
                    className="text-yellow-600"
                  />
                  <span>No Attendance Data</span>
                </HStack>
              }
            >
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <BodySmall className="text-yellow-800 font-medium text-xs">
                  No time attendance data found for {selectedEmployee.full_name}{" "}
                  for the period {formatBiMonthlyPeriod(periodStart, periodEnd)}
                </BodySmall>
                <BodySmall className="text-yellow-700 mt-1 text-xs">
                  The system attempted to generate attendance data from time
                  clock entries. If no data was found, check the
                  <strong> Time Entries</strong> page to verify records.
                </BodySmall>
              </div>
            </CardSection>
          )}

          {/* Earnings and Deductions Side-by-Side */}
          {selectedEmployee && (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {/* Detailed Earnings Breakdown - Left Side (60% width on large screens, 66% on medium) */}
              {selectedEmployee &&
                attendance &&
                (selectedEmployee.per_day || selectedEmployee.rate_per_day) &&
                (selectedEmployee.rate_per_hour || selectedEmployee.per_day) &&
                attendance.attendance_data && (
                  <CardSection
                    title="Earnings Breakdown"
                    className="compact md:col-span-2 lg:col-span-3"
                  >
                    <div className="max-h-[500px] md:max-h-[600px] lg:max-h-[700px] overflow-y-auto">
                      <PayslipDetailedBreakdown
                        employee={{
                          employee_id: selectedEmployee.employee_id,
                          full_name: selectedEmployee.full_name,
                          rate_per_day:
                            selectedEmployee.per_day ||
                            selectedEmployee.rate_per_day ||
                            0,
                          rate_per_hour:
                            selectedEmployee.rate_per_hour ||
                            (selectedEmployee.per_day
                              ? selectedEmployee.per_day / 8
                              : 0),
                          position: selectedEmployee.position || null,
                          assigned_hotel: selectedEmployee.assigned_hotel || null,
                          deployed: selectedEmployee.deployed,
                        }}
                        attendanceData={(
                          attendance.attendance_data as any[]
                        ).map((day: any) => {
                          const dayDate =
                            day.date || day.clock_in_time?.split("T")[0] || "";

                          // Find matching clock entry for this date
                          const matchingEntry = clockEntries.find((entry) => {
                            const entryDate =
                              entry.clock_in_time?.split("T")[0];
                            return entryDate === dayDate;
                          });

                          // Account Supervisors have flexi time, so they should not have night differential
                          const isAccountSupervisor =
                            selectedEmployee?.position
                              ?.toUpperCase()
                              .includes("ACCOUNT SUPERVISOR") || false;

                          // If day.regularHours is >= 8, it's likely a leave day - prioritize it over clock entry hours
                          // This ensures leave days with BH = 8 are counted correctly
                          const isLeaveDayWithFullHours =
                            (day.regularHours || 0) >= 8;
                          const regularHours = isLeaveDayWithFullHours
                            ? day.regularHours
                            : matchingEntry?.regular_hours ||
                              day.regularHours ||
                              0;

                          return {
                            date: dayDate,
                            dayType: day.dayType || "regular",
                            regularHours: regularHours,
                            overtimeHours: day.overtimeHours || 0,
                            nightDiffHours: isAccountSupervisor
                              ? 0
                              : matchingEntry?.night_diff_hours ||
                                day.nightDiffHours ||
                                0,
                            clockInTime:
                              matchingEntry?.clock_in_time ||
                              day.clockInTime ||
                              day.clock_in_time,
                            clockOutTime:
                              matchingEntry?.clock_out_time ||
                              day.clockOutTime ||
                              day.clock_out_time,
                          };
                        })}
                      />
                    </div>
                  </CardSection>
                )}

              {/* Deductions Breakdown - Right Side (40% width on large screens, 33% on medium) */}
              <CardSection
                title="Deductions"
                className="md:col-span-1 lg:col-span-2"
              >
                <VStack gap="3">
                  {/* Other Deductions */}
                  <VStack gap="1" align="start">
                    <H4 className="text-sm font-medium text-muted-foreground">
                      Other Deductions
                    </H4>
                    <VStack
                      gap="2"
                      className="bg-gray-50 p-3 rounded-lg w-full"
                    >
                      {(deductions?.vale_amount || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>Vale:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(deductions?.vale_amount || 0)}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.sss_salary_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>SSS Salary Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(deductions?.sss_salary_loan || 0)}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.sss_calamity_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>SSS Calamity Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(deductions?.sss_calamity_loan || 0)}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.pagibig_salary_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>Pag-IBIG Salary Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(
                              deductions?.pagibig_salary_loan || 0
                            )}
                          </span>
                        </HStack>
                      )}
                      {(deductions?.pagibig_calamity_loan || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>Pag-IBIG Calamity Loan:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(
                              deductions?.pagibig_calamity_loan || 0
                            )}
                          </span>
                        </HStack>
                      )}
                      {/* Monthly Loans - Only for 1st cutoff (1-15) */}
                      {isFirstCutoff() && (
                        <div className="w-full pt-2 border-t border-gray-200">
                          <BodySmall className="font-medium mb-2 block">
                            Monthly Loans:
                          </BodySmall>
                          <VStack gap="2" className="w-full">
                            {/* Company Loan */}
                            <HStack
                              justify="between"
                              align="center"
                              className="w-full"
                            >
                              <BodySmall className="text-gray-700">
                                Company Loan:
                              </BodySmall>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={monthlyLoans.companyLoan || 0}
                                onChange={(e) =>
                                  setMonthlyLoans({
                                    ...monthlyLoans,
                                    companyLoan:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24 h-8 text-sm text-right"
                                placeholder="0.00"
                              />
                            </HStack>
                            {(monthlyLoans.companyLoan || 0) > 0 && (
                              <HStack
                                justify="between"
                                align="center"
                                className="w-full pl-4"
                              >
                                <BodySmall className="text-gray-600 text-xs">
                                  Company Loan:
                                </BodySmall>
                                <span className="font-semibold text-red-600 text-xs">
                                  {formatCurrency(monthlyLoans.companyLoan || 0)}
                                </span>
                              </HStack>
                            )}

                            {/* SSS Loan */}
                            <HStack
                              justify="between"
                              align="center"
                              className="w-full"
                            >
                              <BodySmall className="text-gray-700">
                                SSS Loan:
                              </BodySmall>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={monthlyLoans.sssLoan || 0}
                                onChange={(e) =>
                                  setMonthlyLoans({
                                    ...monthlyLoans,
                                    sssLoan: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24 h-8 text-sm text-right"
                                placeholder="0.00"
                              />
                            </HStack>
                            {(monthlyLoans.sssLoan || 0) > 0 && (
                              <HStack
                                justify="between"
                                align="center"
                                className="w-full pl-4"
                              >
                                <BodySmall className="text-gray-600 text-xs">
                                  SSS Loan:
                                </BodySmall>
                                <span className="font-semibold text-red-600 text-xs">
                                  {formatCurrency(monthlyLoans.sssLoan || 0)}
                                </span>
                              </HStack>
                            )}

                            {/* Pag-IBIG Loan */}
                            <HStack
                              justify="between"
                              align="center"
                              className="w-full"
                            >
                              <BodySmall className="text-gray-700">
                                Pag-IBIG Loan:
                              </BodySmall>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={monthlyLoans.pagibigLoan || 0}
                                onChange={(e) =>
                                  setMonthlyLoans({
                                    ...monthlyLoans,
                                    pagibigLoan:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24 h-8 text-sm text-right"
                                placeholder="0.00"
                              />
                            </HStack>
                            {(monthlyLoans.pagibigLoan || 0) > 0 && (
                              <HStack
                                justify="between"
                                align="center"
                                className="w-full pl-4"
                              >
                                <BodySmall className="text-gray-600 text-xs">
                                  Pag-IBIG Loan:
                                </BodySmall>
                                <span className="font-semibold text-red-600 text-xs">
                                  {formatCurrency(monthlyLoans.pagibigLoan || 0)}
                                </span>
                              </HStack>
                            )}

                            {/* Emergency Loan */}
                            <HStack
                              justify="between"
                              align="center"
                              className="w-full"
                            >
                              <BodySmall className="text-gray-700">
                                Emergency Loan:
                              </BodySmall>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={monthlyLoans.emergencyLoan || 0}
                                onChange={(e) =>
                                  setMonthlyLoans({
                                    ...monthlyLoans,
                                    emergencyLoan:
                                      parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24 h-8 text-sm text-right"
                                placeholder="0.00"
                              />
                            </HStack>
                            {(monthlyLoans.emergencyLoan || 0) > 0 && (
                              <HStack
                                justify="between"
                                align="center"
                                className="w-full pl-4"
                              >
                                <BodySmall className="text-gray-600 text-xs">
                                  Emergency Loan:
                                </BodySmall>
                                <span className="font-semibold text-red-600 text-xs">
                                  {formatCurrency(
                                    monthlyLoans.emergencyLoan || 0
                                  )}
                                </span>
                              </HStack>
                            )}

                            {/* Other Loan */}
                            <HStack
                              justify="between"
                              align="center"
                              className="w-full"
                            >
                              <BodySmall className="text-gray-700">
                                Other Loan:
                              </BodySmall>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={monthlyLoans.otherLoan || 0}
                                onChange={(e) =>
                                  setMonthlyLoans({
                                    ...monthlyLoans,
                                    otherLoan: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-24 h-8 text-sm text-right"
                                placeholder="0.00"
                              />
                            </HStack>
                            {(monthlyLoans.otherLoan || 0) > 0 && (
                              <HStack
                                justify="between"
                                align="center"
                                className="w-full pl-4"
                              >
                                <BodySmall className="text-gray-600 text-xs">
                                  Other Loan:
                                </BodySmall>
                                <span className="font-semibold text-red-600 text-xs">
                                  {formatCurrency(monthlyLoans.otherLoan || 0)}
                                </span>
                              </HStack>
                            )}
                          </VStack>
                        </div>
                      )}
                      <div className="border-t pt-1.5 mt-1.5 w-full">
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <span className="font-semibold text-sm">
                            Subtotal:
                          </span>
                          <span className="font-semibold text-sm">
                            {formatCurrency(weeklyDed)}
                          </span>
                        </HStack>
                      </div>
                    </VStack>
                  </VStack>

                  {/* Government Contributions */}
                  <VStack gap="2" align="start">
                    <H4 className="text-sm font-medium text-muted-foreground">
                      Government Contributions
                    </H4>
                    {/* Use grid layout for side-by-side cards - 2 columns on larger screens */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                      {(() => {
                        const workingDaysPerMonth = 22;
                        let monthlyBasicSalary = 0;

                        if (selectedEmployee?.monthly_rate) {
                          monthlyBasicSalary = selectedEmployee.monthly_rate;
                        } else if (selectedEmployee?.per_day) {
                          monthlyBasicSalary = calculateMonthlySalary(
                            selectedEmployee.per_day,
                            workingDaysPerMonth
                          );
                        } else if (selectedEmployee?.rate_per_day) {
                          monthlyBasicSalary = calculateMonthlySalary(
                            selectedEmployee.rate_per_day,
                            workingDaysPerMonth
                          );
                        }

                        // Deductions are applied monthly, so only show during second cutoff (day 16+)
                        const applyMonthlyDeductions = isSecondCutoff();

                        // Since deductions are applied once per month, use FULL monthly amounts
                        const sssContribution =
                          monthlyBasicSalary > 0 && applyMonthlyDeductions
                            ? calculateSSS(monthlyBasicSalary)
                            : null;
                        const philhealthContribution =
                          monthlyBasicSalary > 0 && applyMonthlyDeductions
                            ? calculatePhilHealth(monthlyBasicSalary)
                            : null;
                        const pagibigContribution =
                          monthlyBasicSalary > 0 && applyMonthlyDeductions
                            ? calculatePagIBIG(monthlyBasicSalary)
                            : null;

                        return (
                          <>
                            {monthlyBasicSalary > 0 &&
                              applyMonthlyDeductions && (
                                <div className="p-2 border rounded-lg bg-blue-50 border-blue-200 col-span-2">
                                  <BodySmall className="text-blue-700 text-xs">
                                    Based on monthly salary:{" "}
                                    {formatCurrency(monthlyBasicSalary)}
                                  </BodySmall>
                                </div>
                              )}
                            {/* SSS Contribution Card */}
                            <HStack
                              justify="between"
                              align="center"
                              className="p-2 border rounded-lg bg-gray-50"
                            >
                              <VStack
                                gap="0"
                                align="start"
                                className="flex-1 min-w-0"
                              >
                                <span className="font-medium text-sm">SSS</span>
                                {sssContribution && (
                                  <Caption className="text-muted-foreground text-xs">
                                    MSC: {formatCurrency(sssContribution.msc)}
                                  </Caption>
                                )}
                              </VStack>
                              <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                {sssContribution
                                  ? formatCurrency(
                                      Math.round(
                                        sssContribution.employeeShare * 100
                                      ) / 100
                                    )
                                  : formatCurrency(0)}
                              </span>
                            </HStack>

                            {/* PhilHealth Contribution Card */}
                            <HStack
                              justify="between"
                              align="center"
                              className="p-2 border rounded-lg bg-gray-50"
                            >
                              <VStack
                                gap="0"
                                align="start"
                                className="flex-1 min-w-0"
                              >
                                <span className="font-medium text-sm">
                                  PhilHealth
                                </span>
                                <Caption className="text-muted-foreground text-xs">
                                  2.5% of monthly salary
                                </Caption>
                              </VStack>
                              <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                {philhealthContribution
                                  ? formatCurrency(
                                      Math.round(
                                        philhealthContribution.employeeShare *
                                          100
                                      ) / 100
                                    )
                                  : formatCurrency(0)}
                              </span>
                            </HStack>

                            {/* Pag-IBIG Contribution Card */}
                            <HStack
                              justify="between"
                              align="center"
                              className="p-2 border rounded-lg bg-gray-50"
                            >
                              <VStack
                                gap="0"
                                align="start"
                                className="flex-1 min-w-0"
                              >
                                <span className="font-medium text-sm">
                                  Pag-IBIG
                                </span>
                                <Caption className="text-muted-foreground text-xs">
                                  ₱100 employee share
                                </Caption>
                              </VStack>
                              <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                {pagibigContribution
                                  ? formatCurrency(
                                      Math.round(
                                        pagibigContribution.employeeShare * 100
                                      ) / 100
                                    )
                                  : formatCurrency(0)}
                              </span>
                            </HStack>
                          </>
                        );
                      })()}

                      {(() => {
                        // Calculate withholding tax automatically
                        const workingDaysPerMonth = 22;
                        let monthlyBasicSalary = 0;

                        if (selectedEmployee?.monthly_rate) {
                          monthlyBasicSalary = selectedEmployee.monthly_rate;
                        } else if (selectedEmployee?.per_day) {
                          monthlyBasicSalary = calculateMonthlySalary(
                            selectedEmployee.per_day,
                            workingDaysPerMonth
                          );
                        } else if (selectedEmployee?.rate_per_day) {
                          monthlyBasicSalary = calculateMonthlySalary(
                            selectedEmployee.rate_per_day,
                            workingDaysPerMonth
                          );
                        }

                        // Deductions are applied monthly, so only calculate during second cutoff (day 16+)
                        const applyMonthlyDeductions = isSecondCutoff();

                        let withholdingTaxAmount = 0;
                        if (monthlyBasicSalary > 0 && applyMonthlyDeductions) {
                          // Calculate mandatory contributions
                          const sss = calculateSSS(monthlyBasicSalary);
                          const philhealth =
                            calculatePhilHealth(monthlyBasicSalary);
                          const pagibig = calculatePagIBIG(monthlyBasicSalary);

                          // Taxable income = gross salary minus mandatory contributions
                          const monthlyContributions =
                            sss.employeeShare +
                            philhealth.employeeShare +
                            pagibig.employeeShare;
                          const monthlyTaxableIncome =
                            monthlyBasicSalary - monthlyContributions;

                          // Calculate monthly withholding tax
                          const monthlyTax =
                            calculateWithholdingTax(monthlyTaxableIncome);
                          // Since deductions are applied once per month, use FULL monthly tax amount
                          withholdingTaxAmount =
                            Math.round(monthlyTax * 100) / 100;
                        }

                        // Use calculated tax if available, otherwise use from deductions
                        const finalTax =
                          withholdingTaxAmount > 0
                            ? withholdingTaxAmount
                            : deductions?.withholding_tax || 0;

                        return finalTax > 0 ? (
                          <HStack
                            justify="between"
                            align="center"
                            className="p-2 border rounded-lg bg-gray-50"
                          >
                            <VStack
                              gap="0"
                              align="start"
                              className="flex-1 min-w-0"
                            >
                              <span className="font-medium text-sm">Tax</span>
                              <Caption className="text-muted-foreground text-xs">
                                BIR TRAIN Law
                              </Caption>
                            </VStack>
                            <span className="font-semibold text-sm ml-2 flex-shrink-0">
                              {formatCurrency(finalTax)}
                            </span>
                          </HStack>
                        ) : null;
                      })()}
                    </div>
                  </VStack>
                </VStack>
              </CardSection>
            </div>
          )}

          {/* Payslip Summary - Below Both Sections */}
          {selectedEmployee && attendance && (
            <CardSection title="Payslip Summary">
              <VStack gap="2">
                <HStack
                  justify="between"
                  align="center"
                  className="text-sm w-full p-2 bg-gray-50 rounded"
                >
                  <span className="font-medium">Gross Pay:</span>
                  <span className="font-semibold">
                    {formatCurrency(grossPay)}
                  </span>
                </HStack>
                <HStack
                  justify="between"
                  align="center"
                  className="text-sm text-red-600 w-full p-2 bg-gray-50 rounded"
                >
                  <span className="font-medium">Total Deductions:</span>
                  <span className="font-semibold">
                    ({formatCurrency(totalDed)})
                  </span>
                </HStack>
                <div className="border-t-2 pt-2 w-full">
                  <HStack
                    justify="between"
                    align="center"
                    className="text-lg w-full"
                  >
                    <span className="font-bold">NET PAY:</span>
                    <span className="font-bold text-primary-700">
                      {formatCurrency(netPay)}
                    </span>
                  </HStack>
                </div>
              </VStack>

              <HStack justify="end" gap="2" className="mt-3">
                <Button
                  onClick={() => setShowPrintModal(true)}
                  variant="secondary"
                >
                  <Icon name="Eye" size={IconSizes.sm} />
                  Preview & Print Payslip
                </Button>
                {canAccessSalaryInfo && (
                  <Button onClick={generatePayslip} disabled={generating}>
                    <Icon name="FileText" size={IconSizes.sm} />
                    Save Payslip to Database
                  </Button>
                )}
              </HStack>
            </CardSection>
          )}

          {selectedEmployee && !attendance && (
            <Card>
              <CardContent className="text-center py-6">
                <VStack gap="2" align="center">
                  <Icon
                    name="FileText"
                    size={IconSizes.lg}
                    className="text-muted-foreground"
                  />
                  <H3 className="text-lg">No Attendance Record Found</H3>
                  <BodySmall className="text-xs">
                    The system attempted to generate attendance data from time
                    clock entries, but no data was found for this period.
                  </BodySmall>
                  <ul className="list-disc list-inside text-left text-xs text-muted-foreground space-y-0.5 mt-1">
                    <li>No time clock entries exist for this period</li>
                    <li>Time entries are incomplete (missing clock out)</li>
                    <li>Time entries need approval before they can be used</li>
                  </ul>
                  <BodySmall className="mt-2 text-xs">
                    Please check the Time Entries page to verify time attendance
                    records.
                  </BodySmall>
                  <HStack gap="2" justify="center" className="mt-2">
                    <Button
                      variant="secondary"
                      onClick={() => (window.location.href = "/time-entries")}
                    >
                      View Time Entries
                    </Button>
                  </HStack>
                </VStack>
              </CardContent>
            </Card>
          )}

          {/* Print Modal */}
          <Dialog open={showPrintModal} onOpenChange={setShowPrintModal}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              {selectedEmployee && attendance && (
                <>
                  <DialogHeader>
                    <DialogTitle>Payslip Preview</DialogTitle>
                  </DialogHeader>
                  <VStack gap="4">
                    <PayslipPrint
                      employee={{
                        employee_id: selectedEmployee.employee_id,
                        full_name: selectedEmployee.full_name,
                        rate_per_day:
                          selectedEmployee.per_day ||
                          selectedEmployee.rate_per_day ||
                          0,
                        rate_per_hour:
                          selectedEmployee.rate_per_hour ||
                          (selectedEmployee.per_day
                            ? selectedEmployee.per_day / 8
                            : 0),
                        position: selectedEmployee.position || null,
                        assigned_hotel: selectedEmployee.assigned_hotel || null,
                        deployed: selectedEmployee.deployed ?? null,
                      }}
                      weekStart={periodStart}
                      weekEnd={periodEnd}
                      attendance={attendance}
                      earnings={calculateEarningsBreakdown()}
                      deductions={{
                        vale: deductions?.vale_amount || 0,
                        sssLoan: deductions?.sss_salary_loan || 0,
                        sssCalamityLoan: deductions?.sss_calamity_loan || 0,
                        pagibigLoan: deductions?.pagibig_salary_loan || 0,
                        pagibigCalamityLoan:
                          deductions?.pagibig_calamity_loan || 0,
                        monthlyLoan: isFirstCutoff()
                          ? (monthlyLoans.sssLoan || 0) +
                            (monthlyLoans.pagibigLoan || 0) +
                            (monthlyLoans.companyLoan || 0) +
                            (monthlyLoans.emergencyLoan || 0) +
                            (monthlyLoans.otherLoan || 0)
                          : 0,
                        monthlyLoans: isFirstCutoff()
                          ? {
                              sssLoan: monthlyLoans.sssLoan || 0,
                              pagibigLoan: monthlyLoans.pagibigLoan || 0,
                              companyLoan: monthlyLoans.companyLoan || 0,
                              emergencyLoan: monthlyLoans.emergencyLoan || 0,
                              otherLoan: monthlyLoans.otherLoan || 0,
                            }
                          : undefined,
                        sssContribution: (() => {
                          // Deductions are applied monthly, so only calculate during second cutoff (day 16+)
                          const applyMonthlyDeductions = isSecondCutoff();
                          if (!applyMonthlyDeductions) return 0;

                          const workingDaysPerMonth = 22;
                          let monthlyBasicSalary = 0;

                          if (selectedEmployee?.monthly_rate) {
                            monthlyBasicSalary = selectedEmployee.monthly_rate;
                          } else if (selectedEmployee?.per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.per_day,
                              workingDaysPerMonth
                            );
                          } else if (selectedEmployee?.rate_per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.rate_per_day,
                              workingDaysPerMonth
                            );
                          }

                          if (monthlyBasicSalary > 0) {
                            const sssContribution =
                              calculateSSS(monthlyBasicSalary);
                            // Since deductions are applied once per month, use FULL monthly amount
                            return (
                              Math.round(sssContribution.employeeShare * 100) /
                              100
                            );
                          }
                          return 0;
                        })(),
                        philhealthContribution: (() => {
                          // Deductions are applied monthly, so only calculate during second cutoff (day 16+)
                          const applyMonthlyDeductions = isSecondCutoff();
                          if (!applyMonthlyDeductions) return 0;

                          const workingDaysPerMonth = 22;
                          let monthlyBasicSalary = 0;

                          if (selectedEmployee?.monthly_rate) {
                            monthlyBasicSalary = selectedEmployee.monthly_rate;
                          } else if (selectedEmployee?.per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.per_day,
                              workingDaysPerMonth
                            );
                          } else if (selectedEmployee?.rate_per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.rate_per_day,
                              workingDaysPerMonth
                            );
                          }

                          if (monthlyBasicSalary > 0) {
                            const philhealthContribution =
                              calculatePhilHealth(monthlyBasicSalary);
                            // Since deductions are applied once per month, use FULL monthly amount
                            return (
                              Math.round(
                                philhealthContribution.employeeShare * 100
                              ) / 100
                            );
                          }
                          return 0;
                        })(),
                        pagibigContribution: (() => {
                          // Deductions are applied monthly, so only calculate during second cutoff (day 16+)
                          const applyMonthlyDeductions = isSecondCutoff();
                          if (!applyMonthlyDeductions) return 0;

                          const workingDaysPerMonth = 22;
                          let monthlyBasicSalary = 0;

                          if (selectedEmployee?.monthly_rate) {
                            monthlyBasicSalary = selectedEmployee.monthly_rate;
                          } else if (selectedEmployee?.per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.per_day,
                              workingDaysPerMonth
                            );
                          } else if (selectedEmployee?.rate_per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.rate_per_day,
                              workingDaysPerMonth
                            );
                          }

                          // Pag-IBIG is fixed at ₱200/month regardless of salary
                          const pagibigContribution =
                            calculatePagIBIG(monthlyBasicSalary);
                          // Since deductions are applied once per month, use FULL monthly amount
                          return (
                            Math.round(
                              pagibigContribution.employeeShare * 100
                            ) / 100
                          );
                        })(),
                        withholdingTax: (() => {
                          // Deductions are applied monthly, so only calculate during second cutoff (day 16+)
                          const applyMonthlyDeductions = isSecondCutoff();
                          if (!applyMonthlyDeductions) return 0;

                          // Auto-calculate withholding tax
                          const workingDaysPerMonth = 22;
                          let monthlyBasicSalary = 0;

                          if (selectedEmployee?.monthly_rate) {
                            monthlyBasicSalary = selectedEmployee.monthly_rate;
                          } else if (selectedEmployee?.per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.per_day,
                              workingDaysPerMonth
                            );
                          } else if (selectedEmployee?.rate_per_day) {
                            monthlyBasicSalary = calculateMonthlySalary(
                              selectedEmployee.rate_per_day,
                              workingDaysPerMonth
                            );
                          }

                          if (monthlyBasicSalary > 0) {
                            const sss = calculateSSS(monthlyBasicSalary);
                            const philhealth =
                              calculatePhilHealth(monthlyBasicSalary);
                            const pagibig =
                              calculatePagIBIG(monthlyBasicSalary);

                            const monthlyContributions =
                              sss.employeeShare +
                              philhealth.employeeShare +
                              pagibig.employeeShare;
                            const monthlyTaxableIncome =
                              monthlyBasicSalary - monthlyContributions;
                            const monthlyTax =
                              calculateWithholdingTax(monthlyTaxableIncome);
                            // Since deductions are applied once per month, use FULL monthly tax amount
                            return Math.round(monthlyTax * 100) / 100;
                          }
                          return deductions?.withholding_tax || 0;
                        })(),
                        totalDeductions: totalDed,
                      }}
                      adjustment={adjustment}
                      netPay={netPay}
                      workingDays={calculateWorkingDays()}
                      absentDays={0}
                      preparedBy={preparedBy}
                    />
                    <DialogFooter className="print:hidden">
                      <Button
                        variant="secondary"
                        onClick={() => setShowPrintModal(false)}
                      >
                        Close
                      </Button>
                      <Button onClick={handlePrintPayslip}>
                        <Icon name="Printer" size={IconSizes.sm} />
                        Print Payslip
                      </Button>
                    </DialogFooter>
                  </VStack>
                </>
              )}
            </DialogContent>
          </Dialog>
        </VStack>
      </DashboardLayout>
    </>
  );
}
