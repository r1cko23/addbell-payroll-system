"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { H1, H2, H3, BodySmall, Label, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { format, addDays, parseISO, startOfYear, endOfYear } from "date-fns";
import { formatCurrency } from "@/utils/format";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { useUserRole } from "@/lib/hooks/useUserRole";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Helper function to round to 2 decimal places
function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  per_day?: number | null;
  rate_per_day?: number;
  rate_per_hour?: number;
  monthly_rate?: number | null;
  hire_date?: string | null;
}

interface Payslip {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  earnings_breakdown: any;
  gross_pay: number;
  deductions_breakdown: any;
  total_deductions: number;
  sss_amount: number;
  philhealth_amount: number;
  pagibig_amount: number;
  withholding_tax: number;
  allowance_amount: number;
  net_pay: number;
  status: string;
}

interface CutoffAllowance {
  transpo_allowance: number;
  load_allowance: number;
  allowance: number;
  refund: number;
}

interface ReportRow {
  employeeName: string;
  dailyRate: number;
  hoursWorked: number;
  daysWorked: number;
  basicSalary: number;
  totalSalary: number;
  regOTHours: number;
  regOTAmount: number;
  nightDiffHours: number;
  nightDiffAmount: number;
  specialHolidayHours: number;
  specialHolidayAmount: number;
  specialHolidayOTHours: number;
  specialHolidayOTAmount: number;
  restdayHours: number;
  restdayAmount: number;
  totalOTAmount: number;
  serviceIncentiveLeaveAmount: number;
  refund: number;
  transpoAllowance: number;
  loadAllowance: number;
  allowance: number;
  grossAmount: number;
  sss: number;
  sssPRO: number;
  philhealth: number;
  pagibig: number;
  withholdingTax: number;
  sssLoan: number;
  otherDeduction: number;
  totalDeduction: number;
  netAmount: number;
  thirteenthMonthCutoff: number;
  silCutoff: number;
  thirteenthMonthYTD: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const { canAccessSalaryInfo, loading: roleLoading } = useUserRole();
  const [periodStart, setPeriodStart] = useState<Date>(
    getBiMonthlyPeriodStart(new Date())
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [allowances, setAllowances] = useState<Map<string, CutoffAllowance>>(
    new Map()
  );
  const [deductions, setDeductions] = useState<
    Map<string, { other_deduction: number; sss_pro: number }>
  >(new Map());
  const [attendanceMap, setAttendanceMap] = useState<
    Map<string, { total_regular_hours: number; total_overtime_hours: number; total_night_diff_hours: number; attendance_data: any }>
  >(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const supabase = createClient();

  // Debounce periodStart to avoid recalculating on every date input change
  // Wait 500ms after user stops changing the date before loading data
  const debouncedPeriodStart = useDebounce(periodStart, 500);

  const periodEnd = useMemo(
    () => getBiMonthlyPeriodEnd(debouncedPeriodStart || periodStart),
    [debouncedPeriodStart, periodStart]
  );

  const payoutDate = useMemo(() => {
    return addDays(periodEnd, 5);
  }, [periodEnd]);

  // Redirect HR users without salary access
  useEffect(() => {
    if (!roleLoading && !canAccessSalaryInfo) {
      toast.error("You do not have permission to access this page.");
      router.push("/dashboard");
    }
  }, [canAccessSalaryInfo, roleLoading, router]);

  useEffect(() => {
    if (!roleLoading && canAccessSalaryInfo) {
      loadReportData();
    }
  }, [debouncedPeriodStart, roleLoading, canAccessSalaryInfo]);

  async function loadReportData() {
    setLoading(true);
    try {
      // Use debounced periodStart for data loading, but calculate periodEnd from it
      const actualPeriodStart = debouncedPeriodStart || periodStart;
      const actualPeriodEnd = getBiMonthlyPeriodEnd(actualPeriodStart);
      const periodStartStr = format(actualPeriodStart, "yyyy-MM-dd");
      const periodEndStr = format(actualPeriodEnd, "yyyy-MM-dd");

      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, per_day, monthly_rate, hire_date, last_name, first_name")
        .eq("is_active", true)
        .order("last_name", { ascending: true, nullsFirst: false })
        .order("first_name", { ascending: true, nullsFirst: false });

      if (employeesError) throw employeesError;
      setEmployees(employeesData || []);

      // Load payslips for this cutoff
      const { data: payslipsData, error: payslipsError } = await supabase
        .from("payslips")
        .select("*")
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr)
        .order("created_at");

      if (payslipsError) throw payslipsError;
      setPayslips(payslipsData || []);

      // Load weekly_attendance records for calculated totals
      const { data: attendanceData, error: attendanceError } = await supabase
        .from("weekly_attendance")
        .select("employee_id, total_regular_hours, total_overtime_hours, total_night_diff_hours, attendance_data")
        .eq("period_start", periodStartStr)
        .eq("period_end", periodEndStr);

      if (attendanceError) {
        console.warn("Error loading attendance data:", attendanceError);
      }

      // Store attendance data in a map for quick lookup
      const attendanceDataMap = new Map();
      (attendanceData || []).forEach((att: any) => {
        attendanceDataMap.set(att.employee_id, {
          total_regular_hours: att.total_regular_hours || 0,
          total_overtime_hours: att.total_overtime_hours || 0,
          total_night_diff_hours: att.total_night_diff_hours || 0,
          attendance_data: att.attendance_data || [],
        });
      });
      setAttendanceMap(attendanceDataMap);

      // Load cutoff allowances
      const { data: allowancesData, error: allowancesError } = await supabase
        .from("cutoff_allowances")
        .select("*")
        .eq("period_start", periodStartStr);

      if (allowancesError) throw allowancesError;

      const allowancesMap = new Map<string, CutoffAllowance>();
      (allowancesData || []).forEach((allowance: any) => {
        allowancesMap.set(allowance.employee_id, {
          transpo_allowance: allowance.transpo_allowance || 0,
          load_allowance: allowance.load_allowance || 0,
          allowance: allowance.allowance || 0,
          refund: allowance.refund || 0,
        });
      });
      setAllowances(allowancesMap);

      // Load deductions
      const { data: deductionsData, error: deductionsError } = await supabase
        .from("employee_deductions")
        .select("employee_id, other_deduction, sss_pro")
        .eq("period_start", periodStartStr);

      if (deductionsError) throw deductionsError;

      const deductionsMap = new Map<
        string,
        { other_deduction: number; sss_pro: number }
      >();
      (deductionsData || []).forEach((deduction: any) => {
        deductionsMap.set(deduction.employee_id, {
          other_deduction: deduction.other_deduction || 0,
          sss_pro: deduction.sss_pro || 0,
        });
      });
      setDeductions(deductionsMap);
    } catch (error: any) {
      console.error("Error loading report data:", error);
      toast.error("Failed to load report data: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  // Calculate 13th month YTD by summing 13th month cutoff amounts from all payslips
  // 13th month YTD = sum of (basicSalary / 12) for each payslip from start of year to current cutoff
  async function calculate13thMonthYTD(
    employeeId: string,
    employee: Employee,
    cutoffPeriodStart: Date,
    cutoffPeriodEnd: Date
  ): Promise<number> {
    try {
      const yearStart = startOfYear(cutoffPeriodStart);
      const yearStartStr = format(yearStart, "yyyy-MM-dd");
      const periodEndStr = format(cutoffPeriodEnd, "yyyy-MM-dd");

      // Get all payslips from start of year to current cutoff end
      const { data: payslipsData } = await supabase
        .from("payslips")
        .select("earnings_breakdown, period_start, period_end")
        .eq("employee_id", employeeId)
        .gte("period_start", yearStartStr)
        .lte("period_end", periodEndStr)
        .eq("status", "paid")
        .order("period_start");

      if (!payslipsData || payslipsData.length === 0) {
        return 0;
      }

      const dailyRate = employee.per_day || employee.rate_per_day || 0;
      const ratePerHour = dailyRate / 8;
      let total13thMonth = 0;

      // Calculate 13th month cutoff for each payslip and sum them
      payslipsData.forEach((payslip: any) => {
        if (!payslip.earnings_breakdown || !Array.isArray(payslip.earnings_breakdown)) {
          return;
        }

        // Calculate basic salary for this payslip period
        let basicSalaryForPeriod = 0;
        payslip.earnings_breakdown.forEach((day: any) => {
          const regularHours = Number(day.regularHours) || 0;
          const dayType = day.dayType || "regular";

          // Basic salary = regular hours × hourly rate (only regular work days)
          // Exclude holidays, rest days, OT from basic salary
          if (dayType === "regular" && regularHours > 0) {
            basicSalaryForPeriod += regularHours * ratePerHour;
          }
        });

        // 13th month cutoff for this period = basicSalary / 12
        const thirteenthMonthCutoff = basicSalaryForPeriod / 12;
        total13thMonth += thirteenthMonthCutoff;
      });

      return roundTo2Decimals(total13thMonth);
    } catch (error) {
      console.error("Error calculating 13th month YTD:", error);
      return 0;
    }
  }

  // Calculate SIL cutoff amount
  function calculateSILCutoff(
    earningsBreakdown: any,
    dailyRate: number
  ): number {
    // SIL (Service Incentive Leave) is typically 5 days per year
    // For cutoff, calculate based on days worked or leave taken
    // This is a simplified calculation - adjust based on your business rules
    if (!earningsBreakdown || !Array.isArray(earningsBreakdown)) return 0;

    // Count SIL days from leave requests or attendance data
    // For now, return 0 - this should be calculated based on your SIL accrual logic
    return 0;
  }

  const [reportRows, setReportRows] = useState<ReportRow[]>([]);
  const [calculating, setCalculating] = useState(false);

  // Generate report rows - use debounced periodStart to avoid recalculating on every change
  useEffect(() => {
    async function generateReportRows() {
      if (employees.length === 0) {
        setReportRows([]);
        return;
      }

      // Use debounced periodStart for calculations
      const actualPeriodStart = debouncedPeriodStart || periodStart;
      const actualPeriodEnd = getBiMonthlyPeriodEnd(actualPeriodStart);

      setCalculating(true);
      const rows: ReportRow[] = [];

      for (const employee of employees) {
        const payslip = payslips.find((p) => p.employee_id === employee.id);
        const allowance = allowances.get(employee.id) || {
          transpo_allowance: 0,
          load_allowance: 0,
          allowance: 0,
          refund: 0,
        };
        const deduction = deductions.get(employee.id) || {
          other_deduction: 0,
          sss_pro: 0,
        };

        const dailyRate = employee.per_day || employee.rate_per_day || 0;
        const ratePerHour = dailyRate / 8;

        // Get attendance totals from weekly_attendance if available
        const attendance = attendanceMap.get(employee.id);
        const totalRegularHours = attendance?.total_regular_hours || 0;
        const totalOvertimeHours = attendance?.total_overtime_hours || 0;
        const totalNightDiffHours = attendance?.total_night_diff_hours || 0;

        // Extract data from payslip earnings_breakdown (attendance_data)
        let hoursWorked = 0;
        let daysWorked = 0;
        let basicSalary = 0;
        let regOTHours = 0;
        let regOTAmount = 0;
        let nightDiffHours = 0;
        let nightDiffAmount = 0;
        let specialHolidayHours = 0;
        let specialHolidayAmount = 0;
        let specialHolidayOTHours = 0;
        let specialHolidayOTAmount = 0;
        let restdayHours = 0;
        let restdayAmount = 0;
        let totalOTAmount = 0;

        // Use attendance totals if available, otherwise calculate from breakdown
        if (attendance && totalRegularHours > 0) {
          hoursWorked = totalRegularHours;
          daysWorked = roundTo2Decimals(totalRegularHours / 8);
          regOTHours = totalOvertimeHours;
          nightDiffHours = totalNightDiffHours;

          // Basic salary from regular hours
          basicSalary = roundTo2Decimals(totalRegularHours * ratePerHour);

          // Night differential amount (10% of hourly rate)
          nightDiffAmount = roundTo2Decimals(totalNightDiffHours * ratePerHour * 0.1);
        }

        // Extract detailed breakdown from attendance_data
        if (payslip && payslip.earnings_breakdown && Array.isArray(payslip.earnings_breakdown)) {
          const breakdown = payslip.earnings_breakdown;

          breakdown.forEach((day: any) => {
            const regularHours = Number(day.regularHours) || 0;
            const overtimeHours = Number(day.overtimeHours) || 0;
            const nightDiff = Number(day.nightDiffHours) || 0;
            const dayType = day.dayType || "regular";

            // If we don't have attendance totals, calculate from breakdown
            if (!attendance || totalRegularHours === 0) {
              hoursWorked += regularHours;
              if (regularHours >= 8) {
                daysWorked += regularHours / 8;
              }
              basicSalary += roundTo2Decimals(regularHours * ratePerHour);
            }

            // Regular OT (only on regular days)
            if (dayType === "regular" && overtimeHours > 0) {
              if (!attendance || totalRegularHours === 0) {
                regOTHours += overtimeHours;
              }
              // For rank and file: 1.25x rate
              regOTAmount += roundTo2Decimals(overtimeHours * ratePerHour * 1.25);
            }

            // Night differential (only count if not already included from totals)
            if (!attendance || totalRegularHours === 0) {
              nightDiffHours += nightDiff;
              nightDiffAmount += roundTo2Decimals(nightDiff * ratePerHour * 0.1);
            }

            // Special holiday
            if (dayType === "special-holiday" || dayType === "non-working-holiday") {
              specialHolidayHours += regularHours;
              specialHolidayAmount += roundTo2Decimals(regularHours * ratePerHour * 1.3);
              if (overtimeHours > 0) {
                specialHolidayOTHours += overtimeHours;
                specialHolidayOTAmount += roundTo2Decimals(overtimeHours * ratePerHour * 1.69);
              }
            }

            // Rest day
            if (dayType === "rest-day" || dayType === "sunday") {
              restdayHours += regularHours;
              restdayAmount += roundTo2Decimals(regularHours * ratePerHour * 1.3);
            }
          });
        }

        // Calculate total OT amount (sum of all OT-related amounts)
        totalOTAmount = roundTo2Decimals(
          regOTAmount +
          nightDiffAmount +
          specialHolidayOTAmount +
          (restdayHours > 0 ? restdayAmount : 0)
        );

        // Total salary = basic salary + all OT amounts
        // Use payslip's gross_pay if available, otherwise calculate
        const calculatedTotalSalary = roundTo2Decimals(basicSalary + totalOTAmount);
        const totalSalary = payslip?.gross_pay
          ? roundTo2Decimals(payslip.gross_pay)
          : calculatedTotalSalary;
        const serviceIncentiveLeaveAmount = roundTo2Decimals(
          calculateSILCutoff(payslip?.earnings_breakdown, dailyRate)
        );

        // Gross amount = total salary + all allowances
        // Use payslip's gross_pay as base, then add manual allowances
        const baseGross = payslip?.gross_pay || totalSalary;
        const grossAmount = roundTo2Decimals(
          baseGross +
          allowance.transpo_allowance +
          allowance.load_allowance +
          allowance.allowance +
          allowance.refund
        );

        // Deductions - round all to 2 decimals
        // Extract individual deduction amounts from payslip
        const sss = roundTo2Decimals(payslip?.sss_amount || 0);
        const sssPRO = roundTo2Decimals(deduction.sss_pro || 0);
        const philhealth = roundTo2Decimals(payslip?.philhealth_amount || 0);
        const pagibig = roundTo2Decimals(payslip?.pagibig_amount || 0);
        const withholdingTax = roundTo2Decimals(payslip?.withholding_tax || 0);

        // Extract SSS loan from deductions_breakdown
        let sssLoan = 0;
        if (payslip?.deductions_breakdown) {
          const dedBreakdown = payslip.deductions_breakdown as any;
          sssLoan = roundTo2Decimals(
            (dedBreakdown.sssLoan || 0) +
            (dedBreakdown.sss_salary_loan || 0) +
            (dedBreakdown.sss_calamity_loan || 0)
          );
        }

        const otherDeduction = roundTo2Decimals(deduction.other_deduction || 0);

        // Calculate total deduction by summing all individual deductions
        // This ensures we don't double-count and includes all manual deductions
        const totalDeduction = roundTo2Decimals(
          sss +
          sssPRO +
          philhealth +
          pagibig +
          withholdingTax +
          sssLoan +
          otherDeduction
        );

        const netAmount = roundTo2Decimals(grossAmount - totalDeduction);

        // 13th month calculations per DOLE rules
        // Formula: (monthly basic salary / 12) × months worked - (SIL days × daily rate / 12)
        // For cutoff: Use basic salary for this cutoff period
        // Calculate monthly basic salary
        const workingDaysPerMonth = 22;
        let monthlyBasicSalary = 0;
        if (employee.monthly_rate && employee.monthly_rate > 0) {
          monthlyBasicSalary = employee.monthly_rate;
        } else if (employee.per_day && employee.per_day > 0) {
          monthlyBasicSalary = employee.per_day * workingDaysPerMonth;
        }

        // 13th month cutoff = basic salary for this cutoff / 12
        // Basic salary is already calculated above, so use it
        const thirteenthMonthCutoff =
          monthlyBasicSalary > 0
            ? roundTo2Decimals(basicSalary / 12)
            : roundTo2Decimals(basicSalary / 12);

        // 13th month YTD = cumulative from start of year, excluding SIL
        const thirteenthMonthYTD = roundTo2Decimals(
          await calculate13thMonthYTD(employee.id, employee, actualPeriodStart, actualPeriodEnd)
        );

        rows.push({
          employeeName: employee.full_name,
          dailyRate: roundTo2Decimals(dailyRate),
          hoursWorked: roundTo2Decimals(hoursWorked),
          daysWorked: roundTo2Decimals(daysWorked),
          basicSalary: roundTo2Decimals(basicSalary),
          totalSalary: roundTo2Decimals(totalSalary),
          regOTHours: roundTo2Decimals(regOTHours),
          regOTAmount: roundTo2Decimals(regOTAmount),
          nightDiffHours: roundTo2Decimals(nightDiffHours),
          nightDiffAmount: roundTo2Decimals(nightDiffAmount),
          specialHolidayHours: roundTo2Decimals(specialHolidayHours),
          specialHolidayAmount: roundTo2Decimals(specialHolidayAmount),
          specialHolidayOTHours: roundTo2Decimals(specialHolidayOTHours),
          specialHolidayOTAmount: roundTo2Decimals(specialHolidayOTAmount),
          restdayHours: roundTo2Decimals(restdayHours),
          restdayAmount: roundTo2Decimals(restdayAmount),
          totalOTAmount: roundTo2Decimals(totalOTAmount),
          serviceIncentiveLeaveAmount: roundTo2Decimals(
            serviceIncentiveLeaveAmount
          ),
          refund: roundTo2Decimals(allowance.refund),
          transpoAllowance: roundTo2Decimals(allowance.transpo_allowance),
          loadAllowance: roundTo2Decimals(allowance.load_allowance),
          allowance: roundTo2Decimals(allowance.allowance),
          grossAmount: roundTo2Decimals(grossAmount),
          sss,
          sssPRO,
          philhealth,
          pagibig,
          withholdingTax,
          sssLoan,
          otherDeduction,
          totalDeduction,
          netAmount,
          thirteenthMonthCutoff,
          silCutoff: roundTo2Decimals(serviceIncentiveLeaveAmount),
          thirteenthMonthYTD,
        });
      }

      setReportRows(rows);
      setCalculating(false);
    }

    generateReportRows();
  }, [employees, payslips, allowances, deductions, attendanceMap, debouncedPeriodStart]);

  // Export to PDF
  async function exportToPDF() {
    setGenerating(true);
    try {
      const rows = reportRows;
      if (rows.length === 0) {
        toast.error("No data to export");
        setGenerating(false);
        return;
      }

      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 20;

      // Load and add logo
      try {
        const logoResponse = await fetch("/gp-logo.webp");
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });

          // Logo dimensions: 500x185 original, scale to fit
          const logoWidth = 60; // mm
          const logoHeight = (logoWidth * 185) / 500; // Maintain aspect ratio
          const logoX = (pageWidth - logoWidth) / 2; // Center horizontally

          doc.addImage(logoDataUrl, "WEBP", logoX, yPos, logoWidth, logoHeight);
          yPos += logoHeight + 10;
        }
      } catch (error) {
        console.warn("Logo could not be loaded, continuing without logo", error);
        // Continue without logo if it fails to load
      }

      // Company name and title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(
        "Green Pasture People Management Inc. Organic",
        pageWidth / 2,
        yPos,
        { align: "center" }
      );
      yPos += 8;

      doc.setFontSize(14);
      doc.text("Payroll Register", pageWidth / 2, yPos, { align: "center" });
      yPos += 8;

      // Cutoff and payout date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Cutoff: ${format(periodStart, "MMMM dd, yyyy")} - ${format(
          periodEnd,
          "MMMM dd, yyyy"
        )}`,
        pageWidth / 2,
        yPos,
        { align: "center" }
      );
      yPos += 6;

      doc.text(
        `Payout Date: ${format(payoutDate, "MMMM dd, yyyy")}`,
        pageWidth / 2,
        yPos,
        { align: "center" }
      );
      yPos += 10;

      // Prepare table data
      const tableData = rows.map((row) => [
        row.employeeName,
        formatCurrency(row.dailyRate),
        row.hoursWorked.toFixed(2),
        Math.round(row.daysWorked),
        formatCurrency(row.basicSalary),
        formatCurrency(row.totalSalary),
        row.regOTHours.toFixed(2),
        formatCurrency(row.regOTAmount),
        row.nightDiffHours.toFixed(2),
        formatCurrency(row.nightDiffAmount),
        row.specialHolidayHours.toFixed(2),
        formatCurrency(row.specialHolidayAmount),
        row.specialHolidayOTHours.toFixed(2),
        formatCurrency(row.specialHolidayOTAmount),
        row.restdayHours.toFixed(2),
        formatCurrency(row.restdayAmount),
        formatCurrency(row.totalOTAmount),
        formatCurrency(row.serviceIncentiveLeaveAmount),
        formatCurrency(row.refund),
        formatCurrency(row.transpoAllowance),
        formatCurrency(row.loadAllowance),
        formatCurrency(row.allowance),
        formatCurrency(row.grossAmount),
        formatCurrency(row.sss),
        formatCurrency(row.sssPRO),
        formatCurrency(row.philhealth),
        formatCurrency(row.pagibig),
        formatCurrency(row.withholdingTax),
        formatCurrency(row.sssLoan),
        formatCurrency(row.otherDeduction),
        formatCurrency(row.totalDeduction),
        formatCurrency(row.netAmount),
        formatCurrency(row.thirteenthMonthCutoff),
        formatCurrency(row.silCutoff),
        formatCurrency(row.thirteenthMonthYTD),
      ]);

      // Calculate totals row
      const totals = rows.reduce(
        (acc, row) => ({
          hoursWorked: acc.hoursWorked + row.hoursWorked,
          daysWorked: acc.daysWorked + row.daysWorked,
          basicSalary: acc.basicSalary + row.basicSalary,
          totalSalary: acc.totalSalary + row.totalSalary,
          regOTHours: acc.regOTHours + row.regOTHours,
          regOTAmount: acc.regOTAmount + row.regOTAmount,
          nightDiffHours: acc.nightDiffHours + row.nightDiffHours,
          nightDiffAmount: acc.nightDiffAmount + row.nightDiffAmount,
          specialHolidayHours:
            acc.specialHolidayHours + row.specialHolidayHours,
          specialHolidayAmount:
            acc.specialHolidayAmount + row.specialHolidayAmount,
          specialHolidayOTHours:
            acc.specialHolidayOTHours + row.specialHolidayOTHours,
          specialHolidayOTAmount:
            acc.specialHolidayOTAmount + row.specialHolidayOTAmount,
          restdayHours: acc.restdayHours + row.restdayHours,
          restdayAmount: acc.restdayAmount + row.restdayAmount,
          totalOTAmount: acc.totalOTAmount + row.totalOTAmount,
          serviceIncentiveLeaveAmount:
            acc.serviceIncentiveLeaveAmount +
            row.serviceIncentiveLeaveAmount,
          refund: acc.refund + row.refund,
          transpoAllowance: acc.transpoAllowance + row.transpoAllowance,
          loadAllowance: acc.loadAllowance + row.loadAllowance,
          allowance: acc.allowance + row.allowance,
          grossAmount: acc.grossAmount + row.grossAmount,
          sss: acc.sss + row.sss,
          sssPRO: acc.sssPRO + row.sssPRO,
          philhealth: acc.philhealth + row.philhealth,
          pagibig: acc.pagibig + row.pagibig,
          withholdingTax: acc.withholdingTax + row.withholdingTax,
          sssLoan: acc.sssLoan + row.sssLoan,
          otherDeduction: acc.otherDeduction + row.otherDeduction,
          totalDeduction: acc.totalDeduction + row.totalDeduction,
          netAmount: acc.netAmount + row.netAmount,
          thirteenthMonthCutoff:
            acc.thirteenthMonthCutoff + row.thirteenthMonthCutoff,
          silCutoff: acc.silCutoff + row.silCutoff,
          thirteenthMonthYTD: acc.thirteenthMonthYTD + row.thirteenthMonthYTD,
        }),
        {
          hoursWorked: 0,
          daysWorked: 0,
          basicSalary: 0,
          totalSalary: 0,
          regOTHours: 0,
          regOTAmount: 0,
          nightDiffHours: 0,
          nightDiffAmount: 0,
          specialHolidayHours: 0,
          specialHolidayAmount: 0,
          specialHolidayOTHours: 0,
          specialHolidayOTAmount: 0,
          restdayHours: 0,
          restdayAmount: 0,
          totalOTAmount: 0,
          serviceIncentiveLeaveAmount: 0,
          refund: 0,
          transpoAllowance: 0,
          loadAllowance: 0,
          allowance: 0,
          grossAmount: 0,
          sss: 0,
          sssPRO: 0,
          philhealth: 0,
          pagibig: 0,
          withholdingTax: 0,
          sssLoan: 0,
          otherDeduction: 0,
          totalDeduction: 0,
          netAmount: 0,
          thirteenthMonthCutoff: 0,
          silCutoff: 0,
          thirteenthMonthYTD: 0,
        }
      );

      const roundTo2Decimals = (value: number) => Math.round(value * 100) / 100;
      const roundedTotals = Object.fromEntries(
        Object.entries(totals).map(([key, value]) => [
          key,
          roundTo2Decimals(value),
        ])
      ) as typeof totals;

      const totalsRow = [
        "TOTAL",
        "",
        roundedTotals.hoursWorked.toFixed(2),
        Math.round(roundedTotals.daysWorked),
        formatCurrency(roundedTotals.basicSalary),
        formatCurrency(roundedTotals.totalSalary),
        roundedTotals.regOTHours.toFixed(2),
        formatCurrency(roundedTotals.regOTAmount),
        roundedTotals.nightDiffHours.toFixed(2),
        formatCurrency(roundedTotals.nightDiffAmount),
        roundedTotals.specialHolidayHours.toFixed(2),
        formatCurrency(roundedTotals.specialHolidayAmount),
        roundedTotals.specialHolidayOTHours.toFixed(2),
        formatCurrency(roundedTotals.specialHolidayOTAmount),
        roundedTotals.restdayHours.toFixed(2),
        formatCurrency(roundedTotals.restdayAmount),
        formatCurrency(roundedTotals.totalOTAmount),
        formatCurrency(roundedTotals.serviceIncentiveLeaveAmount),
        formatCurrency(roundedTotals.refund),
        formatCurrency(roundedTotals.transpoAllowance),
        formatCurrency(roundedTotals.loadAllowance),
        formatCurrency(roundedTotals.allowance),
        formatCurrency(roundedTotals.grossAmount),
        formatCurrency(roundedTotals.sss),
        formatCurrency(roundedTotals.sssPRO),
        formatCurrency(roundedTotals.philhealth),
        formatCurrency(roundedTotals.pagibig),
        formatCurrency(roundedTotals.withholdingTax),
        formatCurrency(roundedTotals.sssLoan),
        formatCurrency(roundedTotals.otherDeduction),
        formatCurrency(roundedTotals.totalDeduction),
        formatCurrency(roundedTotals.netAmount),
        formatCurrency(roundedTotals.thirteenthMonthCutoff),
        formatCurrency(roundedTotals.silCutoff),
        formatCurrency(roundedTotals.thirteenthMonthYTD),
      ];

      // Add table
      autoTable(doc, {
        startY: yPos,
        head: [
          [
            "Employee",
            "Daily Rate",
            "Hours",
            "Days",
            "Basic",
            "Total Salary",
            "OT Hrs",
            "OT Amt",
            "ND Hrs",
            "ND Amt",
            "SH Hrs",
            "SH Amt",
            "SH OT Hrs",
            "SH OT Amt",
            "RD Hrs",
            "RD Amt",
            "Total OT",
            "SIL",
            "Refund",
            "Transpo",
            "Load",
            "Allowance",
            "Gross",
            "SSS",
            "SSS PRO",
            "Philhealth",
            "Pagibig",
            "WHT",
            "SSS Loan",
            "Other Ded",
            "Total Ded",
            "NET",
            "13th Mo",
            "SIL Cutoff",
            "13th Mo YTD",
          ],
        ],
        body: [...tableData, totalsRow],
        theme: "grid",
        headStyles: {
          fillColor: [59, 130, 246], // Blue color
          textColor: 255,
          fontStyle: "bold",
          fontSize: 7,
        },
        bodyStyles: {
          fontSize: 6,
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250],
        },
        styles: {
          cellPadding: 1,
          overflow: "linebreak",
          cellWidth: "wrap",
        },
        columnStyles: {
          0: { cellWidth: 30 }, // Employee name
          1: { cellWidth: 20, halign: "right" }, // Daily Rate
          2: { cellWidth: 15, halign: "right" }, // Hours
          3: { cellWidth: 15, halign: "right" }, // Days
          4: { cellWidth: 20, halign: "right" }, // Basic
          5: { cellWidth: 20, halign: "right" }, // Total Salary
          6: { cellWidth: 15, halign: "right" }, // OT Hrs
          7: { cellWidth: 18, halign: "right" }, // OT Amt
          8: { cellWidth: 15, halign: "right" }, // ND Hrs
          9: { cellWidth: 18, halign: "right" }, // ND Amt
          10: { cellWidth: 15, halign: "right" }, // SH Hrs
          11: { cellWidth: 18, halign: "right" }, // SH Amt
          12: { cellWidth: 15, halign: "right" }, // SH OT Hrs
          13: { cellWidth: 18, halign: "right" }, // SH OT Amt
          14: { cellWidth: 15, halign: "right" }, // RD Hrs
          15: { cellWidth: 18, halign: "right" }, // RD Amt
          16: { cellWidth: 18, halign: "right" }, // Total OT
          17: { cellWidth: 18, halign: "right" }, // SIL
          18: { cellWidth: 18, halign: "right" }, // Refund
          19: { cellWidth: 18, halign: "right" }, // Transpo
          20: { cellWidth: 18, halign: "right" }, // Load
          21: { cellWidth: 18, halign: "right" }, // Allowance
          22: { cellWidth: 20, halign: "right" }, // Gross
          23: { cellWidth: 18, halign: "right" }, // SSS
          24: { cellWidth: 18, halign: "right" }, // SSS PRO
          25: { cellWidth: 18, halign: "right" }, // Philhealth
          26: { cellWidth: 18, halign: "right" }, // Pagibig
          27: { cellWidth: 18, halign: "right" }, // WHT
          28: { cellWidth: 18, halign: "right" }, // SSS Loan
          29: { cellWidth: 18, halign: "right" }, // Other Ded
          30: { cellWidth: 20, halign: "right" }, // Total Ded
          31: { cellWidth: 20, halign: "right" }, // NET
          32: { cellWidth: 18, halign: "right" }, // 13th Mo
          33: { cellWidth: 18, halign: "right" }, // SIL Cutoff
          34: { cellWidth: 18, halign: "right" }, // 13th Mo YTD
        },
        foot: [totalsRow],
        footStyles: {
          fillColor: [229, 231, 235], // Gray background
          textColor: 0,
          fontStyle: "bold",
          fontSize: 7,
        },
        margin: { top: yPos, left: 5, right: 5 },
        didDrawPage: function (data) {
          // Add page numbers
          doc.setFontSize(8);
          doc.text(
            `Page ${data.pageNumber}`,
            pageWidth - 10,
            pageHeight - 10,
            { align: "right" }
          );
        },
      });

      // Save PDF
      const fileName = `payroll-register-${format(periodStart, "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);

      toast.success("Payroll Register exported to PDF successfully");
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export PDF: " + error.message);
    } finally {
      setGenerating(false);
    }
  }

