"use client";

import { useEffect, useState, useMemo } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PayslipPrint } from "@/components/PayslipPrint";
import { PayslipDetailedBreakdown } from "@/components/PayslipDetailedBreakdown";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { calculateBasePay } from "@/utils/base-pay-calculator";
import {
  H1,
  H2,
  H3,
  H4,
  BodySmall,
  Caption,
} from "@/components/ui/typography";
import { Label } from "@/components/ui/label";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { format, addDays, getWeek, parseISO, startOfYear, endOfYear, startOfMonth } from "date-fns";
import { formatCurrency, generatePayslipNumber } from "@/utils/format";
import {
  calculateSSS,
  calculatePhilHealth,
  calculatePagIBIG,
  calculateMonthlySalary,
  calculateWithholdingTax,
  getWithholdingTaxBreakdown,
} from "@/utils/ph-deductions";
import { calculateWeeklyPayroll } from "@/utils/payroll-calculator";
import { getWeekOfMonth, normalizeHolidays } from "@/utils/holidays";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { generateTimesheetFromClockEntries } from "@/lib/timesheet-auto-generator";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { getSessionSafe, refreshSessionSafe } from "@/lib/session-utils";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  position?: string | null;
  eligible_for_ot?: boolean | null;
  assigned_hotel?: string | null;
  employee_type?: "office-based" | "client-based" | null;
  job_level?: string | null;
  hire_date?: string | null;
  termination_date?: string | null;
  transferred_from_employee_id?: string | null; // When transferred (new record), previous employees.id so OT is still loaded
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
  sss_wisp?: number; // WISP (Workers' Investment and Savings Program) - mandatory for MSC > PHP 20,000
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
}

