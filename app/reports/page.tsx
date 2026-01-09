"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import { H1, H2, H3, BodySmall, Label } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { format, addDays, parseISO, startOfYear } from "date-fns";
import { formatCurrency } from "@/utils/format";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { useUserRole } from "@/lib/hooks/useUserRole";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  per_day?: number | null;
  rate_per_day?: number;
  rate_per_hour?: number;
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
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const supabase = createClient();

  const periodEnd = useMemo(
    () => getBiMonthlyPeriodEnd(periodStart),
    [periodStart]
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
  }, [periodStart, roleLoading, canAccessSalaryInfo]);

  async function loadReportData() {
    setLoading(true);
    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      // Load employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, per_day")
        .eq("is_active", true)
        .order("full_name");

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

  // Calculate 13th month YTD (from start of year to current cutoff end)
  async function calculate13thMonthYTD(employeeId: string): Promise<number> {
    try {
      const yearStart = startOfYear(periodStart);
      const yearStartStr = format(yearStart, "yyyy-MM-dd");
      const periodEndStr = format(periodEnd, "yyyy-MM-dd");

      const { data: payslipsData } = await supabase
        .from("payslips")
        .select("gross_pay, period_start, period_end")
        .eq("employee_id", employeeId)
        .gte("period_start", yearStartStr)
        .lte("period_end", periodEndStr)
        .eq("status", "paid");

      if (!payslipsData) return 0;

      const totalGross = payslipsData.reduce(
        (sum, p) => sum + (p.gross_pay || 0),
        0
      );
      return totalGross / 12; // 13th month = total gross / 12
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

  // Generate report rows
  useEffect(() => {
    async function generateReportRows() {
      if (employees.length === 0) {
        setReportRows([]);
        return;
      }

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

        // Extract data from payslip earnings_breakdown
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

        if (payslip && payslip.earnings_breakdown) {
          const breakdown = payslip.earnings_breakdown;

          // Calculate hours and days worked from attendance data
          if (Array.isArray(breakdown)) {
            breakdown.forEach((day: any) => {
              const regularHours = day.regularHours || 0;
              const overtimeHours = day.overtimeHours || 0;
              const nightDiff = day.nightDiffHours || 0;

              hoursWorked += regularHours;
              if (regularHours >= 8) {
                daysWorked += regularHours / 8;
              }

              // Basic salary from regular hours
              basicSalary += regularHours * ratePerHour;

              // OT hours and amounts
              if (day.dayType === "regular" && overtimeHours > 0) {
                regOTHours += overtimeHours;
                // For rank and file: 1.25x, for supervisory/managerial: allowance
                regOTAmount += overtimeHours * ratePerHour * 1.25; // Simplified
              }

              // Night differential
              nightDiffHours += nightDiff;
              nightDiffAmount += nightDiff * ratePerHour * 0.1; // 10% of hourly rate

              // Special holiday
              if (day.dayType === "special-holiday") {
                specialHolidayHours += regularHours;
                specialHolidayAmount += regularHours * ratePerHour * 1.3; // 130%
                if (overtimeHours > 0) {
                  specialHolidayOTHours += overtimeHours;
                  specialHolidayOTAmount +=
                    overtimeHours * ratePerHour * 1.69; // 130% * 1.3
                }
              }

              // Rest day
              if (day.dayType === "rest-day") {
                restdayHours += regularHours;
                restdayAmount += regularHours * ratePerHour * 1.3; // 130%
              }
            });
          }

          // Calculate total OT amount
          totalOTAmount =
            regOTAmount +
            nightDiffAmount +
            specialHolidayOTAmount +
            (restdayHours > 0 ? restdayAmount : 0);
        }

        // Calculate totals
        const totalSalary = basicSalary + totalOTAmount;
        const serviceIncentiveLeaveAmount = calculateSILCutoff(
          payslip?.earnings_breakdown,
          dailyRate
        );

        // Gross amount includes all allowances
        const grossAmount =
          (payslip?.gross_pay || 0) +
          allowance.transpo_allowance +
          allowance.load_allowance +
          allowance.allowance +
          allowance.refund;

        // Deductions
        const sss = payslip?.sss_amount || 0;
        const sssPRO = deduction.sss_pro || 0;
        const philhealth = payslip?.philhealth_amount || 0;
        const pagibig = payslip?.pagibig_amount || 0;
        const withholdingTax = payslip?.withholding_tax || 0;

        // Extract SSS loan from deductions_breakdown
        let sssLoan = 0;
        if (payslip?.deductions_breakdown) {
          const dedBreakdown = payslip.deductions_breakdown as any;
          sssLoan =
            (dedBreakdown.sssLoan || 0) +
            (dedBreakdown.sss_salary_loan || 0) +
            (dedBreakdown.sss_calamity_loan || 0);
        }

        const otherDeduction = deduction.other_deduction || 0;
        const totalDeduction =
          sss +
          sssPRO +
          philhealth +
          pagibig +
          withholdingTax +
          sssLoan +
          otherDeduction +
          (payslip?.total_deductions || 0);

        const netAmount = grossAmount - totalDeduction;

        // 13th month calculations
        const thirteenthMonthCutoff = grossAmount / 12;
        const thirteenthMonthYTD = await calculate13thMonthYTD(employee.id);

        rows.push({
          employeeName: employee.full_name,
          dailyRate,
          hoursWorked: Math.round(hoursWorked * 100) / 100,
          daysWorked: Math.round(daysWorked * 100) / 100,
          basicSalary: Math.round(basicSalary * 100) / 100,
          totalSalary: Math.round(totalSalary * 100) / 100,
          regOTHours: Math.round(regOTHours * 100) / 100,
          regOTAmount: Math.round(regOTAmount * 100) / 100,
          nightDiffHours: Math.round(nightDiffHours * 100) / 100,
          nightDiffAmount: Math.round(nightDiffAmount * 100) / 100,
          specialHolidayHours: Math.round(specialHolidayHours * 100) / 100,
          specialHolidayAmount: Math.round(specialHolidayAmount * 100) / 100,
          specialHolidayOTHours: Math.round(specialHolidayOTHours * 100) / 100,
          specialHolidayOTAmount: Math.round(specialHolidayOTAmount * 100) / 100,
          restdayHours: Math.round(restdayHours * 100) / 100,
          restdayAmount: Math.round(restdayAmount * 100) / 100,
          totalOTAmount: Math.round(totalOTAmount * 100) / 100,
          serviceIncentiveLeaveAmount: Math.round(
            serviceIncentiveLeaveAmount * 100
          ) / 100,
          refund: allowance.refund,
          transpoAllowance: allowance.transpo_allowance,
          loadAllowance: allowance.load_allowance,
          allowance: allowance.allowance,
          grossAmount: Math.round(grossAmount * 100) / 100,
          sss,
          sssPRO,
          philhealth,
          pagibig,
          withholdingTax,
          sssLoan,
          otherDeduction,
          totalDeduction: Math.round(totalDeduction * 100) / 100,
          netAmount: Math.round(netAmount * 100) / 100,
          thirteenthMonthCutoff: Math.round(thirteenthMonthCutoff * 100) / 100,
          silCutoff: Math.round(serviceIncentiveLeaveAmount * 100) / 100,
          thirteenthMonthYTD: Math.round(thirteenthMonthYTD * 100) / 100,
        });
      }

      setReportRows(rows);
      setCalculating(false);
    }

    generateReportRows();
  }, [employees, payslips, allowances, deductions, periodEnd]);

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
          row.dailyRate,
          row.hoursWorked,
          row.daysWorked,
          row.basicSalary,
          row.totalSalary,
          row.regOTHours,
          row.regOTAmount,
          row.nightDiffHours,
          row.nightDiffAmount,
          row.specialHolidayHours,
          row.specialHolidayAmount,
          row.specialHolidayOTHours,
          row.specialHolidayOTAmount,
          row.restdayHours,
          row.restdayAmount,
          row.totalOTAmount,
          row.serviceIncentiveLeaveAmount,
          row.refund,
          row.transpoAllowance,
          row.loadAllowance,
          row.allowance,
          row.grossAmount,
          row.sss,
          row.sssPRO,
          row.philhealth,
          row.pagibig,
          row.withholdingTax,
          row.sssLoan,
          row.otherDeduction,
          row.totalDeduction,
          row.netAmount,
          row.thirteenthMonthCutoff,
          row.silCutoff,
          row.thirteenthMonthYTD,
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
      <VStack gap="8">
        <HStack justify="between" align="center">
          <H1>Payroll Register</H1>
          <HStack gap="4">
            <Button
              onClick={exportToCSV}
              disabled={generating}
              variant="default"
            >
              <Icon name="Download" size={IconSizes.md} />
              {generating ? "Exporting..." : "Export CSV"}
            </Button>
          </HStack>
        </HStack>

        <Card>
          <CardHeader>
            <CardTitle>Cutoff Period Selection</CardTitle>
          </CardHeader>
          <CardContent>
            <HStack gap="4" align="end">
              <div className="flex-1">
                <Label>Cutoff Period</Label>
                <Input
                  type="date"
                  value={format(periodStart, "yyyy-MM-dd")}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setPeriodStart(getBiMonthlyPeriodStart(date));
                  }}
                />
              </div>
              <div className="flex-1">
                <Label>Period</Label>
                <Input
                  value={formatBiMonthlyPeriod(periodStart, periodEnd)}
                  disabled
                  className="bg-gray-50"
                />
              </div>
              <div className="flex-1">
                <Label>Payout Date</Label>
                <Input
                  value={format(payoutDate, "yyyy-MM-dd")}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </HStack>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Payroll Register - {formatBiMonthlyPeriod(periodStart, periodEnd)}
            </CardTitle>
            <BodySmall>
              Payout Date: {format(payoutDate, "MMMM dd, yyyy")}
            </BodySmall>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {calculating ? (
                <BodySmall>Calculating report data...</BodySmall>
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

// Report Table Component
function ReportTable({ reportRows }: { reportRows: ReportRow[] }) {
  if (reportRows.length === 0) {
    return <BodySmall>No data available for this cutoff period.</BodySmall>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Daily Rate</TableHead>
          <TableHead>Hours Worked</TableHead>
          <TableHead>Days Worked</TableHead>
          <TableHead>Basic Salary</TableHead>
          <TableHead>Total Salary</TableHead>
          <TableHead>Reg OT Hrs</TableHead>
          <TableHead>Reg OT Amt</TableHead>
          <TableHead>ND Hrs</TableHead>
          <TableHead>ND Amt</TableHead>
          <TableHead>SH Hrs</TableHead>
          <TableHead>SH Amt</TableHead>
          <TableHead>SH OT Hrs</TableHead>
          <TableHead>SH OT Amt</TableHead>
          <TableHead>RD Hrs</TableHead>
          <TableHead>RD Amt</TableHead>
          <TableHead>Total OT</TableHead>
          <TableHead>SIL Amt</TableHead>
          <TableHead>Refund</TableHead>
          <TableHead>Transpo</TableHead>
          <TableHead>Load</TableHead>
          <TableHead>Allowance</TableHead>
          <TableHead>Gross</TableHead>
          <TableHead>SSS</TableHead>
          <TableHead>SSS PRO</TableHead>
          <TableHead>Philhealth</TableHead>
          <TableHead>Pagibig</TableHead>
          <TableHead>WHT</TableHead>
          <TableHead>SSS Loan</TableHead>
          <TableHead>Other Ded</TableHead>
          <TableHead>Total Ded</TableHead>
          <TableHead>NET</TableHead>
          <TableHead>13th Mo Cutoff</TableHead>
          <TableHead>SIL Cutoff</TableHead>
          <TableHead>13th Mo YTD</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reportRows.map((row, index) => (
          <TableRow key={index}>
            <TableCell>{row.employeeName}</TableCell>
            <TableCell>{formatCurrency(row.dailyRate)}</TableCell>
            <TableCell>{row.hoursWorked}</TableCell>
            <TableCell>{row.daysWorked}</TableCell>
            <TableCell>{formatCurrency(row.basicSalary)}</TableCell>
            <TableCell>{formatCurrency(row.totalSalary)}</TableCell>
            <TableCell>{row.regOTHours}</TableCell>
            <TableCell>{formatCurrency(row.regOTAmount)}</TableCell>
            <TableCell>{row.nightDiffHours}</TableCell>
            <TableCell>{formatCurrency(row.nightDiffAmount)}</TableCell>
            <TableCell>{row.specialHolidayHours}</TableCell>
            <TableCell>{formatCurrency(row.specialHolidayAmount)}</TableCell>
            <TableCell>{row.specialHolidayOTHours}</TableCell>
            <TableCell>{formatCurrency(row.specialHolidayOTAmount)}</TableCell>
            <TableCell>{row.restdayHours}</TableCell>
            <TableCell>{formatCurrency(row.restdayAmount)}</TableCell>
            <TableCell>{formatCurrency(row.totalOTAmount)}</TableCell>
            <TableCell>{formatCurrency(row.serviceIncentiveLeaveAmount)}</TableCell>
            <TableCell>{formatCurrency(row.refund)}</TableCell>
            <TableCell>{formatCurrency(row.transpoAllowance)}</TableCell>
            <TableCell>{formatCurrency(row.loadAllowance)}</TableCell>
            <TableCell>{formatCurrency(row.allowance)}</TableCell>
            <TableCell>{formatCurrency(row.grossAmount)}</TableCell>
            <TableCell>{formatCurrency(row.sss)}</TableCell>
            <TableCell>{formatCurrency(row.sssPRO)}</TableCell>
            <TableCell>{formatCurrency(row.philhealth)}</TableCell>
            <TableCell>{formatCurrency(row.pagibig)}</TableCell>
            <TableCell>{formatCurrency(row.withholdingTax)}</TableCell>
            <TableCell>{formatCurrency(row.sssLoan)}</TableCell>
            <TableCell>{formatCurrency(row.otherDeduction)}</TableCell>
            <TableCell>{formatCurrency(row.totalDeduction)}</TableCell>
            <TableCell>{formatCurrency(row.netAmount)}</TableCell>
            <TableCell>{formatCurrency(row.thirteenthMonthCutoff)}</TableCell>
            <TableCell>{formatCurrency(row.silCutoff)}</TableCell>
            <TableCell>{formatCurrency(row.thirteenthMonthYTD)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