  // Export to CSV
  async function exportToCSV() {
    setGenerating(true);
    try {
      const rows = reportRows;
      const headers = [
        "Employee Name",
        "Daily Rate",
        "Hours Worked",
        "Days Worked",
        "Basic Salary",
        "Total Salary",
        "Reg OT Hours",
        "Reg OT Amount",
        "Night Diff Hours",
        "Night Diff Amount",
        "Special Holiday Hours",
        "Special Holiday Amount",
        "Special Holiday OT Hours",
        "Special Holiday OT Amount",
        "Restday Hours",
        "Restday Amount",
        "Total OT Amount",
        "Service Incentive Leave Amount",
        "Refund",
        "Transpo Allowance",
        "Load Allowance",
        "Allowance",
        "Gross Amount",
        "SSS",
        "SSS PRO",
        "Philhealth",
        "Pagibig",
        "Withholding Tax",
        "SSS LOAN",
        "Other Deduction",
        "Total Deduction",
        "NET Amount",
        "13th Month Cutoff",
        "SIL Cutoff",
        "13th Month YTD",
      ];

      let csv = headers.join(",") + "\n";

      rows.forEach((row) => {
        const values = [
          row.employeeName,
          row.dailyRate.toFixed(2),
          row.hoursWorked.toFixed(2),
          Math.round(row.daysWorked),
          row.basicSalary.toFixed(2),
          row.totalSalary.toFixed(2),
          row.regOTHours.toFixed(2),
          row.regOTAmount.toFixed(2),
          row.nightDiffHours.toFixed(2),
          row.nightDiffAmount.toFixed(2),
          row.specialHolidayHours.toFixed(2),
          row.specialHolidayAmount.toFixed(2),
          row.specialHolidayOTHours.toFixed(2),
          row.specialHolidayOTAmount.toFixed(2),
          row.restdayHours.toFixed(2),
          row.restdayAmount.toFixed(2),
          row.totalOTAmount.toFixed(2),
          row.serviceIncentiveLeaveAmount.toFixed(2),
          row.refund.toFixed(2),
          row.transpoAllowance.toFixed(2),
          row.loadAllowance.toFixed(2),
          row.allowance.toFixed(2),
          row.grossAmount.toFixed(2),
          row.sss.toFixed(2),
          row.sssPRO.toFixed(2),
          row.philhealth.toFixed(2),
          row.pagibig.toFixed(2),
          row.withholdingTax.toFixed(2),
          row.sssLoan.toFixed(2),
          row.otherDeduction.toFixed(2),
          row.totalDeduction.toFixed(2),
          row.netAmount.toFixed(2),
          row.thirteenthMonthCutoff.toFixed(2),
          row.silCutoff.toFixed(2),
          row.thirteenthMonthYTD.toFixed(2),
        ];
        csv += values.map((v) => `"${v}"`).join(",") + "\n";
      });

      // Download CSV
      const blob = new Blob([csv], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-register-${format(periodStart, "yyyy-MM-dd")}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Payroll Register exported successfully");
    } catch (error: any) {
      console.error("Error exporting report:", error);
      toast.error("Failed to export report: " + error.message);
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <BodySmall>Loading report data...</BodySmall>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="4">
        <HStack justify="between" align="end" className="mb-1 gap-4">
          <H2 className="text-xl font-bold">Payroll Register</H2>
          <HStack gap="3" align="end" className="flex-1 justify-end">
            <div className="flex gap-3 items-end">
              <div>
                <Label className="text-xs mb-1">Cutoff Period</Label>
                <Input
                  type="date"
                  value={format(periodStart, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setPeriodStart(getBiMonthlyPeriodStart(date));
                  }}
                  className="h-9 text-sm w-[160px]"
                />
              </div>
              <div>
                <Label className="text-xs mb-1">Period</Label>
                <Input
                  value={formatBiMonthlyPeriod(periodStart, periodEnd)}
                  disabled
                  className="bg-gray-50 h-9 text-sm w-[200px]"
                />
              </div>
              <div>
                <Label className="text-xs mb-1">Payout Date</Label>
                <Input
                  value={format(payoutDate, "yyyy-MM-dd")}
                  disabled
                  className="bg-gray-50 h-9 text-sm w-[160px]"
                />
              </div>
            </div>
            <HStack gap="3">
              <Button
                onClick={exportToPDF}
                disabled={generating}
                variant="default"
                size="sm"
              >
                <Icon name="Download" size={IconSizes.md} />
                {generating ? "Exporting..." : "Export PDF"}
              </Button>
              <Button
                onClick={exportToCSV}
                disabled={generating}
                variant="outline"
                size="sm"
              >
                <Icon name="FileCsv" size={IconSizes.md} />
                {generating ? "Exporting..." : "Export CSV"}
              </Button>
            </HStack>
          </HStack>
        </HStack>

        {/* Summary Totals - Compact */}
        {!calculating && reportRows.length > 0 && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200">
            <CardHeader className="pb-2 pt-2">
              <HStack justify="between" align="center">
                <HStack gap="2" align="center">
                  <CardTitle className="text-sm font-medium mb-0">Executive Summary</CardTitle>
                  <BodySmall className="text-xs text-muted-foreground">
                    • {reportRows.length} employee{reportRows.length !== 1 ? "s" : ""} •{" "}
                    {formatBiMonthlyPeriod(periodStart, periodEnd)}
                  </BodySmall>
                </HStack>
              </HStack>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <ReportSummaryTotals reportRows={reportRows} />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="pb-2 pt-2">
            <HStack justify="between" align="center">
              <CardTitle className="text-sm font-medium">
                Payroll Register - {formatBiMonthlyPeriod(periodStart, periodEnd)}
              </CardTitle>
              <BodySmall className="text-xs text-muted-foreground">
                Payout: {format(payoutDate, "MMM dd, yyyy")}
              </BodySmall>
            </HStack>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              {calculating ? (
                <div className="p-8 text-center">
                  <BodySmall>Calculating report data...</BodySmall>
                </div>
              ) : (
                <ReportTable reportRows={reportRows} />
              )}
            </div>
          </CardContent>
        </Card>
      </VStack>
    </DashboardLayout>
  );
}

// Report Summary Totals Component
function ReportSummaryTotals({ reportRows }: { reportRows: ReportRow[] }) {
  const totals = reportRows.reduce(
    (acc, row) => ({
      dailyRate: acc.dailyRate + row.dailyRate,
      hoursWorked: acc.hoursWorked + row.hoursWorked,
      daysWorked: acc.daysWorked + row.daysWorked,
      basicSalary: acc.basicSalary + row.basicSalary,
      totalSalary: acc.totalSalary + row.totalSalary,
      regOTHours: acc.regOTHours + row.regOTHours,
      regOTAmount: acc.regOTAmount + row.regOTAmount,
      nightDiffHours: acc.nightDiffHours + row.nightDiffHours,
      nightDiffAmount: acc.nightDiffAmount + row.nightDiffAmount,
      specialHolidayHours: acc.specialHolidayHours + row.specialHolidayHours,
      specialHolidayAmount: acc.specialHolidayAmount + row.specialHolidayAmount,
      specialHolidayOTHours: acc.specialHolidayOTHours + row.specialHolidayOTHours,
      specialHolidayOTAmount: acc.specialHolidayOTAmount + row.specialHolidayOTAmount,
      restdayHours: acc.restdayHours + row.restdayHours,
      restdayAmount: acc.restdayAmount + row.restdayAmount,
      totalOTAmount: acc.totalOTAmount + row.totalOTAmount,
      serviceIncentiveLeaveAmount: acc.serviceIncentiveLeaveAmount + row.serviceIncentiveLeaveAmount,
      refund: acc.refund + row.refund,
      transpoAllowance: acc.transpoAllowance + row.transpoAllowance,
      loadAllowance: acc.loadAllowance + row.loadAllowance,
      allowance: acc.allowance + row.allowance,
      grossAmount: acc.grossAmount + row.grossAmount,
      sss: acc.sss + row.sss,
      sssPRO: acc.sssPRO + row.sssPRO,
      philhealth: acc.philhealth + row.philhealth,
      pagibig: acc.pagibig + row.pagibig,
      withholdingTax: acc.withholdingTax + row.withholdingTax,
      sssLoan: acc.sssLoan + row.sssLoan,
      otherDeduction: acc.otherDeduction + row.otherDeduction,
      totalDeduction: acc.totalDeduction + row.totalDeduction,
      netAmount: acc.netAmount + row.netAmount,
      thirteenthMonthCutoff: acc.thirteenthMonthCutoff + row.thirteenthMonthCutoff,
      silCutoff: acc.silCutoff + row.silCutoff,
      thirteenthMonthYTD: acc.thirteenthMonthYTD + row.thirteenthMonthYTD,
    }),
    {
      dailyRate: 0,
      hoursWorked: 0,
      daysWorked: 0,
      basicSalary: 0,
      totalSalary: 0,
      regOTHours: 0,
      regOTAmount: 0,
      nightDiffHours: 0,
      nightDiffAmount: 0,
      specialHolidayHours: 0,
      specialHolidayAmount: 0,
      specialHolidayOTHours: 0,
      specialHolidayOTAmount: 0,
      restdayHours: 0,
      restdayAmount: 0,
      totalOTAmount: 0,
      serviceIncentiveLeaveAmount: 0,
      refund: 0,
      transpoAllowance: 0,
      loadAllowance: 0,
      allowance: 0,
      grossAmount: 0,
      sss: 0,
      sssPRO: 0,
      philhealth: 0,
      pagibig: 0,
      withholdingTax: 0,
      sssLoan: 0,
      otherDeduction: 0,
      totalDeduction: 0,
      netAmount: 0,
      thirteenthMonthCutoff: 0,
      silCutoff: 0,
      thirteenthMonthYTD: 0,
    }
  );

  // Round all totals to 2 decimals
  const roundTo2Decimals = (value: number) => Math.round(value * 100) / 100;
  const roundedTotals = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, roundTo2Decimals(value)])
  ) as typeof totals;