export default function PayslipsPage() {
  const router = useRouter();
  const { canAccessSalaryInfo, canUpdatePayslip, loading: roleLoading } = useUserRole();
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
  const [holidays, setHolidays] = useState<Array<{ holiday_date: string }>>([]);
  const [restDaysMap, setRestDaysMap] = useState<Map<string, boolean>>(new Map());
  const [calculatedTotalGrossPay, setCalculatedTotalGrossPay] = useState<number | null>(null);

  // Debug: Log when calculatedTotalGrossPay changes
  useEffect(() => {
    console.log('[PayslipsPage] calculatedTotalGrossPay state updated:', calculatedTotalGrossPay);
  }, [calculatedTotalGrossPay]);

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

  // State for active loans with full details
  interface LoanDetail {
    id: string;
    loan_type: string;
    current_balance: number;
    monthly_payment: number;
    total_terms: number;
    remaining_terms: number;
    cutoff_assignment: string;
    deduction_amount: number; // Amount for this cutoff
  }

  const [activeLoans, setActiveLoans] = useState<LoanDetail[]>([]);

  // State for calculated monthly loans totals (for calculations)
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
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>("0");
  const [adjustmentReason, setAdjustmentReason] = useState<string>("");
  // First cutoff gross for same month (used for 2nd cutoff tax preview/calculation)
  const [firstCutoffGrossForTax, setFirstCutoffGrossForTax] = useState<number | null>(null);
  // Saved payslip for this employee + period (when exists, we display DB values and lock edits)
  const [savedPayslip, setSavedPayslip] = useState<{
    id: string;
    gross_pay: number;
    total_deductions: number;
    net_pay: number;
    adjustment_amount: number;
    adjustment_reason: string | null;
    deductions_breakdown: Record<string, unknown>;
    sss_amount: number;
    philhealth_amount: number;
    pagibig_amount: number;
    withholding_tax?: number;
  } | null>(null);
  const [showSavePayslipConfirm, setShowSavePayslipConfirm] = useState(false);
  const [showUpdatePayslipConfirm, setShowUpdatePayslipConfirm] = useState(false);

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
      // Reset adjustment so it doesn't carry over when switching employees
      setAdjustmentAmount("0");
      setAdjustmentReason("");
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

  // Load first cutoff gross for same month when in 2nd cutoff (for accurate tax preview)
  useEffect(() => {
    const second = periodStart.getDate() >= 16;
    if (!second || !selectedEmployee?.id) {
      setFirstCutoffGrossForTax(null);
      return;
    }
    let cancelled = false;
    const firstPeriodStart = startOfMonth(periodStart);
    const firstPeriodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth(), 15);
    supabase
      .from("payslips")
      .select("gross_pay, adjustment_amount")
      .eq("employee_id", selectedEmployee.id)
      .eq("period_start", format(firstPeriodStart, "yyyy-MM-dd"))
      .eq("period_end", format(firstPeriodEnd, "yyyy-MM-dd"))
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled) return;
          const gross = (data?.gross_pay ?? 0) + (data?.adjustment_amount ?? 0);
          setFirstCutoffGrossForTax(gross);
        },
        () => {
          if (!cancelled) setFirstCutoffGrossForTax(null);
        }
      );
    return () => { cancelled = true; };
  }, [selectedEmployee?.id, periodStart]);

  async function loadEmployees() {
    try {
      console.log("Loading employees for payslip generation...");
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_id, full_name, monthly_rate, per_day, position, eligible_for_ot, assigned_hotel, employee_type, job_level, hire_date, last_name, first_name, transferred_from_employee_id"
        )
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

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
        const mappedEmployees = data.map((emp: any) => {
          // Calculate rate_per_day: monthly_rate / 26 if monthly_rate exists, otherwise use per_day
          const ratePerDay = emp.monthly_rate
            ? emp.monthly_rate / 26
            : (emp.per_day || undefined);
          const ratePerHour = ratePerDay
            ? ratePerDay / 8
            : undefined;

          return {
            ...emp,
            rate_per_day: ratePerDay,
            rate_per_hour: ratePerHour,
          };
        });
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

      // Load saved payslip for this employee + period (if any). When present, we display DB values and lock edits.
      const { data: existingPayslipRow } = await supabase
        .from("payslips")
        .select("id, gross_pay, total_deductions, net_pay, adjustment_amount, adjustment_reason, deductions_breakdown, sss_amount, philhealth_amount, pagibig_amount")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .maybeSingle();

      if (existingPayslipRow) {
        const ded = (existingPayslipRow.deductions_breakdown as Record<string, unknown>) || {};
        setSavedPayslip({
          id: existingPayslipRow.id,
          gross_pay: existingPayslipRow.gross_pay,
          total_deductions: existingPayslipRow.total_deductions ?? 0,
          net_pay: existingPayslipRow.net_pay,
          adjustment_amount: existingPayslipRow.adjustment_amount ?? 0,
          adjustment_reason: existingPayslipRow.adjustment_reason,
          deductions_breakdown: ded,
          sss_amount: existingPayslipRow.sss_amount ?? 0,
          philhealth_amount: existingPayslipRow.philhealth_amount ?? 0,
          pagibig_amount: existingPayslipRow.pagibig_amount ?? 0,
          withholding_tax: typeof ded.tax === "number" ? ded.tax : 0,
        });
        setAdjustmentAmount(String(existingPayslipRow.adjustment_amount ?? 0));
        setAdjustmentReason(existingPayslipRow.adjustment_reason ?? "");
      } else {
        setSavedPayslip(null);
        setAdjustmentAmount("0");
        setAdjustmentReason("");
      }

      // Always generate from time clock entries to match timesheet data
      // Use time attendance sheet as reference (same as timesheet page)
      // This ensures payslip always matches what's shown in the timesheet
      let attData = null; // Don't use stored weekly_attendance - always regenerate from time_clock_entries

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

      // Create a map of leave dates with their leave types and half-day status
      // Prioritize SIL over other leave types when multiple leaves exist on the same date
      const leaveDatesMap = new Map<
        string,
        { leaveType: string; status: string; isHalfDay?: boolean }
      >();
      if (leaveData) {
        leaveData.forEach((leave: any) => {
          // Get half-day dates from the leave request
          const halfDayDatesSet = new Set<string>();
          if (leave.half_day_dates && Array.isArray(leave.half_day_dates)) {
            leave.half_day_dates.forEach((dateStr: string) => {
              halfDayDatesSet.add(dateStr);
            });
          }

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
                    isHalfDay: halfDayDatesSet.has(dateStr),
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
                    isHalfDay: halfDayDatesSet.has(dateStr),
                  });
                }
              }
              currentDate.setDate(currentDate.getDate() + 1);
            }
          }
        });
      }

      console.log("Leave dates map:", Array.from(leaveDatesMap.entries()));

      // Always generate from time clock entries to match timesheet data
      // Use time attendance sheet as reference (same as timesheet page)
      // This ensures payslip always matches what's shown in the timesheet
      // OT will come from approved OT requests (handled below)
      console.log(
        "Generating payslip from time clock entries (matching timesheet)..."
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
          const { data: holidaysData, error: holidaysError } = await supabase
            .from("holidays")
            .select("holiday_date, name, is_regular")
            .gte("holiday_date", periodStartStr)
            .lte("holiday_date", periodEndStr);

          if (holidaysError) {
            console.warn("Error loading holidays:", holidaysError);
          }

          // Normalize holidays to ensure consistent date format
          const normalizedHolidays = normalizeHolidays(
            (holidaysData || []).map((h: any) => ({
              date: h.holiday_date,
              name: h.name || "",
              type: h.is_regular ? "regular" : "non-working",
            }))
          );

          // Debug logging for December holidays
          if (periodStartStr.includes("12") || periodEndStr.includes("12")) {
            console.log("Holidays loaded for period:", {
              periodStart: periodStartStr,
              periodEnd: periodEndStr,
              holidaysCount: normalizedHolidays.length,
              decemberHolidays: normalizedHolidays.filter((h) =>
                h.date.includes("12-")
              ),
              allHolidays: normalizedHolidays,
            });
          }

          const holidays = normalizedHolidays.map((h) => ({
            holiday_date: h.date,
            holiday_type: h.type,
          }));
          setHolidays(holidays);

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
          setRestDaysMap(restDaysMap);

          // eligible_for_ot controls whether employee can FILE new OT; approved OT always shows on payslip
          const isEligibleForOT = selectedEmployee?.eligible_for_ot !== false;
          const includeApprovedOTInPayslip = true; // Always merge approved OT into payslip so it displays

          // Check if employee is Account Supervisor (for ND eligibility)
          // ND for rank and file only; 10PM–6AM during OT. Supervisory/managerial/client-based get no ND.
          const isAccountSupervisor =
            selectedEmployee?.position
              ?.toUpperCase()
              .includes("ACCOUNT SUPERVISOR") || false;
          const isOfficeBasedForND =
            selectedEmployee?.employee_type === "office-based" ||
            selectedEmployee?.employee_type === null;
          const supervisoryPositionsND = [
            "PAYROLL SUPERVISOR",
            "ACCOUNT RECEIVABLE SUPERVISOR",
            "HR OPERATIONS SUPERVISOR",
            "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT",
            "HR SUPERVISOR - LABOR RELATIONS",
            "HR SUPERVISOR-LABOR RELATIONS",
            "HR SUPERVISOR - EMPLOYEE ENGAGEMENT",
            "HR SUPERVISOR-EMPLOYEE ENGAGEMENT",
          ];
          const isSupervisoryForND =
            isOfficeBasedForND &&
            supervisoryPositionsND.some((pos) =>
              selectedEmployee?.position?.toUpperCase().includes(pos.toUpperCase())
            );
          const isManagerialForND =
            isOfficeBasedForND &&
            selectedEmployee?.job_level?.toUpperCase() === "MANAGERIAL";
          const isSupervisoryByJobLevelND =
            isOfficeBasedForND &&
            selectedEmployee?.job_level?.toUpperCase() === "SUPERVISORY";
          const isEligibleForAllowancesND =
            isAccountSupervisor ||
            isSupervisoryForND ||
            isSupervisoryByJobLevelND ||
            isManagerialForND;
          const isRankAndFileForND =
            isOfficeBasedForND && !isEligibleForAllowancesND;
          const isEligibleForNightDiff = isRankAndFileForND;
          const ndNightStartHour = 22; // 10PM – 6AM; ND only if OT overlaps this window (rank and file only)

          // Fetch approved overtime requests for this period
          // Always load approved OT (same as Time Attendance). Merge all approved OT into payslip
          // so already-approved OT always shows; eligible_for_ot only controls filing new OT requests.
          let approvedOTByDate = new Map<string, number>();
          let approvedNDByDate = new Map<string, number>();
          // Load OT for current employee and, if transferred, for predecessor so OT is not lost
          const transferredFromId = selectedEmployee?.transferred_from_employee_id ?? null;
          const employeeIdsToLoad = transferredFromId
            ? [selectedEmployeeId, transferredFromId]
            : [selectedEmployeeId];
          const { data: otRequests, error: otError } = await supabase
            .from("overtime_requests")
            .select("ot_date, end_date, start_time, end_time, total_hours")
            .in("employee_id", employeeIdsToLoad)
            .in("status", ["approved", "approved_by_manager", "approved_by_hr"])
            .gte("ot_date", periodStartStr)
            .lte("ot_date", periodEndStr);

          // Log each OT request and whether it falls 10PM–6AM Philippine (for ND check)
          const otRequestNDCheck: Array<{ ot_date: string; start_time: string; end_time: string; total_hours: number; ndHours: number; overlaps10pm6am: boolean }> = [];

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
                const newOT = existingOT + (ot.total_hours || 0);
                approvedOTByDate.set(dateStr, newOT);

                let ndHours = 0;
                // Calculate night differential from OT request: ND only when OT overlaps 10PM–6AM Philippine time
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

                  const nightStart = ndNightStartHour; // 10PM – 6AM Philippine time
                  const nightEnd = 6; // 6AM

                  // Convert times to minutes for easier calculation
                  const startTotalMin = startHour * 60 + startMin;
                  const endTotalMin = endHour * 60 + endMin;
                  const nightStartMin = nightStart * 60;
                  const nightEndMin = nightEnd * 60; // 6AM = 360 minutes

                  if (spansMidnight) {
                    // OT spans midnight: ND from max(start, nightStart) to midnight + midnight to min(end, 6AM)
                    const ndStartMin = Math.max(startTotalMin, nightStartMin);
                    const hoursToMidnight = (24 * 60 - ndStartMin) / 60;

                    let hoursFromMidnight = 0;
                    if (endTotalMin <= nightEndMin) {
                      hoursFromMidnight = endTotalMin / 60;
                    } else {
                      hoursFromMidnight = nightEndMin / 60;
                    }

                    ndHours = hoursToMidnight + hoursFromMidnight;
                  } else {
                    // OT on same day
                    if (startTotalMin >= nightStartMin) {
                      ndHours = (endTotalMin - startTotalMin) / 60;
                    } else if (endTotalMin >= nightStartMin) {
                      ndHours = (endTotalMin - nightStartMin) / 60;
                    }
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

                // Record for ND check log (all OT requests, with or without ND)
                otRequestNDCheck.push({
                  ot_date: dateStr,
                  start_time: ot.start_time ?? "",
                  end_time: ot.end_time ?? "",
                  total_hours: ot.total_hours ?? 0,
                  ndHours,
                  overlaps10pm6am: ndHours > 0,
                });
            });
            console.log("Approved OT requests by date:", approvedOTByDate);
            console.log("Approved ND by date:", approvedNDByDate);
          }

          // Map clock entries to match the generator function's expected format
          // IMPORTANT: Do NOT assign OT/ND hours to clock entries here - this causes double-counting
          // when multiple entries exist for the same date. The generator will handle OT/ND from
          // approvedOTByDate/approvedNDByDate maps directly.
          const mappedClockEntries = filteredClockEntries.map((entry: any) => {
            return {
              ...entry,
              // Keep original overtime_hours and total_night_diff_hours from database (usually 0)
              // The generator will use approvedOTByDate/approvedNDByDate maps instead
              overtime_hours: 0, // Reset to 0 - generator will use approvedOTByDate
              total_night_diff_hours: 0, // Reset to 0 - generator will use approvedNDByDate
            };
          });

          // Generate attendance data from mapped clock entries with rest days
          // Note: leaveDatesMap is already created above for existing attendance records
          // isAccountSupervisor and isEligibleForNightDiff are already defined above
          const isClientBasedAccountSupervisor =
            selectedEmployee?.employee_type === "client-based" &&
            (selectedEmployee?.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false);
          const isClientBased = selectedEmployee?.employee_type === "client-based" || false;

          const timesheetData = generateTimesheetFromClockEntries(
            mappedClockEntries as any,
            periodStart,
            periodEnd,
            holidays,
            restDaysMap,
            true, // Always include approved OT on payslip (eligible_for_ot only gates filing new OT)
            isEligibleForNightDiff,
            isClientBasedAccountSupervisor,
            approvedOTByDate, // Pass approved OT hours map
            approvedNDByDate, // Pass approved ND hours map
            isClientBased // Pass general client-based flag for Saturday/Sunday logic
          );

          // Update attendance_data to include leave days
          // Only SIL (Sick Leave) counts as a working day (8 hours for full-day, 4 hours for half-day)
          // All other leaves are not paid and not recorded as a working day
          timesheetData.attendance_data = timesheetData.attendance_data.map(
            (day: any) => {
              const leaveInfo = leaveDatesMap.get(day.date);
              if (leaveInfo) {
                // If this day has an approved leave request
                if (leaveInfo.leaveType === "SIL") {
                  // SIL (Sick Leave) counts as working day
                  // Full-day: 8 hours, Half-day: 4 hours
                  const silHours = leaveInfo.isHalfDay ? 4 : 8;
                  // Set regularHours and dayType to "regular" for SIL leaves
                  // This ensures they count as working days even if there are no clock entries
                  return {
                    ...day,
                    regularHours: silHours, // 8 hours for full-day, 4 hours for half-day
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
            const workingDaysPerMonth = 26;

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

      // Load employee loans for this period
      try {
        // Clear loans first to prevent stale data
        setActiveLoans([]);
        setMonthlyLoans({
          sssLoan: 0,
          pagibigLoan: 0,
          companyLoan: 0,
          emergencyLoan: 0,
          otherLoan: 0,
        });

        const { data: loansData, error: loansError } = await supabase
          .from("employee_loans")
          .select("*")
          .eq("employee_id", selectedEmployeeId)
          .eq("is_active", true)
          .lte("effectivity_date", periodEndStr)
          .gt("current_balance", 0);

        if (loansError) {
          console.warn("Error loading loans:", loansError);
        }

        // Calculate loan deductions based on cutoff and effectivity date
        let companyLoanAmount = 0;
        let sssCalamityLoanAmount = 0;
        let pagibigCalamityLoanAmount = 0;
        let sssLoanAmount = 0;
        let pagibigLoanAmount = 0;
        let emergencyLoanAmount = 0;
        let otherLoanAmount = 0;

        const loanDetails: LoanDetail[] = [];

        if (loansData && loansData.length > 0) {
          const currentCutoff = isFirstCutoff() ? "first" : "second";

          console.log("Loan filtering:", {
            periodStart: periodStartStr,
            periodEnd: periodEndStr,
            currentCutoff,
            totalLoans: loansData.length,
          });

          loansData.forEach((loan: any) => {
            // Check if loan should be deducted in this cutoff
            // cutoff_assignment controls which cutoff(s) to deduct in:
            // - "first": deducts in first cutoff only (500 if monthly payment is 1,000)
            // - "second": deducts in second cutoff only (500 if monthly payment is 1,000)
            // - "both": deducts in both cutoffs (500 + 500 = 1,000/month total)
            // All loans are deducted bi-monthly (monthly_payment / 2 per cutoff)
            const shouldDeduct =
              loan.cutoff_assignment === "both" ||
              loan.cutoff_assignment === currentCutoff;

            console.log(`Loan ${loan.id} (${loan.loan_type}):`, {
              cutoff_assignment: loan.cutoff_assignment,
              currentCutoff,
              shouldDeduct,
              effectivity_date: loan.effectivity_date,
              periodEnd: periodEndStr,
            });

            if (shouldDeduct) {
              // Calculate payment amount based on deduct_bi_monthly flag
              // If deduct_bi_monthly is true: divide by 2 for bi-monthly deductions (e.g., 1,000/month = 500 per cutoff)
              // If deduct_bi_monthly is false: use full monthly payment per cutoff
              const paymentAmount = loan.deduct_bi_monthly !== false
                ? loan.monthly_payment / 2
                : loan.monthly_payment;

              // Store loan detail for display
              loanDetails.push({
                id: loan.id,
                loan_type: loan.loan_type,
                current_balance: parseFloat(loan.current_balance),
                monthly_payment: parseFloat(loan.monthly_payment),
                total_terms: loan.total_terms,
                remaining_terms: loan.remaining_terms,
                cutoff_assignment: loan.cutoff_assignment,
                deduction_amount: paymentAmount,
              });

              switch (loan.loan_type) {
                case "company":
                  companyLoanAmount += paymentAmount;
                  break;
                case "sss_calamity":
                  sssCalamityLoanAmount += paymentAmount;
                  break;
                case "pagibig_calamity":
                  pagibigCalamityLoanAmount += paymentAmount;
                  break;
                case "sss":
                  sssLoanAmount += paymentAmount;
                  break;
                case "pagibig":
                  pagibigLoanAmount += paymentAmount;
                  break;
                case "emergency":
                  emergencyLoanAmount += paymentAmount;
                  break;
                case "other":
                  otherLoanAmount += paymentAmount;
                  break;
              }
            }
          });
        }

        // Update active loans for display (only loans that should be deducted)
        setActiveLoans(loanDetails);

        console.log("Final loan details:", {
          loanDetailsCount: loanDetails.length,
          loanDetails: loanDetails.map((l) => ({
            type: l.loan_type,
            cutoff: l.cutoff_assignment,
            amount: l.deduction_amount,
          })),
        });

        // Update monthlyLoans state with calculated loan amounts (for calculations)
        setMonthlyLoans({
          sssLoan: sssLoanAmount + sssCalamityLoanAmount, // Combine SSS loans
          pagibigLoan: pagibigLoanAmount + pagibigCalamityLoanAmount, // Combine Pagibig loans
          companyLoan: companyLoanAmount,
          emergencyLoan: emergencyLoanAmount,
          otherLoan: otherLoanAmount,
        });

        console.log("Monthly loans calculated:", {
          companyLoan: companyLoanAmount,
          sssLoan: sssLoanAmount + sssCalamityLoanAmount,
          pagibigLoan: pagibigLoanAmount + pagibigCalamityLoanAmount,
        });
      } catch (loansError: any) {
        console.error("Error processing loans:", loansError);
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
        setDeductions({
          vale_amount: 0,
          sss_salary_loan: 0,
          sss_calamity_loan: 0,
          pagibig_salary_loan: 0,
          pagibig_calamity_loan: 0,
          sss_contribution: 0,
          philhealth_contribution: 0,
          pagibig_contribution: 0,
          withholding_tax: 0,
        });
      } catch (dedErr) {
        console.error("Exception loading deductions:", dedErr);
        setDeductions({
          vale_amount: 0,
          sss_salary_loan: 0,
          sss_calamity_loan: 0,
          pagibig_salary_loan: 0,
          pagibig_calamity_loan: 0,
          sss_contribution: 0,
          philhealth_contribution: 0,
          pagibig_contribution: 0,
          withholding_tax: 0,
        });
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

  // Function to update loan balances and terms after payslip is saved
  async function updateLoanBalancesAndTerms(
    periodStart: Date,
    periodEnd: Date
  ) {
    if (!selectedEmployeeId) {
      console.log("No employee selected, skipping loan update");
      return;
    }

    const currentCutoff = isFirstCutoff() ? "first" : "second";
    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const periodEndStr = format(periodEnd, "yyyy-MM-dd");

    console.log("Updating loan balances for period:", {
      periodStart: periodStartStr,
      periodEnd: periodEndStr,
      currentCutoff,
      employeeId: selectedEmployeeId,
    });

    try {
      // Reload loans from database to ensure we have the latest data
      // Only get loans that should be deducted in this cutoff
      const { data: loansData, error: loansError } = await supabase
        .from("employee_loans")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("is_active", true)
        .lte("effectivity_date", periodEndStr)
        .gt("current_balance", 0)
        .or(`cutoff_assignment.eq.both,cutoff_assignment.eq.${currentCutoff}`);

      if (loansError) {
        console.error("Error loading loans for update:", loansError);
        return;
      }

      if (!loansData || loansData.length === 0) {
        console.log("No active loans found for this period and cutoff");
        return;
      }

      console.log(`Found ${loansData.length} loan(s) to update`);

      // Update each loan that should be deducted in this cutoff
      for (const loanRecord of loansData) {
        // Verify cutoff assignment matches (already filtered in query, but double-check)
        // @ts-ignore - employee_loans table type may not be in generated types
        const shouldDeduct =
          (loanRecord as any).cutoff_assignment === "both" ||
          (loanRecord as any).cutoff_assignment === currentCutoff;

        if (!shouldDeduct) {
          console.log(
            `Loan ${(loanRecord as any).id} cutoff assignment (${
              (loanRecord as any).cutoff_assignment
            }) doesn't match current cutoff (${currentCutoff}), skipping`
          );
          continue;
        }

        // Calculate deduction amount based on deduct_bi_monthly flag
        // If deduct_bi_monthly is true: divide by 2 for bi-monthly deductions (e.g., 1,000/month = 500 per cutoff)
        // If deduct_bi_monthly is false: use full monthly payment per cutoff
        const deductBiMonthly = (loanRecord as any).deduct_bi_monthly !== false;
        const deductionAmount = deductBiMonthly
          ? parseFloat((loanRecord as any).monthly_payment) / 2
          : parseFloat((loanRecord as any).monthly_payment);

        console.log(`Processing loan ${(loanRecord as any).id}:`, {
          loan_type: (loanRecord as any).loan_type,
          current_balance: (loanRecord as any).current_balance,
          remaining_terms: (loanRecord as any).remaining_terms,
          deduction_amount: deductionAmount,
          cutoff_assignment: (loanRecord as any).cutoff_assignment,
        });

        // Get current values as numbers
        const currentBalance = parseFloat((loanRecord as any).current_balance);
        const currentRemainingTerms = parseInt(
          (loanRecord as any).remaining_terms
        );

        // Calculate new balance (ensure it doesn't go below 0)
        const newBalance = Math.max(0, currentBalance - deductionAmount);

        // Calculate terms reduction based on deduct_bi_monthly flag
        // If deduct_bi_monthly is true: reduce by 0.5 terms per cutoff (full term completed after both cutoffs)
        // If deduct_bi_monthly is false: reduce by 1.0 term per cutoff (full term completed in one cutoff)
        const termsReduction = deductBiMonthly ? 0.5 : 1.0;
        const newRemainingTerms = Math.max(
          0,
          currentRemainingTerms - termsReduction
        );

        // If balance reaches 0 or terms reach 0, mark loan as inactive
        const shouldDeactivate =
          newBalance <= 0.01 || Math.ceil(newRemainingTerms) <= 0;

        // Update loan record
        const updateData: any = {
          current_balance: Math.round(newBalance * 100) / 100, // Round to 2 decimal places
          remaining_terms: Math.ceil(newRemainingTerms), // Round up to nearest integer
          updated_at: new Date().toISOString(),
        };

        if (shouldDeactivate) {
          updateData.is_active = false;
          updateData.current_balance = 0; // Ensure balance is exactly 0
          updateData.remaining_terms = 0; // Ensure terms is exactly 0
        }

        const { error: updateError } = await supabase
          // @ts-ignore - employee_loans table type may not be in generated types
          .from("employee_loans")
          // @ts-ignore - employee_loans table type may not be in generated types
          .update(updateData)
          .eq("id", (loanRecord as any).id);

        if (updateError) {
          console.error(
            `Error updating loan ${(loanRecord as any).id}:`,
            updateError
          );
          toast.error(
            `Failed to update loan ${(loanRecord as any).loan_type}: ${
              updateError.message
            }`
          );
        } else {
          console.log(
            `✅ Loan ${(loanRecord as any).id} (${
              (loanRecord as any).loan_type
            }) updated:`,
            `Balance ₱${currentBalance} -> ₱${updateData.current_balance},`,
            `Terms ${currentRemainingTerms} -> ${updateData.remaining_terms}`,
            shouldDeactivate ? "(deactivated)" : ""
          );
        }
      }
    } catch (error: any) {
      console.error("Error updating loan balances:", error);
      // Don't throw - we don't want to fail payslip generation if loan update fails
      toast.error("Warning: Loan balances may not have been updated correctly");
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
          (selectedEmployee.monthly_rate
            ? selectedEmployee.monthly_rate / 26 / 8
            : selectedEmployee.per_day
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

      // Gross = basic + OT + ND + adjustment. Statutory and tax use monthly gross (2 × cutoff gross).
      const adjustment = parseFloat(adjustmentAmount) || 0;
      const periodGross = grossPay + adjustment;
      const monthlyGross =
        periodGross > 0 ? Math.round(periodGross * 2 * 100) / 100 : 0;

      // Monthly salary from rate only (per day × 26). For statutory and 13th month.
      const workingDaysPerMonth = 26;
      let monthlyBasicSalary = 0;
      if (selectedEmployee.monthly_rate) {
        monthlyBasicSalary = selectedEmployee.monthly_rate;
      } else if (selectedEmployee.per_day) {
        monthlyBasicSalary = calculateMonthlySalary(
          selectedEmployee.per_day,
          workingDaysPerMonth
        );
      } else if (selectedEmployee.rate_per_day) {
        monthlyBasicSalary = calculateMonthlySalary(
          selectedEmployee.rate_per_day,
          workingDaysPerMonth
        );
      }

      // Statutory (SSS, PhilHealth, Pag-IBIG) based on monthly salary only, not gross pay
      const validMonthlySalary =
        monthlyBasicSalary && monthlyBasicSalary > 0 ? monthlyBasicSalary : 0;
      const validMonthlyGross =
        monthlyGross && monthlyGross > 0 ? monthlyGross : 0;

      const sssContribution = calculateSSS(validMonthlySalary);
      const philhealthContribution = calculatePhilHealth(validMonthlySalary);
      const pagibigContribution = calculatePagIBIG(validMonthlySalary);

      // Deduction frequencies (per sample): SSS & PhilHealth = semi-monthly (half each cutoff); Pag-IBIG & Withholding tax = end of month (2nd cutoff only)
      const applyFirstCutoff = isFirstCutoff();
      const applySecondCutoff = isSecondCutoff();

      // Note: Only employee shares are deducted
      // SSS - semi-monthly: half on 1st cutoff, half on 2nd cutoff
      const sssHalfMonthly = !isNaN(sssContribution?.employeeShare) ? sssContribution.employeeShare / 2 : 0;
      const sssRegularHalf = !isNaN(sssContribution?.regularEmployeeShare) ? sssContribution.regularEmployeeShare / 2 : 0;
      const sssWispHalf = (sssContribution?.wispEmployeeShare ?? 0) / 2;
      const sssRegularAmount =
        (applyFirstCutoff || applySecondCutoff)
          ? Math.round(sssRegularHalf * 100) / 100
          : 0;
      const sssWispAmount =
        (applyFirstCutoff || applySecondCutoff) && sssWispHalf > 0
          ? Math.round(sssWispHalf * 100) / 100
          : 0;
      const sssAmount =
        (applyFirstCutoff || applySecondCutoff)
          ? Math.round(sssHalfMonthly * 100) / 100
          : 0;
      // PhilHealth - semi-monthly: half on 1st cutoff, half on 2nd cutoff
      const philhealthAmount =
        (applyFirstCutoff || applySecondCutoff) && !isNaN(philhealthContribution?.employeeShare)
          ? Math.round((philhealthContribution.employeeShare / 2) * 100) / 100
          : 0;
      // Pag-IBIG - end of month: full amount on 2nd cutoff only
      const pagibigAmount =
        applySecondCutoff && !isNaN(pagibigContribution?.employeeShare)
          ? Math.round(pagibigContribution.employeeShare * 100) / 100
          : 0;

      // Weekly deductions (always applied) - default to 0 if no deduction record
      // Loan deductions are now calculated from employee_loans table based on effectivity date and cutoff
      let totalDeductions =
        (deductions?.vale_amount || 0) +
        (deductions?.sss_salary_loan || 0) +
        (deductions?.sss_calamity_loan || 0) +
        (deductions?.pagibig_salary_loan || 0) +
        (deductions?.pagibig_calamity_loan || 0) +
        // Add loan deductions based on cutoff assignment
        (isFirstCutoff()
          ? (monthlyLoans.sssLoan || 0) +
            (monthlyLoans.pagibigLoan || 0) +
            (monthlyLoans.companyLoan || 0) +
            (monthlyLoans.emergencyLoan || 0) +
            (monthlyLoans.otherLoan || 0)
          : isSecondCutoff()
          ? (monthlyLoans.pagibigLoan || 0) + // Only loans assigned to "both" or "second" cutoff
            (monthlyLoans.companyLoan || 0)
          : 0);

      // Add mandatory government contributions: SSS & PhilHealth semi-monthly (half each); Pag-IBIG end of month (2nd only)
      totalDeductions += sssAmount + philhealthAmount + pagibigAmount;

      // Withholding tax: end of month (2nd cutoff only). Use actual monthly gross (1st + 2nd cutoff) when available.
      let withholdingTax = 0;
      if (applySecondCutoff && (validMonthlyGross > 0 || periodGross > 0)) {
        withholdingTax = deductions?.withholding_tax || 0;
        if (withholdingTax === 0) {
          const monthlyContributions =
            sssContribution.employeeShare +
            philhealthContribution.employeeShare +
            pagibigContribution.employeeShare;

          // Actual monthly gross = 1st cutoff gross + this period gross (when 1st cutoff payslip exists)
          const firstPeriodStart = startOfMonth(periodStart);
          const firstPeriodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth(), 15);
          const { data: firstCutoffPayslip } = await supabase
            .from("payslips")
            .select("gross_pay, adjustment_amount")
            .eq("employee_id", selectedEmployee.id)
            .eq("period_start", format(firstPeriodStart, "yyyy-MM-dd"))
            .eq("period_end", format(firstPeriodEnd, "yyyy-MM-dd"))
            .maybeSingle();

          const firstCutoffGross =
            (firstCutoffPayslip?.gross_pay ?? 0) + (firstCutoffPayslip?.adjustment_amount ?? 0);
          const actualMonthlyGross =
            firstCutoffGross > 0
              ? Math.round((firstCutoffGross + periodGross) * 100) / 100
              : validMonthlyGross;

          const monthlyTaxableIncome =
            Math.max(0, actualMonthlyGross - monthlyContributions);
          const monthlyTax = calculateWithholdingTax(monthlyTaxableIncome);
          // Full month's tax is deducted in 2nd cutoff
          withholdingTax = Math.round(monthlyTax * 100) / 100;

          console.log("Withholding tax calculation:", {
            firstCutoffGross,
            periodGross,
            actualMonthlyGross,
            contributions: monthlyContributions,
            taxableIncome: monthlyTaxableIncome,
            calculatedMonthlyTax: monthlyTax,
            withholdingTax,
          });
        }
      }
      totalDeductions += withholdingTax;

      const allowance = 0;

      // Net pay = (Gross + adjustment) - total deductions; adjustment already in periodGross above
      const netPay = periodGross - totalDeductions;

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
      deductionsBreakdown.sss = sssRegularAmount; // Regular SSS only (MSC up to PHP 20,000)
      deductionsBreakdown.sss_wisp = sssWispAmount; // WISP shown separately if applicable
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

      // Calculate 13th month pay
      // In the Philippines, 13th month pay = 1/12 of basic salary per month worked
      // Per DOLE ruling (COCLA vs San Miguel), SIL (Service Incentive Leave) should NOT be included
      // Usually paid in December, but can be prorated throughout the year
      let thirteenthMonthPay = 0;
      const currentMonth = periodStart.getMonth(); // 0-11 (Jan = 0, Dec = 11)
      const currentYear = periodStart.getFullYear();

      // Check if this is December (month 11) or if HR wants to include it
      // For now, auto-calculate only in December
      if (currentMonth === 11) { // December
        // Calculate months worked in the current year
        const hireDate = selectedEmployee.hire_date
          ? new Date(selectedEmployee.hire_date)
          : null;

        let monthsWorked = 12; // Default to full year

        if (hireDate) {
          const hireYear = hireDate.getFullYear();
          const hireMonth = hireDate.getMonth();

          if (hireYear === currentYear) {
            // Employee started this year - prorate from hire month
            monthsWorked = 12 - hireMonth; // Months from hire month to December (inclusive)
          } else if (hireYear < currentYear) {
            // Employee started in a previous year - full year
            monthsWorked = 12;
          } else {
            // Future hire date (shouldn't happen)
            monthsWorked = 0;
          }
        }

        // Calculate 13th month pay based on monthly basic salary, excluding SIL days
        // Per DOLE ruling COCLA vs San Miguel: SIL should NOT be included in 13th month calculation
        if (validMonthlySalary > 0 && monthsWorked > 0) {
          // Get all approved SIL leave requests for the current year
          const yearStart = startOfYear(new Date(currentYear, 0, 1));
          const yearEnd = endOfYear(new Date(currentYear, 11, 31));

          const { data: yearLeaves } = await supabase
            .from("leave_requests")
            .select("start_date, end_date, selected_dates, total_days, half_day_dates, leave_type, status")
            .eq("employee_id", selectedEmployee.id)
            .eq("status", "approved")
            .eq("leave_type", "SIL")
            .gte("start_date", format(yearStart, "yyyy-MM-dd"))
            .lte("end_date", format(yearEnd, "yyyy-MM-dd"));

          // Count total SIL days used in the year (only count days within the year)
          // Half-day leaves count as 0.5 days, full-day leaves count as 1.0 day
          let totalSILDays = 0;
          if (yearLeaves && yearLeaves.length > 0) {
            yearLeaves.forEach((leave: any) => {
              // Get half-day dates set
              const halfDayDatesSet = new Set<string>();
              if (leave.half_day_dates && Array.isArray(leave.half_day_dates)) {
                leave.half_day_dates.forEach((dateStr: string) => {
                  halfDayDatesSet.add(dateStr);
                });
              }

              if (leave.selected_dates && Array.isArray(leave.selected_dates)) {
                // Count only dates within the year, accounting for half-day
                leave.selected_dates.forEach((dateStr: string) => {
                  if (dateStr >= format(yearStart, "yyyy-MM-dd") && dateStr <= format(yearEnd, "yyyy-MM-dd")) {
                    // Check if this date is half-day (0.5) or full-day (1.0)
                    if (halfDayDatesSet.has(dateStr)) {
                      totalSILDays += 0.5;
                    } else {
                      totalSILDays += 1.0;
                    }
                  }
                });
              } else if (leave.start_date && leave.end_date) {
                // Count days within the year range, accounting for half-day
                const start = parseISO(leave.start_date);
                const end = parseISO(leave.end_date);
                const actualStart = start > yearStart ? start : yearStart;
                const actualEnd = end < yearEnd ? end : yearEnd;
                if (actualStart <= actualEnd) {
                  let currentDate = new Date(actualStart);
                  while (currentDate <= actualEnd) {
                    const dateStr = format(currentDate, "yyyy-MM-dd");
                    if (halfDayDatesSet.has(dateStr)) {
                      totalSILDays += 0.5;
                    } else {
                      totalSILDays += 1.0;
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                  }
                }
              } else if (leave.total_days) {
                // Fallback: use total_days if available (already accounts for half-day)
                totalSILDays += Number(leave.total_days);
              }
            });
          }

          // Calculate daily rate (monthly salary was computed with 26 days)
          const workingDaysPerMonth = 26;
          const dailyRate = validMonthlySalary / workingDaysPerMonth;

          // Calculate 13th month pay
          // Formula: (monthly basic salary / 12) × months worked - (SIL days × daily rate / 12)
          // This excludes SIL from 13th month calculation per DOLE ruling
          const baseThirteenthMonth = (validMonthlySalary / 12) * monthsWorked;
          const silDeduction = (totalSILDays * dailyRate) / 12;
          thirteenthMonthPay = Math.max(0, baseThirteenthMonth - silDeduction);

          // Round to 2 decimal places
          thirteenthMonthPay = Math.round(thirteenthMonthPay * 100) / 100;
        }
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
        thirteenth_month_pay: thirteenthMonthPay,
        adjustment_amount: adjustment,
        adjustment_reason: adjustmentReason || null,
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
      // Use safe session utility to prevent rate limits
      let authSession = null;
      try {
        authSession = await getSessionSafe();

        // Only attempt refresh if no session (safe utility handles rate limits)
        if (!authSession) {
          console.warn("⚠️ No session found, attempting to refresh...");
          authSession = await refreshSessionSafe();
        }
      } catch (error: any) {
        // Handle errors gracefully (safe utilities already handle rate limits)
        console.error("Session check error:", error?.message || error);
      }

      console.log("🔐 Payslip Save - Auth Status:", {
        hasSession: !!authSession,
        userId: authSession?.user?.id || null,
        userEmail: authSession?.user?.email || null,
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

      // Check if payslip already exists and load adjustments if present
      const { data: existing, error: checkError } = await supabase
        .from("payslips")
        .select("id, payslip_number, adjustment_amount, adjustment_reason")
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
        adjustment_amount?: number | null;
        adjustment_reason?: string | null;
      } | null;

      // Load adjustments from existing payslip if present
      if (existingPayslip) {
        if (existingPayslip.adjustment_amount !== null && existingPayslip.adjustment_amount !== undefined) {
          setAdjustmentAmount(existingPayslip.adjustment_amount.toString());
        }
        if (existingPayslip.adjustment_reason) {
          setAdjustmentReason(existingPayslip.adjustment_reason);
        }
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

        // Update loan balances and terms after payslip is saved
        await updateLoanBalancesAndTerms(periodStart, periodEnd);

        // Reload attendance and loans to refresh UI with updated balances
        await loadAttendanceAndDeductions();

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

        // Update loan balances and terms after payslip is saved
        await updateLoanBalancesAndTerms(periodStart, periodEnd);

        // Reload attendance and loans to refresh UI with updated balances
        await loadAttendanceAndDeductions();

        toast.success("Payslip generated and saved successfully");
      }
    } catch (error: any) {
      console.error("Error generating payslip:", error);
      toast.error(error.message || "Failed to generate payslip");
    } finally {
      setGenerating(false);
    }
  }

  // Memoize periodEnd calculation
  const periodEnd = useMemo(() => getBiMonthlyPeriodEnd(periodStart), [periodStart]);

  // Memoize working days calculation to ensure it recalculates when holidays are loaded
  // This fixes the issue where on first load, holidays might be empty [], causing incorrect calculation
  // The calculation will automatically re-run when holidays state updates
  // IMPORTANT: This hook MUST be called before any conditional returns to follow React Rules of Hooks
  const workingDays = useMemo(() => {
    if (!attendance || !attendance.attendance_data || !selectedEmployee) return 0;
    const days = attendance.attendance_data as any[];

    // Use base pay method: (104 hours - absences × 8) / 8
    // This matches both timesheet and PayslipDetailedBreakdown calculations
    // Base logic: 104 hours per cutoff (13 days × 8 hours), then subtract absences

    try {
      // Extract clock entries from attendance data
      const clockEntries = days
        .filter((day) => day.clockInTime && day.clockOutTime)
        .map((day) => ({
          clock_in_time: day.clockInTime!,
          clock_out_time: day.clockOutTime!,
        }));

      // Get rest days and holidays - use state restDaysMap if available, otherwise create empty map
      const restDaysForCalculation = restDaysMap.size > 0 ? restDaysMap : new Map<string, boolean>();
      const holidaysList = holidays.map((h) => ({ holiday_date: h.holiday_date }));

      // Calculate base pay using the same method as PayslipDetailedBreakdown
      const basePayResult = calculateBasePay({
        periodStart,
        periodEnd: periodEnd,
        clockEntries,
        restDays: restDaysForCalculation,
        holidays: holidaysList,
        isClientBased: selectedEmployee.employee_type === "client-based" || false,
        hireDate: selectedEmployee.hire_date ? parseISO(selectedEmployee.hire_date) : undefined,
        terminationDate: undefined, // termination_date doesn't exist in employees table
      });

      // Days Work = (104 - absences × 8) / 8
      return basePayResult.finalBaseHours / 8;
    } catch (error) {
      console.error("Error calculating working days:", error);
      // Fallback: return 0 if calculation fails
      return 0;
    }
  }, [attendance, selectedEmployee, periodStart, periodEnd, holidays, restDaysMap]);

  // Memoize expensive gross pay calculation
  const grossPay = useMemo(() => {
    let calculatedGrossPay = attendance?.gross_pay || 0;

    // If we have attendance_data, recalculate to ensure accuracy (especially for AS/Office-based)
    if (
      attendance?.attendance_data &&
      Array.isArray(attendance.attendance_data) &&
      selectedEmployee
    ) {
      const ratePerHour =
        selectedEmployee.rate_per_hour ||
        (selectedEmployee.per_day
          ? selectedEmployee.per_day / 8
          : selectedEmployee.rate_per_day
          ? selectedEmployee.rate_per_day / 8
          : 0);

      if (ratePerHour > 0) {
        try {
          // Use calculateWeeklyPayroll as base calculation
          const payrollResult = calculateWeeklyPayroll(
            attendance.attendance_data,
            ratePerHour
          );

          // Check if employee is Account Supervisor or eligible for allowances
          const isAccountSupervisor =
            selectedEmployee.position
              ?.toUpperCase()
              .includes("ACCOUNT SUPERVISOR") || false;
          const isClientBased = selectedEmployee.employee_type === "client-based";
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
            selectedEmployee.employee_type === "office-based" &&
            supervisoryPositions.some((pos) =>
              selectedEmployee.position?.toUpperCase().includes(pos.toUpperCase())
            );
          const isManagerial =
            selectedEmployee.employee_type === "office-based" &&
            selectedEmployee.job_level?.toUpperCase() === "MANAGERIAL";
          const isSupervisoryByJobLevel =
            selectedEmployee.employee_type === "office-based" &&
            selectedEmployee.job_level?.toUpperCase() === "SUPERVISORY";
          const isEligibleForAllowances =
            isAccountSupervisor || isSupervisory || isSupervisoryByJobLevel || isManagerial;
          const useFixedAllowances = isClientBased || isEligibleForAllowances;

          // Calculate base gross pay from standard calculations
          let grossPayValue = Math.round(payrollResult.grossPay * 100) / 100;

          // For Account Supervisors/Office-based employees, add fixed allowances
          if (useFixedAllowances) {
            let totalFixedAllowances = 0;

            // Calculate fixed allowances from attendance data
            attendance.attendance_data.forEach((day: any) => {
              const dayType = day.dayType || "regular";
              const overtimeHours =
                typeof day.overtimeHours === "string"
                  ? parseFloat(day.overtimeHours)
                  : day.overtimeHours || 0;

              // Regular OT allowance
              if (dayType === "regular" && overtimeHours > 0) {
                // Client-based employees and Office-based Supervisory/Managerial: First 2 hours = ₱200, then ₱100 per succeeding hour
                if (isClientBased || isAccountSupervisor || isEligibleForAllowances) {
                  if (overtimeHours >= 2) {
                    // First 2 hours = ₱200, then ₱100 per succeeding hour
                    const allowance = 200 + Math.max(0, overtimeHours - 2) * 100;
                    totalFixedAllowances += allowance;
                  }
                }
              }

              // Holiday/Rest Day OT allowance
              const isHolidayOrRestDay =
                dayType === "sunday" ||
                dayType === "regular-holiday" ||
                dayType === "non-working-holiday" ||
                dayType === "sunday-special-holiday" ||
                dayType === "sunday-regular-holiday";

              if (isHolidayOrRestDay && overtimeHours > 0) {
                if (overtimeHours >= 8) {
                  totalFixedAllowances += 700;
                } else if (overtimeHours >= 4) {
                  totalFixedAllowances += 350;
                }
              }

              // Holiday/Rest Day allowance for REGULAR HOURS worked (not OT)
              // This applies if employee worked regular hours on holiday/rest day
              const regularHours = day.regularHours || 0;
              if (isHolidayOrRestDay && regularHours > 0) {
                // Allowance for regular hours worked on holiday/rest day: ₱700 for ≥8 hours, ₱350 for ≥4 hours
                if (regularHours >= 8) {
                  totalFixedAllowances += 700;
                } else if (regularHours >= 4) {
                  totalFixedAllowances += 350;
                }
              }
            });

            // Helper function to check "1 Day Before" rule for holidays
            const isEligibleForHolidayPay = (
              currentDate: string,
              currentRegularHours: number,
              attendanceData: Array<any>
            ): boolean => {
              // If employee worked on the holiday itself, they get daily rate regardless
              if (currentRegularHours > 0) {
                return true;
              }

              // If they didn't work on the holiday, check if they worked a REGULAR WORKING DAY before
              // Search up to 7 days back to find the last REGULAR WORKING DAY (skip holidays and rest days)
              const currentDateObj = new Date(currentDate);
              for (let i = 1; i <= 7; i++) {
                const checkDateObj = new Date(currentDateObj);
                checkDateObj.setDate(checkDateObj.getDate() - i);
                const checkDateStr = checkDateObj.toISOString().split("T")[0];

                // Find the day in attendance data
                const checkDay = attendanceData.find(
                  (day: any) => day.date === checkDateStr
                );

                if (checkDay) {
                  // Only count REGULAR WORKING DAYS (skip holidays and rest days)
                  if (
                    checkDay.dayType === "regular" &&
                    (checkDay.regularHours || 0) >= 8
                  ) {
                    return true; // Found a regular working day with 8+ hours
                  }
                }
              }

              return false;
            };

            // Calculate basic pay (regular days only, excluding holidays)
            let basicPay = 0;
            let holidayRestDayPay = 0;
            attendance.attendance_data.forEach((day: any) => {
              const dayType = day.dayType || "regular";
              const regularHours = day.regularHours || 0;
              const date = day.date || "";
              const ratePerHour =
                selectedEmployee.rate_per_hour ||
                (selectedEmployee.per_day
                  ? selectedEmployee.per_day / 8
                  : selectedEmployee.rate_per_day
                  ? selectedEmployee.rate_per_day / 8
                  : 0);

              if (dayType === "regular") {
                // Regular days: standard calculation
                // Saturday Regular Work Day: Pay 8 hours even if employee didn't work (paid 6 days/week per law)
                const dateObj = new Date(date);
                const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
                if (dayOfWeek === 6 && regularHours === 0) {
                  // Saturday with no work - regular work day: pay 8 hours at regular rate
                  basicPay += 8 * ratePerHour;
                } else {
                  // Regular day with work - pay actual hours (includes Saturday if worked)
                  basicPay += regularHours * ratePerHour;
                }
              } else if (
                dayType === "regular-holiday" ||
                dayType === "non-working-holiday"
              ) {
                // For holidays: Check "1 Day Before" rule
                const eligibleForHolidayPay = isEligibleForHolidayPay(
                  date,
                  regularHours,
                  attendance.attendance_data
                );

                if (eligibleForHolidayPay) {
                  // Determine hours to pay: if worked on holiday, use actual hours; if didn't work but eligible, use 8 hours (daily rate)
                  const hoursToPay = regularHours > 0 ? regularHours : 8;
                  // For Account Supervisors: Holidays are paid at 1.0x (daily rate, no multiplier)
                  holidayRestDayPay += hoursToPay * ratePerHour;
                }
              } else if (
                dayType === "sunday" ||
                dayType === "sunday-special-holiday" ||
                dayType === "sunday-regular-holiday"
              ) {
                // For Rest Days (Sunday is the designated rest day for office-based employees):
                // Account Supervisors/Supervisory: Only pay if they actually worked on rest day (no automatic 8 hours)
                if (regularHours > 0) {
                  // For Account Supervisors: Rest Days are paid at 1.0x (daily rate, no multiplier) only if worked
                  holidayRestDayPay += regularHours * ratePerHour;
                }
              }
            });

            // Gross Pay = Basic Pay (regular days) + Holiday/Rest Day Pay (at 1.0x) + Fixed Allowances
            grossPayValue = basicPay + holidayRestDayPay + totalFixedAllowances;
          }

          calculatedGrossPay = Math.round(grossPayValue * 100) / 100;

          // If the recalculated value differs significantly from stored value, use recalculated
          // This handles cases where attendance.gross_pay might be stale
          if (
            attendance.gross_pay &&
            Math.abs(calculatedGrossPay - attendance.gross_pay) > 0.01
          ) {
            // Use recalculated value if it's more accurate
            calculatedGrossPay = Math.round(grossPayValue * 100) / 100;
          }
        } catch (calcError) {
          console.error("Error recalculating gross pay:", calcError);
          // Fallback to stored value
          calculatedGrossPay = attendance?.gross_pay || 0;
        }
      }
    }

    return calculatedGrossPay;
  }, [attendance, selectedEmployee]);

  // Memoize deductions calculations
  const weeklyDed = useMemo(() => {
    return (
      (deductions?.vale_amount || 0) +
      (deductions?.sss_salary_loan || 0) +
      (deductions?.sss_calamity_loan || 0) +
      (deductions?.pagibig_salary_loan || 0) +
      (deductions?.pagibig_calamity_loan || 0) +
      // Include loans for both cutoffs based on their cutoff_assignment
      (isFirstCutoff()
        ? (monthlyLoans.sssLoan || 0) +
          (monthlyLoans.pagibigLoan || 0) +
          (monthlyLoans.companyLoan || 0) +
          (monthlyLoans.emergencyLoan || 0) +
          (monthlyLoans.otherLoan || 0)
        : isSecondCutoff()
        ? (monthlyLoans.pagibigLoan || 0) +
          (monthlyLoans.companyLoan || 0) +
          (monthlyLoans.emergencyLoan || 0) +
          (monthlyLoans.otherLoan || 0) +
          (monthlyLoans.sssLoan || 0)
        : 0)
    );
  }, [deductions, monthlyLoans, periodStart]);

  // Monthly salary from employee rate only (for statutory: SSS, PhilHealth, Pag-IBIG). Per day × 26.
  const monthlySalary = useMemo(() => {
    const workingDaysPerMonth = 26;
    if (selectedEmployee?.monthly_rate) return selectedEmployee.monthly_rate;
    if (selectedEmployee?.per_day)
      return calculateMonthlySalary(selectedEmployee.per_day, workingDaysPerMonth);
    if (selectedEmployee?.rate_per_day)
      return calculateMonthlySalary(selectedEmployee.rate_per_day, workingDaysPerMonth);
    return 0;
  }, [selectedEmployee?.monthly_rate, selectedEmployee?.per_day, selectedEmployee?.rate_per_day]);

  // Statutory: SSS & PhilHealth = semi-monthly (half each cutoff); Pag-IBIG & Tax = end of month (2nd cutoff only)
  const govDed = useMemo(() => {
    if (monthlySalary <= 0) return 0;
    const first = isFirstCutoff();
    const second = isSecondCutoff();
    const sssContribution = calculateSSS(monthlySalary);
    const philhealthContribution = calculatePhilHealth(monthlySalary);
    const pagibigContribution = calculatePagIBIG(monthlySalary);

    const sssMonthly = isNaN(sssContribution?.employeeShare)
      ? 0
      : sssContribution.employeeShare;
    const philhealthMonthly = isNaN(philhealthContribution?.employeeShare)
      ? 0
      : philhealthContribution.employeeShare;
    const pagibigAmt = isNaN(pagibigContribution?.employeeShare)
      ? 0
      : Math.round(pagibigContribution.employeeShare * 100) / 100;

    const sssHalf = Math.round((sssMonthly / 2) * 100) / 100;
    const philhealthHalf = Math.round((philhealthMonthly / 2) * 100) / 100;
    return (first ? sssHalf + philhealthHalf : 0) + (second ? sssHalf + philhealthHalf + pagibigAmt : 0);
  }, [monthlySalary, periodStart]);

  // Withholding tax: end of month (2nd cutoff only). Use actual monthly gross (1st + 2nd cutoff) when available; full month tax.
  const tax = useMemo(() => {
    if (!isSecondCutoff()) return 0;
    const adj = parseFloat(adjustmentAmount || "0") || 0;
    const periodGross =
      calculatedTotalGrossPay !== null && calculatedTotalGrossPay >= 0
        ? calculatedTotalGrossPay + adj
        : 0;
    const actualMonthlyGross =
      firstCutoffGrossForTax !== null
        ? (firstCutoffGrossForTax + periodGross)
        : periodGross * 2;

    if (actualMonthlyGross > 0) {
      const taxFromDeductions = deductions?.withholding_tax || 0;
      if (taxFromDeductions === 0) {
        const sss = calculateSSS(monthlySalary);
        const philhealth = calculatePhilHealth(monthlySalary);
        const pagibig = calculatePagIBIG(monthlySalary);

        const monthlyContributions =
          sss.employeeShare + philhealth.employeeShare + pagibig.employeeShare;
        const monthlyTaxableIncome = Math.max(0, actualMonthlyGross - monthlyContributions);

        const monthlyTax = calculateWithholdingTax(monthlyTaxableIncome);
        return Math.round(monthlyTax * 100) / 100;
      }
      return taxFromDeductions;
    }
    return 0;
  }, [calculatedTotalGrossPay, adjustmentAmount, monthlySalary, deductions, periodStart, firstCutoffGrossForTax]);

  // Adjustment - included in gross for statutory, tax, and display
  const adjustment = parseFloat(adjustmentAmount) || 0;
  const allowance = 0;

  // Memoize total deductions
  const totalDed = useMemo(() => {
    return weeklyDed + govDed + tax;
  }, [weeklyDed, govDed, tax]);

  // Gross pay = earnings + adjustment (adjustment included in gross)
  const finalGrossPay = useMemo(() => {
    const base =
      calculatedTotalGrossPay !== null && calculatedTotalGrossPay >= 0
        ? calculatedTotalGrossPay
        : 0;
    return base + adjustment;
  }, [calculatedTotalGrossPay, adjustment]);

  // Net pay = gross (incl. adjustment) − total deductions
  const netPay = useMemo(() => {
    return finalGrossPay - totalDed;
  }, [finalGrossPay, totalDed]);

  // When a payslip is already saved for this period, display saved values (and lock edits)
  const displayGrossPay = savedPayslip ? savedPayslip.gross_pay : finalGrossPay;
  const displayTotalDed = savedPayslip ? savedPayslip.total_deductions : totalDed;
  const displayNetPay = savedPayslip ? savedPayslip.net_pay : netPay;
  const isSavedPayslip = savedPayslip !== null;

  // Show loading or access denied - MUST be after all hooks
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
                  You do not have permission to access the payslip management
                  page. Please contact your administrator if you need access.
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

  // Debug: Log finalGrossPay calculation
  console.log('[PayslipsPage] finalGrossPay calculation:', {
    calculatedTotalGrossPay,
    finalGrossPay,
    totalDed,
    netPay: finalGrossPay - totalDed,
  });

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

  // Show access denied message if user doesn't have permission - MUST be after all hooks
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
                  You do not have permission to access the payslip management
                  page. Please contact your administrator if you need access.
                </BodySmall>
                <Button onClick={() => router.push("/dashboard")}>
                  Go to Dashboard
                </Button>
              </VStack>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
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

              {/* Employee Selection - search by name or employee ID */}
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
                    Go to Employees
                  </Button>
                ) : (
                  <EmployeeSearchSelect
                    employees={employees.map((e) => ({
                      id: e.id,
                      employee_id: e.employee_id,
                      full_name: e.full_name ?? "",
                      first_name: e.first_name,
                      last_name: e.last_name,
                    }))}
                    value={selectedEmployeeId}
                    onValueChange={setSelectedEmployeeId}
                    showAllOption={false}
                    placeholder="Search by name or employee ID..."
                    triggerClassName="h-8 w-[200px]"
                  />
                )}
                <Caption className="text-muted-foreground">
                  {employees.length === 0
                    ? "No employees loaded. Open Employees to manage your roster."
                    : "Search and select an employee to view or generate their payslip."}
                </Caption>
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
                Array.isArray(attendance.attendance_data) &&
                attendance.attendance_data.length > 0 &&
                (selectedEmployee.per_day || selectedEmployee.rate_per_day) &&
                (selectedEmployee.rate_per_hour || selectedEmployee.per_day) && (
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
                            selectedEmployee.monthly_rate
                              ? selectedEmployee.monthly_rate / 26
                              : selectedEmployee.per_day ||
                                selectedEmployee.rate_per_day ||
                                0,
                          rate_per_hour:
                            selectedEmployee.rate_per_hour ||
                            (selectedEmployee.monthly_rate
                              ? selectedEmployee.monthly_rate / 26 / 8
                              : selectedEmployee.per_day
                              ? selectedEmployee.per_day / 8
                              : 0),
                          position: selectedEmployee.position || null,
                          assigned_hotel:
                            selectedEmployee.assigned_hotel || null,
                          employee_type: selectedEmployee.employee_type ?? null,
                          job_level: selectedEmployee.job_level ?? null,
                          hire_date: (selectedEmployee as any).hire_date || null,
                          termination_date: (selectedEmployee as any).termination_date || null,
                        }}
                        periodStart={periodStart}
                        periodEnd={periodEnd}
                        restDays={restDaysMap}
                        holidays={holidays}
                        onTotalGrossPayChange={(value) => {
                          console.log('[PayslipsPage] onTotalGrossPayChange callback called with:', value);
                          setCalculatedTotalGrossPay(value);
                        }}
                        attendanceData={Array.isArray(attendance.attendance_data)
                          ? (attendance.attendance_data as any[]).map((day: any) => {
                              const dayDate =
                                day.date || day.clock_in_time?.split("T")[0] || "";

                              // Find matching clock entry for this date (use Asia/Manila timezone)
                              const matchingEntry = clockEntries.find((entry) => {
                                if (!entry.clock_in_time) return false;
                                const entryDateUTC = new Date(entry.clock_in_time);
                                const formatter = new Intl.DateTimeFormat("en-US", {
                                  timeZone: "Asia/Manila",
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                });
                                const parts = formatter.formatToParts(entryDateUTC);
                                const entryDateStr = `${parts.find((p) => p.type === "year")!.value}-${
                                  parts.find((p) => p.type === "month")!.value
                                }-${parts.find((p) => p.type === "day")!.value}`;
                                return entryDateStr === dayDate;
                              });

                              // ND for rank and file only (same rule as payslip generation)
                              const isOfficeBasedND =
                                selectedEmployee?.employee_type === "office-based" ||
                                selectedEmployee?.employee_type === null;
                              const isASND =
                                selectedEmployee?.position?.toUpperCase().includes("ACCOUNT SUPERVISOR") || false;
                              const supervisoryListND = [
                                "PAYROLL SUPERVISOR",
                                "ACCOUNT RECEIVABLE SUPERVISOR",
                                "HR OPERATIONS SUPERVISOR",
                                "HR SUPERVISOR - LABOR RELATIONS/EMPLOYEE ENGAGEMENT",
                                "HR SUPERVISOR - LABOR RELATIONS",
                                "HR SUPERVISOR-LABOR RELATIONS",
                                "HR SUPERVISOR - EMPLOYEE ENGAGEMENT",
                                "HR SUPERVISOR-EMPLOYEE ENGAGEMENT",
                              ];
                              const isSupervisoryND =
                                isOfficeBasedND &&
                                supervisoryListND.some((p) =>
                                  selectedEmployee?.position?.toUpperCase().includes(p.toUpperCase())
                                );
                              const isManagerialND =
                                isOfficeBasedND &&
                                selectedEmployee?.job_level?.toUpperCase() === "MANAGERIAL";
                              const isSupervisoryByJobND =
                                isOfficeBasedND &&
                                selectedEmployee?.job_level?.toUpperCase() === "SUPERVISORY";
                              const isEligibleAllowancesND =
                                isASND || isSupervisoryND || isSupervisoryByJobND || isManagerialND;
                              const isRankAndFileND = isOfficeBasedND && !isEligibleAllowancesND;

                              // If day.regularHours is >= 8, it's likely a leave day - prioritize it over clock entry hours
                              const isLeaveDayWithFullHours =
                                (day.regularHours || 0) >= 8;
                              const regularHours = isLeaveDayWithFullHours
                                ? day.regularHours
                                : matchingEntry?.regular_hours ||
                                  day.regularHours ||
                                  0;

                              // ND for rank and file only, and only when OT overlaps 10PM–6AM (from approved OT).
                              // Do not use matchingEntry.total_night_diff_hours — DB trigger uses 5PM–6AM; payslip uses 10PM–6AM during OT only.
                              return {
                                date: dayDate,
                                dayType: day.dayType || "regular",
                                regularHours: regularHours,
                                overtimeHours: day.overtimeHours || 0,
                                nightDiffHours: isRankAndFileND
                                  ? (day.nightDiffHours || 0)
                                  : 0,
                                clockInTime:
                                  matchingEntry?.clock_in_time ||
                                  day.clockInTime ||
                                  day.clock_in_time,
                                clockOutTime:
                                  matchingEntry?.clock_out_time ||
                                  day.clockOutTime ||
                                  day.clock_out_time,
                              };
                            })
                          : []}
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
                      {/* Monthly Loans - Auto-loaded from active loans (shows for both cutoffs) */}
                      {activeLoans.length > 0 && (
                        <div className="w-full pt-2 border-t border-gray-200">
                          <BodySmall className="font-medium mb-2 block">
                            Monthly Loans:
                          </BodySmall>
                          <VStack gap="3" className="w-full">
                            {activeLoans.map((loan) => {
                              const loanTypeLabel =
                                loan.loan_type === "company"
                                  ? "Company Loan"
                                  : loan.loan_type === "sss_calamity"
                                  ? "SSS Calamity Loan"
                                  : loan.loan_type === "pagibig_calamity"
                                  ? "Pagibig Calamity Loan"
                                  : loan.loan_type === "sss"
                                  ? "SSS Loan"
                                  : loan.loan_type === "pagibig"
                                  ? "Pag-IBIG Loan"
                                  : loan.loan_type === "emergency"
                                  ? "Emergency Loan"
                                  : "Other Loan";

                              const termsPaid =
                                loan.total_terms - loan.remaining_terms;

                              return (
                                <div
                                  key={loan.id}
                                  className="w-full p-2 bg-gray-50 rounded border border-gray-200"
                                >
                                  <HStack
                                    justify="between"
                                    align="start"
                                    className="w-full mb-1"
                                  >
                                    <BodySmall className="text-gray-700 font-medium">
                                      {loanTypeLabel}:
                                    </BodySmall>
                                    <div className="text-right">
                                      <span className="font-semibold text-red-600 text-sm">
                                        {formatCurrency(loan.deduction_amount)}
                                      </span>
                                    </div>
                                  </HStack>
                                  <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                                    <div>
                                      <span className="text-gray-500">
                                        Remaining Balance:
                                      </span>
                                      <span className="ml-1 font-medium">
                                        {formatCurrency(loan.current_balance)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-500">
                                        Terms Paid:
                                      </span>
                                      <span className="ml-1 font-medium">
                                        {termsPaid} / {loan.total_terms}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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

                  {/* Adjustments */}
                  <VStack gap="2" align="start">
                    <H4 className="text-sm font-medium text-muted-foreground">
                      Adjustments
                    </H4>
                    <VStack
                      gap="2"
                      className="bg-gray-50 p-3 rounded-lg w-full"
                    >
                      <div className="w-full">
                        <Label htmlFor="adjustment_amount" className="text-sm">
                          Adjustment Amount
                        </Label>
                        <Input
                          id="adjustment_amount"
                          type="number"
                          step="0.01"
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(e.target.value)}
                          placeholder="0.00"
                          className="mt-1"
                          readOnly={isSavedPayslip}
                          disabled={isSavedPayslip}
                        />
                        <Caption className="text-xs text-gray-500 mt-1">
                          Enter positive amount to add to net pay, negative amount to deduct from net pay
                        </Caption>
                      </div>
                      <div className="w-full">
                        <Label htmlFor="adjustment_reason" className="text-sm">
                          Reason (Optional)
                        </Label>
                        <Input
                          id="adjustment_reason"
                          type="text"
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          placeholder="e.g., Correction for previous period, Bonus, etc."
                          className="mt-1"
                          readOnly={isSavedPayslip}
                          disabled={isSavedPayslip}
                        />
                      </div>
                      {(parseFloat(adjustmentAmount) || 0) !== 0 && (
                        <div className="border-t pt-2 mt-2 w-full">
                          <HStack
                            justify="between"
                            align="center"
                            className="w-full"
                          >
                            <BodySmall className="font-medium">
                              Adjustment:
                            </BodySmall>
                            <span
                              className={`font-semibold text-sm ${
                                (parseFloat(adjustmentAmount) || 0) >= 0
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatCurrency(parseFloat(adjustmentAmount) || 0)}
                            </span>
                          </HStack>
                        </div>
                      )}
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
                        // SSS & PhilHealth: semi-monthly (half each cutoff). Pag-IBIG & Tax: end of month (2nd only).
                        const applyFirst = isFirstCutoff();
                        const applySecond = isSecondCutoff();

                        const sssContribution =
                          monthlySalary > 0 && (applyFirst || applySecond)
                            ? calculateSSS(monthlySalary)
                            : null;
                        const philhealthContribution =
                          monthlySalary > 0 && (applyFirst || applySecond)
                            ? calculatePhilHealth(monthlySalary)
                            : null;
                        const pagibigContribution =
                          monthlySalary > 0 && applySecond
                            ? calculatePagIBIG(monthlySalary)
                            : null;

                        const sssHalf = sssContribution
                          ? Math.round((sssContribution.employeeShare / 2) * 100) / 100
                          : 0;
                        const sssRegularHalf = sssContribution
                          ? Math.round((sssContribution.regularEmployeeShare / 2) * 100) / 100
                          : 0;
                        const sssWispHalf = sssContribution?.wispEmployeeShare
                          ? Math.round((sssContribution.wispEmployeeShare / 2) * 100) / 100
                          : 0;
                        const philhealthHalf = philhealthContribution
                          ? Math.round((philhealthContribution.employeeShare / 2) * 100) / 100
                          : 0;

                        return (
                          <>
                            {monthlySalary > 0 && (applyFirst || applySecond) && (
                                <div className="p-2 border rounded-lg bg-blue-50 border-blue-200 col-span-2">
                                  <BodySmall className="text-blue-700 text-xs">
                                    Based on monthly salary:{" "}
                                    {formatCurrency(monthlySalary)}
                                    {". SSS & PhilHealth: semi-monthly (half each). Pag-IBIG & Tax: end of month (2nd cutoff)."}
                                  </BodySmall>
                                </div>
                              )}
                            {/* SSS Contribution Card - semi-monthly: half per cutoff */}
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
                                  SSS (Regular)
                                </span>
                              </VStack>
                              <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                {formatCurrency(sssRegularHalf)}
                              </span>
                            </HStack>
                            {/* WISP Contribution Card (only if applicable) - semi-monthly half */}
                            {sssWispHalf > 0 && (
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
                                      SSS WISP
                                    </span>
                                  </VStack>
                                  <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                    {formatCurrency(sssWispHalf)}
                                  </span>
                                </HStack>
                              )}

                            {/* PhilHealth Contribution Card - semi-monthly: half per cutoff */}
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
                                  2.5% employee share (semi-monthly: half)
                                </Caption>
                              </VStack>
                              <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                {formatCurrency(philhealthHalf)}
                              </span>
                            </HStack>

                            {/* Pag-IBIG Contribution Card - end of month (2nd cutoff only) */}
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
                                  Fixed ₱200.00 per month (end of month)
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
                        // Tax: 2nd cutoff only; actual monthly gross (1st + 2nd) when available, full month tax
                        if (!isSecondCutoff()) return null;
                        const adj = parseFloat(adjustmentAmount || "0") || 0;
                        const periodGross =
                          calculatedTotalGrossPay !== null &&
                          calculatedTotalGrossPay >= 0
                            ? calculatedTotalGrossPay + adj
                            : 0;
                        const actualMonthlyGross =
                          firstCutoffGrossForTax !== null
                            ? firstCutoffGrossForTax + periodGross
                            : periodGross * 2;

                        let withholdingTaxAmount = 0;
                        let taxBreakdown: ReturnType<typeof getWithholdingTaxBreakdown> | null = null;
                        let monthlyContributionsUsed = 0;
                        if (actualMonthlyGross > 0) {
                          const sss = calculateSSS(monthlySalary);
                          const philhealth =
                            calculatePhilHealth(monthlySalary);
                          const pagibig = calculatePagIBIG(monthlySalary);

                          monthlyContributionsUsed =
                            sss.employeeShare +
                            philhealth.employeeShare +
                            pagibig.employeeShare;
                          const monthlyTaxableIncome =
                            Math.max(0, actualMonthlyGross - monthlyContributionsUsed);

                          taxBreakdown = getWithholdingTaxBreakdown(monthlyTaxableIncome);
                          withholdingTaxAmount = taxBreakdown.withholdingTax;
                        }

                        const finalTax =
                          withholdingTaxAmount > 0
                            ? withholdingTaxAmount
                            : deductions?.withholding_tax || 0;

                        return (
                          <VStack gap="1" className="p-2 border rounded-lg bg-gray-50">
                            <HStack justify="between" align="center" className="w-full">
                              <VStack gap="0" align="start" className="flex-1 min-w-0">
                                <span className="font-medium text-sm">Tax</span>
                                <Caption className="text-muted-foreground text-xs">
                                  BIR Monthly table (Jan 1, 2023). Taxable = Gross − SSS − PhilHealth − Pag-IBIG.
                                </Caption>
                              </VStack>
                              <span className="font-semibold text-sm ml-2 flex-shrink-0">
                                {formatCurrency(finalTax)}
                              </span>
                            </HStack>
                            {taxBreakdown && taxBreakdown.withholdingTax > 0 && (
                              <div className="text-[10px] text-muted-foreground border-t border-gray-200 pt-1.5 mt-0.5 space-y-0.5">
                                <div>
                                  Monthly gross: {formatCurrency(actualMonthlyGross)}
                                  {firstCutoffGrossForTax !== null && (
                                    <span className="text-gray-500"> (1st: {formatCurrency(firstCutoffGrossForTax)} + 2nd: {formatCurrency(periodGross)})</span>
                                  )}
                                </div>
                                <div>Less monthly contributions (SSS + PhilHealth + Pag-IBIG): {formatCurrency(monthlyContributionsUsed)}</div>
                                <div className="font-medium">Taxable income: {formatCurrency(taxBreakdown.taxableIncome)}</div>
                                <div>BIR Range {taxBreakdown.rangeIndex}: {taxBreakdown.rangeLabel}</div>
                                <div>
                                  {taxBreakdown.prescribedTax > 0 && `${formatCurrency(taxBreakdown.prescribedTax)} + `}
                                  {taxBreakdown.ratePercent}% × {formatCurrency(taxBreakdown.excessAmount)} = {formatCurrency(taxBreakdown.taxOnExcess)}
                                  {taxBreakdown.prescribedTax > 0 && ` = ${formatCurrency(taxBreakdown.withholdingTax)}`}
                                </div>
                                {taxBreakdown.prescribedTax === 0 && (
                                  <div className="font-medium text-gray-700">Withholding tax: {formatCurrency(taxBreakdown.withholdingTax)}</div>
                                )}
                              </div>
                            )}
                          </VStack>
                        );
                      })()}
                    </div>
                  </VStack>
                </VStack>
              </CardSection>
            </div>
          )}

          {/* Payslip Summary - Below Both Sections (uses saved values when payslip already saved) */}
          {selectedEmployee && attendance && (
            <CardSection title="Payslip Summary">
              {isSavedPayslip && (
                <>
                  <div className="mb-2 px-2 py-1.5 rounded bg-green-50 border border-green-200 text-xs text-green-800">
                    This payslip has been saved. Values below are from the database. Adjustments cannot be edited.
                  </div>
                  {savedPayslip && (() => {
                    const earnings = calculatedTotalGrossPay ?? 0;
                    const savedAdj = savedPayslip.adjustment_amount;
                    const impliedDiff = Math.round((savedPayslip.gross_pay - earnings - savedAdj) * 100) / 100;
                    const showImplied = Math.abs(impliedDiff) > 0.01;
                    return (
                      <div className="mb-2 px-2 py-1.5 rounded bg-gray-50 border border-gray-200 text-xs text-gray-700 space-y-1">
                        <div className="font-medium text-gray-800">Why is Gross Pay {formatCurrency(displayGrossPay)}?</div>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex justify-between">
                            <span>Earnings (this period):</span>
                            <span>{formatCurrency(earnings)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Adjustment (saved in DB):</span>
                            <span className={savedAdj >= 0 ? "text-green-600" : "text-red-600"}>
                              {savedAdj >= 0 ? "+" : ""}{formatCurrency(savedAdj)}
                            </span>
                          </div>
                          {showImplied && (
                            <div className="flex justify-between text-amber-700">
                              <span>Difference (included in saved gross):</span>
                              <span>{impliedDiff >= 0 ? "+" : ""}{formatCurrency(impliedDiff)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-gray-300 pt-1 font-medium">
                            <span>Gross pay (saved):</span>
                            <span>{formatCurrency(earnings + savedAdj + (showImplied ? impliedDiff : 0))}</span>
                          </div>
                        </div>
                        {showImplied && (
                          <div className="mt-1 text-amber-700 text-[10px]">
                            {impliedDiff > 0
                              ? `The saved gross is ${formatCurrency(impliedDiff)} more than Earnings + Adjustment. This may have been saved as part of gross when the payslip was created.`
                              : `The saved gross is ${formatCurrency(Math.abs(impliedDiff))} less than Earnings + Adjustment (${formatCurrency(earnings)}). If the second cutoff gross should match current earnings, the saved value may need to be corrected.`}
                          </div>
                        )}
                        {savedPayslip.adjustment_reason && (
                          <div className="mt-1 text-gray-600">
                            Reason: {savedPayslip.adjustment_reason}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </>
              )}
              <VStack gap="2">
                <HStack
                  justify="between"
                  align="center"
                  className="text-sm w-full p-2 bg-gray-50 rounded"
                >
                  <span className="font-medium">Gross Pay:</span>
                  <span className="font-semibold">
                    {formatCurrency(displayGrossPay)}
                  </span>
                </HStack>
                <HStack
                  justify="between"
                  align="center"
                  className="text-sm text-red-600 w-full p-2 bg-gray-50 rounded"
                >
                  <span className="font-medium">Total Deductions:</span>
                  <span className="font-semibold">
                    ({formatCurrency(displayTotalDed)})
                  </span>
                </HStack>
                {(parseFloat(adjustmentAmount) || 0) !== 0 && (
                  <HStack
                    justify="between"
                    align="center"
                    className={`text-sm w-full p-2 bg-gray-50 rounded ${
                      (parseFloat(adjustmentAmount) || 0) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    <span className="font-medium">Adjustments:</span>
                    <span className="font-semibold">
                      {formatCurrency(parseFloat(adjustmentAmount) || 0)}
                    </span>
                  </HStack>
                )}
                <div className="border-t-2 pt-2 w-full">
                  <HStack
                    justify="between"
                    align="center"
                    className="text-lg w-full"
                  >
                    <span className="font-bold">NET PAY:</span>
                    <span className="font-bold text-primary-700">
                      {formatCurrency(displayNetPay)}
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
                  isSavedPayslip ? (
                    <HStack gap="2">
                      <Button disabled className="opacity-80" variant="secondary">
                        <Icon name="CheckCircle" size={IconSizes.sm} />
                        Payslip saved
                      </Button>
                      {canUpdatePayslip && (
                        <Button
                          onClick={() => setShowUpdatePayslipConfirm(true)}
                          disabled={generating}
                          variant="default"
                        >
                          <Icon name="FloppyDisk" size={IconSizes.sm} />
                          Update payslip
                        </Button>
                      )}
                    </HStack>
                  ) : (
                    <Button onClick={() => setShowSavePayslipConfirm(true)} disabled={generating}>
                      <Icon name="FileText" size={IconSizes.sm} />
                      Save Payslip to Database
                    </Button>
                  )
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
                        employee_type: selectedEmployee.employee_type ?? null,
                        job_level: selectedEmployee.job_level ?? null,
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
                          if (!isFirstCutoff() && !isSecondCutoff()) return 0;
                          if (monthlySalary > 0) {
                            const sssContribution =
                              calculateSSS(monthlySalary);
                            return (
                              Math.round(
                                (sssContribution.regularEmployeeShare / 2) * 100
                              ) / 100
                            );
                          }
                          return 0;
                        })(),
                        sssWisp: (() => {
                          if (!isFirstCutoff() && !isSecondCutoff()) return 0;
                          if (monthlySalary > 0) {
                            const sssContribution =
                              calculateSSS(monthlySalary);
                            if (
                              sssContribution.wispEmployeeShare &&
                              sssContribution.wispEmployeeShare > 0
                            ) {
                              return (
                                Math.round(
                                  (sssContribution.wispEmployeeShare / 2) * 100
                                ) / 100
                              );
                            }
                          }
                          return 0;
                        })(),
                        philhealthContribution: (() => {
                          if (!isFirstCutoff() && !isSecondCutoff()) return 0;
                          if (monthlySalary > 0) {
                            const philhealthContribution =
                              calculatePhilHealth(monthlySalary);
                            return (
                              Math.round(
                                (philhealthContribution.employeeShare / 2) * 100
                              ) / 100
                            );
                          }
                          return 0;
                        })(),
                        pagibigContribution: (() => {
                          if (!isSecondCutoff()) return 0;
                          if (monthlySalary > 0) {
                            const pagibigContribution =
                              calculatePagIBIG(monthlySalary);
                            return (
                              Math.round(
                                pagibigContribution.employeeShare * 100
                              ) / 100
                            );
                          }
                          return 0;
                        })(),
                        withholdingTax: (() => {
                          if (!isSecondCutoff()) return 0;

                          const adj = parseFloat(adjustmentAmount || "0") || 0;
                          const periodGross =
                            calculatedTotalGrossPay !== null &&
                            calculatedTotalGrossPay >= 0
                              ? calculatedTotalGrossPay + adj
                              : 0;
                          const actualMonthlyGross =
                            firstCutoffGrossForTax !== null
                              ? firstCutoffGrossForTax + periodGross
                              : periodGross * 2;

                          if (actualMonthlyGross > 0) {
                            const sss = calculateSSS(monthlySalary);
                            const philhealth =
                              calculatePhilHealth(monthlySalary);
                            const pagibig =
                              calculatePagIBIG(monthlySalary);

                            const monthlyContributions =
                              sss.employeeShare +
                              philhealth.employeeShare +
                              pagibig.employeeShare;

                            const monthlyTaxableIncome =
                              Math.max(0, actualMonthlyGross - monthlyContributions);
                            const monthlyTax =
                              calculateWithholdingTax(monthlyTaxableIncome);
                            return Math.round(monthlyTax * 100) / 100;
                          }
                          return deductions?.withholding_tax || 0;
                        })(),
                        totalDeductions: displayTotalDed,
                      }}
                      adjustment={adjustment}
                      adjustmentReason={adjustmentReason || undefined}
                      netPay={displayNetPay}
                      workingDays={workingDays}
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

          {/* Save payslip confirmation */}
          <AlertDialog open={showSavePayslipConfirm} onOpenChange={setShowSavePayslipConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Save payslip?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to save the payslip for{" "}
                  <strong>{selectedEmployee?.full_name ?? "this employee"}</strong> for the cut-off period{" "}
                  <strong>{periodStart ? format(periodStart, "MMM d") : ""} – {periodEnd ? format(periodEnd, "MMM d, yyyy") : ""}</strong>?
                  Once saved, adjustments cannot be edited for this period.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowSavePayslipConfirm(false);
                    generatePayslip();
                  }}
                  disabled={generating}
                >
                  {generating ? "Saving…" : "Yes, save payslip"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Update payslip confirmation (re-save with current calculation) */}
          <AlertDialog open={showUpdatePayslipConfirm} onOpenChange={setShowUpdatePayslipConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Update saved payslip?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will overwrite the saved payslip for{" "}
                  <strong>{selectedEmployee?.full_name ?? "this employee"}</strong> for{" "}
                  <strong>{periodStart ? format(periodStart, "MMM d") : ""} – {periodEnd ? format(periodEnd, "MMM d, yyyy") : ""}</strong> with the
                  current calculation (earnings, deductions, and saved adjustment). Use this to correct the gross pay or other values. Continue?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    setShowUpdatePayslipConfirm(false);
                    generatePayslip();
                  }}
                  disabled={generating}
                >
                  {generating ? "Updating…" : "Yes, update payslip"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </VStack>
      </DashboardLayout>
    </>
  );
}