  return (
    <div className="space-y-3">
      {/* Key Metrics - Extended Top Row - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
        <div className="bg-white p-3 rounded border border-blue-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Employees</Caption>
          <div className="text-xl font-bold text-blue-900">
            {reportRows.length}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-emerald-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Gross Amount</Caption>
          <div className="text-xl font-bold text-emerald-900">
            {formatCurrency(roundedTotals.grossAmount)}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-red-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Deductions</Caption>
          <div className="text-xl font-bold text-red-900">
            {formatCurrency(roundedTotals.totalDeduction)}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-purple-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Net Pay</Caption>
          <div className="text-xl font-bold text-purple-900">
            {formatCurrency(roundedTotals.netAmount)}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-amber-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Total Salary</Caption>
          <div className="text-lg font-bold text-amber-900">
            {formatCurrency(roundedTotals.totalSalary)}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-cyan-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Basic Salary</Caption>
          <div className="text-lg font-bold text-cyan-900">
            {formatCurrency(roundedTotals.basicSalary)}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-orange-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">Total OT</Caption>
          <div className="text-lg font-bold text-orange-900">
            {formatCurrency(roundedTotals.totalOTAmount)}
          </div>
        </div>
        <div className="bg-white p-3 rounded border border-indigo-200">
          <Caption className="text-[10px] text-muted-foreground mb-0.5">13th Mo YTD</Caption>
          <div className="text-lg font-bold text-indigo-900">
            {formatCurrency(roundedTotals.thirteenthMonthYTD)}
          </div>
        </div>
      </div>

      {/* Extended Detailed Metrics Grid - Responsive */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 3xl:grid-cols-12 gap-2">
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Hours</Caption>
          <BodySmall className="text-sm font-semibold">
            {roundedTotals.hoursWorked.toFixed(2)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Days</Caption>
          <BodySmall className="text-sm font-semibold">
            {Math.round(roundedTotals.daysWorked)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Basic</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.basicSalary)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">OT Total</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.totalOTAmount)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Allowances</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(
              roundedTotals.transpoAllowance +
              roundedTotals.loadAllowance +
              roundedTotals.allowance +
              roundedTotals.refund
            )}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SSS</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.sss)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SSS PRO</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.sssPRO)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Philhealth</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.philhealth)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Pagibig</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.pagibig)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">WHT</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.withholdingTax)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">13th Mo YTD</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.thirteenthMonthYTD)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Reg OT Hrs</Caption>
          <BodySmall className="text-sm font-semibold">
            {roundedTotals.regOTHours.toFixed(2)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Reg OT Amt</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.regOTAmount)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">ND Hrs</Caption>
          <BodySmall className="text-sm font-semibold">
            {roundedTotals.nightDiffHours.toFixed(2)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">ND Amt</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.nightDiffAmount)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SH Hrs</Caption>
          <BodySmall className="text-sm font-semibold">
            {roundedTotals.specialHolidayHours.toFixed(2)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SH Amt</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.specialHolidayAmount)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">RD Hrs</Caption>
          <BodySmall className="text-sm font-semibold">
            {roundedTotals.restdayHours.toFixed(2)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">RD Amt</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.restdayAmount)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SIL</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.serviceIncentiveLeaveAmount)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SSS Loan</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.sssLoan)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">Other Ded</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.otherDeduction)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">13th Mo Cutoff</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.thirteenthMonthCutoff)}
          </BodySmall>
        </VStack>
        <VStack gap="1" align="start" className="bg-white p-2 rounded border text-center">
          <Caption className="text-[9px] text-muted-foreground">SIL Cutoff</Caption>
          <BodySmall className="text-sm font-semibold">
            {formatCurrency(roundedTotals.silCutoff)}
          </BodySmall>
        </VStack>
      </div>
    </div>
  );
}

// Report Table Component
function ReportTable({ reportRows }: { reportRows: ReportRow[] }) {
  if (reportRows.length === 0) {
    return <BodySmall>No data available for this cutoff period.</BodySmall>;
  }

  // Calculate totals for footer
  const totals = reportRows.reduce(
    (acc, row) => ({
      hoursWorked: acc.hoursWorked + row.hoursWorked,
      daysWorked: acc.daysWorked + row.daysWorked,
      basicSalary: acc.basicSalary + row.basicSalary,
      totalSalary: acc.totalSalary + row.totalSalary,
      regOTHours: acc.regOTHours + row.regOTHours,
      regOTAmount: acc.regOTAmount + row.regOTAmount,
      nightDiffHours: acc.nightDiffHours + row.nightDiffHours,
      nightDiffAmount: acc.nightDiffAmount + row.nightDiffAmount,
      specialHolidayHours: acc.specialHolidayHours + row.specialHolidayHours,
      specialHolidayAmount: acc.specialHolidayAmount + row.specialHolidayAmount,
      specialHolidayOTHours: acc.specialHolidayOTHours + row.specialHolidayOTHours,
      specialHolidayOTAmount: acc.specialHolidayOTAmount + row.specialHolidayOTAmount,
      restdayHours: acc.restdayHours + row.restdayHours,
      restdayAmount: acc.restdayAmount + row.restdayAmount,
      totalOTAmount: acc.totalOTAmount + row.totalOTAmount,
      serviceIncentiveLeaveAmount: acc.serviceIncentiveLeaveAmount + row.serviceIncentiveLeaveAmount,
      refund: acc.refund + row.refund,
      transpoAllowance: acc.transpoAllowance + row.transpoAllowance,
      loadAllowance: acc.loadAllowance + row.loadAllowance,
      allowance: acc.allowance + row.allowance,
      grossAmount: acc.grossAmount + row.grossAmount,
      sss: acc.sss + row.sss,
      sssPRO: acc.sssPRO + row.sssPRO,
      philhealth: acc.philhealth + row.philhealth,
      pagibig: acc.pagibig + row.pagibig,
      withholdingTax: acc.withholdingTax + row.withholdingTax,
      sssLoan: acc.sssLoan + row.sssLoan,
      otherDeduction: acc.otherDeduction + row.otherDeduction,
      totalDeduction: acc.totalDeduction + row.totalDeduction,
      netAmount: acc.netAmount + row.netAmount,
      thirteenthMonthCutoff: acc.thirteenthMonthCutoff + row.thirteenthMonthCutoff,
      silCutoff: acc.silCutoff + row.silCutoff,
      thirteenthMonthYTD: acc.thirteenthMonthYTD + row.thirteenthMonthYTD,
    }),
    {
      hoursWorked: 0,
      daysWorked: 0,
      basicSalary: 0,
      totalSalary: 0,
      regOTHours: 0,
      regOTAmount: 0,
      nightDiffHours: 0,
      nightDiffAmount: 0,
      specialHolidayHours: 0,
      specialHolidayAmount: 0,
      specialHolidayOTHours: 0,
      specialHolidayOTAmount: 0,
      restdayHours: 0,
      restdayAmount: 0,
      totalOTAmount: 0,
      serviceIncentiveLeaveAmount: 0,
      refund: 0,
      transpoAllowance: 0,
      loadAllowance: 0,
      allowance: 0,
      grossAmount: 0,
      sss: 0,
      sssPRO: 0,
      philhealth: 0,
      pagibig: 0,
      withholdingTax: 0,
      sssLoan: 0,
      otherDeduction: 0,
      totalDeduction: 0,
      netAmount: 0,
      thirteenthMonthCutoff: 0,
      silCutoff: 0,
      thirteenthMonthYTD: 0,
    }
  );

  const roundTo2Decimals = (value: number) => Math.round(value * 100) / 100;
  const roundedTotals = Object.fromEntries(
    Object.entries(totals).map(([key, value]) => [key, roundTo2Decimals(value)])
  ) as typeof totals;

  return (
    <div className="w-full overflow-x-auto">
      <Table className="text-xs border-collapse">
        <TableHeader>
          <TableRow className="bg-blue-50">
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold sticky left-0 bg-blue-50 z-10 min-w-[120px]">
              Employee
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Daily Rate
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[60px]">
              Hrs
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[60px]">
              Days
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[75px]">
              Basic
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[75px]">
              Total Sal
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[55px]">
              OT Hrs
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              OT Amt
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[55px]">
              ND Hrs
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              ND Amt
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[55px]">
              SH Hrs
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              SH Amt
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[60px]">
              SH OT Hrs
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              SH OT Amt
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[55px]">
              RD Hrs
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              RD Amt
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Total OT
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              SIL
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Refund
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Transpo
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Load
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Allow
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[80px] bg-emerald-50">
              Gross
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[65px]">
              SSS
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              SSS PRO
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Philhealth
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Pagibig
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[65px]">
              WHT
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              SSS Loan
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[70px]">
              Other Ded
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[80px] bg-red-50">
              Total Ded
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[80px] bg-purple-50">
              NET
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[75px]">
              13th Mo
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[75px]">
              SIL Cutoff
            </TableHead>
            <TableHead className="h-8 px-2 py-1 text-[10px] font-bold text-right min-w-[80px]">
              13th Mo YTD
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Totals Row - At the top */}
          <TableRow className="bg-gray-100 font-bold border-b-2 border-gray-400">
            <TableCell className="px-2 py-2 text-[11px] font-bold sticky left-0 bg-gray-100 z-10">
              TOTAL
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right"></TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {roundedTotals.hoursWorked.toFixed(2)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {Math.round(roundedTotals.daysWorked)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.basicSalary)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.totalSalary)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {roundedTotals.regOTHours.toFixed(2)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.regOTAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {roundedTotals.nightDiffHours.toFixed(2)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.nightDiffAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {roundedTotals.specialHolidayHours.toFixed(2)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.specialHolidayAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {roundedTotals.specialHolidayOTHours.toFixed(2)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.specialHolidayOTAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {roundedTotals.restdayHours.toFixed(2)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.restdayAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.totalOTAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.serviceIncentiveLeaveAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.refund)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.transpoAllowance)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.loadAllowance)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.allowance)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right bg-emerald-100 font-bold">
              {formatCurrency(roundedTotals.grossAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.sss)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.sssPRO)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.philhealth)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.pagibig)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.withholdingTax)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.sssLoan)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.otherDeduction)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right bg-red-100 font-bold">
              {formatCurrency(roundedTotals.totalDeduction)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right bg-purple-100 font-bold">
              {formatCurrency(roundedTotals.netAmount)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.thirteenthMonthCutoff)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.silCutoff)}
            </TableCell>
            <TableCell className="px-2 py-2 text-[11px] text-right">
              {formatCurrency(roundedTotals.thirteenthMonthYTD)}
            </TableCell>
          </TableRow>
          {reportRows.map((row, index) => (
            <TableRow key={index} className="hover:bg-gray-50">
              <TableCell className="px-2 py-1.5 text-[11px] font-medium sticky left-0 bg-white z-10 min-w-[120px]">
                {row.employeeName}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.dailyRate)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {row.hoursWorked.toFixed(2)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {Math.round(row.daysWorked)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.basicSalary)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.totalSalary)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {row.regOTHours.toFixed(2)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.regOTAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {row.nightDiffHours.toFixed(2)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.nightDiffAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {row.specialHolidayHours.toFixed(2)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.specialHolidayAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {row.specialHolidayOTHours.toFixed(2)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.specialHolidayOTAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {row.restdayHours.toFixed(2)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.restdayAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.totalOTAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.serviceIncentiveLeaveAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.refund)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.transpoAllowance)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.loadAllowance)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.allowance)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right font-semibold bg-emerald-50">
                {formatCurrency(row.grossAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.sss)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.sssPRO)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.philhealth)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.pagibig)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.withholdingTax)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.sssLoan)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.otherDeduction)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right font-semibold bg-red-50">
                {formatCurrency(row.totalDeduction)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right font-semibold bg-purple-50">
                {formatCurrency(row.netAmount)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.thirteenthMonthCutoff)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.silCutoff)}
              </TableCell>
              <TableCell className="px-2 py-1.5 text-[11px] text-right">
                {formatCurrency(row.thirteenthMonthYTD)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}