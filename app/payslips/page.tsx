"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { PayslipMultiPrint } from "@/components/PayslipMultiPrint";
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
import { getWeekOfMonth } from "@/utils/holidays";
import * as XLSX from "xlsx";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
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
  uniform_ppe_amount: number;
  sss_salary_loan: number;
  sss_calamity_loan: number;
  pagibig_salary_loan: number;
  pagibig_calamity_loan: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
}

export default function PayslipsPage() {
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
  const [generating, setGenerating] = useState(false);

  // Payslip form data
  const [applySss, setApplySss] = useState(false);
  const [applyPhilhealth, setApplyPhilhealth] = useState(false);
  const [applyPagibig, setApplyPagibig] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState("0");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState("0");
  const [preparedBy, setPreparedBy] = useState("Melanie R. Sapinoso");
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [multiPrintData, setMultiPrintData] = useState<any[]>([]);
  const [showMultiPrintPreview, setShowMultiPrintPreview] = useState(false);
  const [exporting, setExporting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find((e) => e.id === selectedEmployeeId);
      setSelectedEmployee(emp || null);
      loadAttendanceAndDeductions();
    }
  }, [selectedEmployeeId, periodStart]);

  // Auto-set allowance (can be adjusted per period)
  useEffect(() => {
    // Allowance can be set manually, default to 0
    // You can add logic here if needed for specific periods
    if (allowanceAmount === "0") {
      // Keep at 0 unless manually set
    }
  }, [periodStart]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select("id, employee_id, full_name")
        .eq("is_active", true)
        .order("full_name");

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error("Error loading employees:", error);
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceAndDeductions() {
    if (!selectedEmployeeId) return;

    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");

      // Load attendance
      const { data: attData, error: attError } = await supabase
        .from("weekly_attendance")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .maybeSingle();

      if (attError) {
        console.error("Attendance error:", attError);
        throw attError;
      }
      setAttendance(attData);

      // Load deductions for this period
      const { data: dedData, error: dedError } = await supabase
        .from("employee_deductions")
        .select("*")
        .eq("employee_id", selectedEmployeeId)
        .eq("period_start", periodStartStr)
        .maybeSingle();

      if (dedError) {
        console.error("Deductions error:", dedError);
        throw dedError;
      }
      setDeductions(dedData);
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
      toast.error("Missing timesheet data");
      return;
    }

    setGenerating(true);

    try {
      // Calculate totals
      const grossPay = attendance.gross_pay;

      // Weekly deductions (always applied) - default to 0 if no deduction record
      let totalDeductions =
        (deductions?.vale_amount || 0) +
        (deductions?.uniform_ppe_amount || 0) +
        (deductions?.sss_salary_loan || 0) +
        (deductions?.sss_calamity_loan || 0) +
        (deductions?.pagibig_salary_loan || 0) +
        (deductions?.pagibig_calamity_loan || 0);

      // Government contributions (checkbox controlled)
      const sssAmount = applySss ? deductions?.sss_contribution || 0 : 0;
      const philhealthAmount = applyPhilhealth
        ? deductions?.philhealth_contribution || 0
        : 0;
      const pagibigAmount = applyPagibig
        ? deductions?.pagibig_contribution || 0
        : 0;

      totalDeductions +=
        sssAmount +
        philhealthAmount +
        pagibigAmount +
        (deductions?.withholding_tax || 0);

      // Adjustment
      const adjustment = parseFloat(adjustmentAmount) || 0;
      totalDeductions += adjustment;

      // Allowance
      const allowance = parseFloat(allowanceAmount) || 0;

      // Net pay
      const netPay = grossPay - totalDeductions + allowance;

      // Create deductions breakdown - default all to 0 if no deduction record
      const deductionsBreakdown: any = {
        weekly: {
          vale: deductions?.vale_amount || 0,
          uniform_ppe: deductions?.uniform_ppe_amount || 0,
          sss_loan: deductions?.sss_salary_loan || 0,
          sss_calamity: deductions?.sss_calamity_loan || 0,
          pagibig_loan: deductions?.pagibig_salary_loan || 0,
          pagibig_calamity: deductions?.pagibig_calamity_loan || 0,
        },
        tax: deductions?.withholding_tax || 0,
      };

      if (applySss) deductionsBreakdown.sss = sssAmount;
      if (applyPhilhealth) deductionsBreakdown.philhealth = philhealthAmount;
      if (applyPagibig) deductionsBreakdown.pagibig = pagibigAmount;
      if (adjustment !== 0) deductionsBreakdown.adjustment = adjustment;

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

      const payslipData = {
        employee_id: selectedEmployee.id,
        payslip_number: payslipNumber,
        week_number: periodNumber,
        period_start: format(periodStart, "yyyy-MM-dd"),
        period_end: format(periodEnd, "yyyy-MM-dd"),
        period_type: "bimonthly",
        earnings_breakdown: attendance.attendance_data,
        gross_pay: grossPay,
        deductions_breakdown: deductionsBreakdown,
        total_deductions: totalDeductions,
        apply_sss: applySss,
        apply_philhealth: applyPhilhealth,
        apply_pagibig: applyPagibig,
        sss_amount: sssAmount,
        philhealth_amount: philhealthAmount,
        pagibig_amount: pagibigAmount,
        adjustment_amount: adjustment,
        adjustment_reason: adjustmentReason || null,
        allowance_amount: allowance,
        net_pay: netPay,
        status: "draft",
      };

      // Check if payslip already exists
      const { data: existing } = await supabase
        .from("payslips")
        .select("id")
        .eq("payslip_number", payslipNumber)
        .single();

      if (existing) {
        // Update
        const { error } = await supabase
          .from("payslips")
          .update(payslipData)
          .eq("id", existing.id);

        if (error) throw error;
        toast.success("Payslip updated successfully");
      } else {
        // Create
        const { error } = await supabase.from("payslips").insert([payslipData]);

        if (error) throw error;
        toast.success("Payslip generated successfully");
      }
    } catch (error: any) {
      console.error("Error generating payslip:", error);
      toast.error(error.message || "Failed to generate payslip");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
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

  // Calculate preview
  const grossPay = attendance?.gross_pay || 0;
  const weeklyDed =
    (deductions?.vale_amount || 0) +
    (deductions?.uniform_ppe_amount || 0) +
    (deductions?.sss_salary_loan || 0) +
    (deductions?.sss_calamity_loan || 0) +
    (deductions?.pagibig_salary_loan || 0) +
    (deductions?.pagibig_calamity_loan || 0);
  const govDed =
    (applySss ? deductions?.sss_contribution || 0 : 0) +
    (applyPhilhealth ? deductions?.philhealth_contribution || 0 : 0) +
    (applyPagibig ? deductions?.pagibig_contribution || 0 : 0);
  const tax = deductions?.withholding_tax || 0;
  const adjustment = parseFloat(adjustmentAmount) || 0;
  const allowance = parseFloat(allowanceAmount) || 0;
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
    return days.filter((day: any) => (day.regularHours || 0) > 0).length;
  }

  // Export all employees to Excel
  async function exportToExcel() {
    setExporting(true);
    try {
      const allPayrollData = [];

      for (const emp of employees) {
        // Load attendance
        const { data: attData } = await supabase
          .from("weekly_attendance")
          .select("*")
          .eq("employee_id", emp.id)
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .maybeSingle();

        if (!attData) continue; // Skip employees without timesheet data

        // Load deductions
        const { data: dedData } = await supabase
          .from("employee_deductions")
          .select("*")
          .eq("employee_id", emp.id)
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .maybeSingle();

        // Calculate earnings breakdown
        // Simplified export since rates are gone
        const days = attData.attendance_data as any[];

        const workingDays = days.filter(
          (day: any) => (day.regularHours || 0) > 0
        ).length;
        const grossPay = attData.gross_pay;

        // Calculate deductions
        const vale = dedData?.vale_amount || 0;
        const uniformPPE = dedData?.uniform_ppe_amount || 0;
        const sssLoan = dedData?.sss_salary_loan || 0;
        const sssCalamityLoan = dedData?.sss_calamity_loan || 0;
        const pagibigLoan = dedData?.pagibig_salary_loan || 0;
        const pagibigCalamityLoan = dedData?.pagibig_calamity_loan || 0;
        const sssContribution = dedData?.sss_contribution || 0;
        const philhealthContribution = dedData?.philhealth_contribution || 0;
        const pagibigContribution = dedData?.pagibig_contribution || 0;
        const withholdingTax = dedData?.withholding_tax || 0;

        const totalDeductions =
          vale +
          uniformPPE +
          sssLoan +
          sssCalamityLoan +
          pagibigLoan +
          pagibigCalamityLoan +
          sssContribution +
          philhealthContribution +
          pagibigContribution +
          withholdingTax;

        const netPay = grossPay - totalDeductions;

        allPayrollData.push({
          "Employee ID": emp.employee_id,
          "Employee Name": emp.full_name,
          "Working Days": workingDays,
          "Gross Pay": grossPay,
          Vale: vale,
          "Uniform/PPE": uniformPPE,
          "SSS Loan": sssLoan,
          "SSS Calamity Loan": sssCalamityLoan,
          "Pag-IBIG Loan": pagibigLoan,
          "Pag-IBIG Calamity Loan": pagibigCalamityLoan,
          "SSS Contribution": sssContribution,
          "PhilHealth Contribution": philhealthContribution,
          "Pag-IBIG Contribution": pagibigContribution,
          "Withholding Tax": withholdingTax,
          "Total Deductions": totalDeductions,
          "Net Pay": netPay,
        });
      }

      if (allPayrollData.length === 0) {
        toast.error("No payroll data found for this period");
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(allPayrollData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Employee ID
        { wch: 25 }, // Employee Name
        { wch: 12 }, // Working Days
        { wch: 12 }, // Gross Pay
        { wch: 10 }, // Vale
        { wch: 12 }, // Uniform/PPE
        { wch: 12 }, // SSS Loan
        { wch: 18 }, // SSS Calamity Loan
        { wch: 14 }, // Pag-IBIG Loan
        { wch: 20 }, // Pag-IBIG Calamity Loan
        { wch: 16 }, // SSS Contribution
        { wch: 20 }, // PhilHealth Contribution
        { wch: 18 }, // Pag-IBIG Contribution
        { wch: 14 }, // Withholding Tax
        { wch: 16 }, // Total Deductions
        { wch: 12 }, // Net Pay
      ];
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Payroll Summary");

      // Generate filename
      const fileName = `Payroll_${format(
        periodStart,
        "yyyy-MM-dd"
      )}_to_${format(periodEnd, "yyyy-MM-dd")}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);

      toast.success(`Excel file exported: ${allPayrollData.length} employees`);
    } catch (error: any) {
      console.error("Error exporting to Excel:", error);
      toast.error("Failed to export Excel file");
    } finally {
      setExporting(false);
    }
  }

  // Export bank transfer format for CEO
  async function exportBankTransfer() {
    setExporting(true);
    try {
      const bankTransferData = [];

      for (const emp of employees) {
        // Load attendance
        const { data: attData } = await supabase
          .from("weekly_attendance")
          .select("*")
          .eq("employee_id", emp.id)
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .maybeSingle();

        if (!attData) continue; // Skip employees without timesheet data

        // Load deductions
        const { data: dedData } = await supabase
          .from("employee_deductions")
          .select("*")
          .eq("employee_id", emp.id)
          .eq("period_start", format(periodStart, "yyyy-MM-dd"))
          .maybeSingle();

        const grossPay = attData.gross_pay;

        // Calculate deductions
        const totalDeductions =
          (dedData?.vale_amount || 0) +
          (dedData?.uniform_ppe_amount || 0) +
          (dedData?.sss_salary_loan || 0) +
          (dedData?.sss_calamity_loan || 0) +
          (dedData?.pagibig_salary_loan || 0) +
          (dedData?.pagibig_calamity_loan || 0) +
          (dedData?.sss_contribution || 0) +
          (dedData?.philhealth_contribution || 0) +
          (dedData?.pagibig_contribution || 0) +
          (dedData?.withholding_tax || 0);

        const netPay = parseFloat((grossPay - totalDeductions).toFixed(2));

        bankTransferData.push({
          "Employee ID": emp.employee_id,
          "Employee Name": emp.full_name,
          "Net Pay": netPay,
        });
      }

      if (bankTransferData.length === 0) {
        toast.error("No payroll data found for this period");
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(bankTransferData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Employee ID
        { wch: 30 }, // Employee Name
        { wch: 15 }, // Net Pay
      ];
      ws["!cols"] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, "Bank Transfer");

      // Add summary row
      const totalNetPay = bankTransferData.reduce(
        (sum, row) => sum + row["Net Pay"],
        0
      );

      // Generate filename
      const fileName = `Bank_Transfer_${format(
        periodStart,
        "yyyy-MM-dd"
      )}_to_${format(periodEnd, "yyyy-MM-dd")}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);

      toast.success(
        `Bank transfer file exported: ${
          bankTransferData.length
        } employees | Total: ${formatCurrency(totalNetPay)}`
      );
    } catch (error: any) {
      console.error("Error exporting bank transfer:", error);
      toast.error("Failed to export bank transfer file");
    } finally {
      setExporting(false);
    }
  }

  // Toggle employee selection for bulk print
  function toggleEmployeeSelection(employeeId: string) {
    setSelectedEmployeeIds((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId);
      } else {
        return [...prev, employeeId];
      }
    });
  }

  // Select/Deselect all employees
  function toggleSelectAll() {
    if (selectedEmployeeIds.length === employees.length) {
      setSelectedEmployeeIds([]);
    } else {
      setSelectedEmployeeIds(employees.map((e) => e.id));
    }
  }

  // Generate multi-payslip data
  async function prepareMultiPrint() {
    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    if (selectedEmployeeIds.length > 4) {
      toast.error("Maximum 4 payslips per page");
      return;
    }

    const payslipsData: any[] = [];

    for (const empId of selectedEmployeeIds) {
      const emp = employees.find((e) => e.id === empId);
      if (!emp) continue;

      // Load attendance for this employee
      const { data: attData } = await supabase
        .from("weekly_attendance")
        .select("*")
        .eq("employee_id", empId)
        .eq("period_start", format(periodStart, "yyyy-MM-dd"))
        .maybeSingle();

      if (!attData) continue;

      // Load deductions (optional - will default to 0 if not found)
      const { data: dedData } = await supabase
        .from("employee_deductions")
        .select("*")
        .eq("employee_id", empId)
        .eq("is_active", true)
        .maybeSingle();

      const days = attData.attendance_data as any[];
      const workingDays = days.filter(
        (day: any) => (day.regularHours || 0) > 0
      ).length;
      const grossPay = attData.gross_pay;
      const weeklyDed =
        (dedData?.vale_amount || 0) +
        (dedData?.uniform_ppe_amount || 0) +
        (dedData?.sss_salary_loan || 0) +
        (dedData?.sss_calamity_loan || 0) +
        (dedData?.pagibig_salary_loan || 0) +
        (dedData?.pagibig_calamity_loan || 0);
      const govDed =
        (applySss ? dedData?.sss_contribution || 0 : 0) +
        (applyPhilhealth ? dedData?.philhealth_contribution || 0 : 0) +
        (applyPagibig ? dedData?.pagibig_contribution || 0 : 0);
      const totalDed = weeklyDed + govDed;
      const netPay = grossPay - totalDed;

      payslipsData.push({
        employee: emp,
        periodStart,
        periodEnd: getBiMonthlyPeriodEnd(periodStart),
        earnings: {
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
          grossIncome: grossPay,
        },
        deductions: {
          vale: dedData?.vale_amount || 0,
          uniformPPE: dedData?.uniform_ppe_amount || 0,
          sssLoan: dedData?.sss_salary_loan || 0,
          sssCalamityLoan: dedData?.sss_calamity_loan || 0,
          pagibigLoan: dedData?.pagibig_salary_loan || 0,
          pagibigCalamityLoan: dedData?.pagibig_calamity_loan || 0,
          sssContribution: applySss ? dedData?.sss_contribution || 0 : 0,
          philhealthContribution: applyPhilhealth
            ? dedData?.philhealth_contribution || 0
            : 0,
          pagibigContribution: applyPagibig
            ? dedData?.pagibig_contribution || 0
            : 0,
          totalDeductions: totalDed,
        },
        adjustment: 0,
        netPay,
        workingDays,
        absentDays: 0,
        preparedBy,
      });
    }

    // Show preview modal (user will click Print button)
    setMultiPrintData(payslipsData);
    setShowMultiPrintPreview(true);
  }

  return (
    <>
      <style>{`
        @media print {
          body > div:not([class*="print:"]) {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
          }
        }
      `}</style>
      <DashboardLayout>
        <VStack gap="8" className="w-full print:hidden pb-24">
          <VStack gap="2" align="start">
            <H1>Payslip Generation</H1>
            <BodySmall>
              Generate bi-monthly payslips (2 weeks, Monday-Friday)
            </BodySmall>
          </VStack>

          <CardSection>
            <VStack gap="4">
              {/* Period Navigation */}
              <VStack gap="2" align="start">
                <Label>
                  Select Bi-Monthly Period (Monday - Friday, 2 weeks)
                </Label>
                <HStack gap="3" align="center" className="w-full">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => changePeriod("prev")}
                  >
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                  </Button>
                  <VStack gap="0" align="center" className="flex-1">
                    <p className="font-semibold text-foreground">
                      {formatBiMonthlyPeriod(periodStart, periodEnd)}
                    </p>
                    <BodySmall>
                      Period starting {format(periodStart, "MMMM d, yyyy")}
                    </BodySmall>
                  </VStack>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => changePeriod("next")}
                  >
                    <Icon name="CaretRight" size={IconSizes.sm} />
                  </Button>
                </HStack>
              </VStack>

              {/* Employee Selection */}
              <VStack gap="2" align="start">
                <Label>Select Employee</Label>
                <Select
                  value={selectedEmployeeId}
                  onValueChange={(value) => setSelectedEmployeeId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="-- Select Employee --" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </VStack>

              {/* Export Buttons */}
              <HStack gap="3" align="center" className="pt-2">
                <Button
                  onClick={exportToExcel}
                  disabled={exporting}
                  variant="secondary"
                >
                  <Icon name="FileText" size={IconSizes.sm} />
                  Export to Excel
                </Button>
                <Button onClick={exportBankTransfer} disabled={exporting}>
                  <Icon name="Buildings" size={IconSizes.sm} />
                  Bank Transfer
                </Button>
              </HStack>
            </VStack>
          </CardSection>

          {/* Bulk Print Section */}
          <CardSection
            title={
              <HStack gap="2" align="center">
                <Icon
                  name="FileText"
                  size={IconSizes.md}
                  className="text-emerald-600"
                />
                <span>Bulk Print (Legal Size)</span>
              </HStack>
            }
            description='Select up to 4 employees to print multiple payslips on one legal size paper (8.5" x 14")'
          >
            <VStack gap="4">
              <HStack justify="between" align="center">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedEmployeeIds.length === employees.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <Label className="cursor-pointer">Select All</Label>
                </label>

                <HStack gap="3" align="center">
                  <Badge
                    variant={
                      selectedEmployeeIds.length > 0 ? "default" : "secondary"
                    }
                  >
                    {selectedEmployeeIds.length} / 4 selected
                  </Badge>
                  <Button
                    onClick={prepareMultiPrint}
                    disabled={
                      selectedEmployeeIds.length === 0 ||
                      selectedEmployeeIds.length > 4
                    }
                  >
                    <Icon name="Printer" size={IconSizes.sm} />
                    Print{" "}
                    {selectedEmployeeIds.length > 0
                      ? `${selectedEmployeeIds.length}`
                      : ""}{" "}
                    Payslips
                  </Button>
                </HStack>
              </HStack>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                {employees.map((emp) => (
                  <label
                    key={emp.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedEmployeeIds.includes(emp.id)}
                      onChange={() => toggleEmployeeSelection(emp.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {emp.full_name}
                      </div>
                      <Caption>{emp.employee_id}</Caption>
                    </div>
                  </label>
                ))}
              </div>
            </VStack>
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
                  <span>No Timesheet Data</span>
                </HStack>
              }
            >
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <BodySmall className="text-yellow-800 font-medium">
                  No timesheet data found for {selectedEmployee.full_name} for
                  the period {formatBiMonthlyPeriod(periodStart, periodEnd)}
                </BodySmall>
                <BodySmall className="text-yellow-700 mt-2">
                  Please go to the <strong>Timesheet</strong> page and enter the
                  hours worked for this employee before generating a payslip.
                </BodySmall>
              </div>
            </CardSection>
          )}

          {selectedEmployee && attendance && !deductions && (
            <CardSection
              title={
                <HStack gap="2" align="center">
                  <Icon
                    name="Info"
                    size={IconSizes.md}
                    className="text-emerald-600"
                  />
                  <span>No Deduction Record</span>
                </HStack>
              }
            >
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <BodySmall className="text-emerald-800 font-medium">
                  No deduction record found for {selectedEmployee.full_name}
                </BodySmall>
                <BodySmall className="text-emerald-700 mt-2">
                  All deductions will be set to <strong>₱0.00</strong> for this
                  payslip. You can optionally add deductions on the{" "}
                  <strong>Deductions</strong> page.
                </BodySmall>
              </div>
            </CardSection>
          )}

          {selectedEmployee && attendance && (
            <>
              {/* Earnings Summary */}
              <CardSection title="Earnings Summary">
                <div className="bg-primary-50 p-4 rounded-lg">
                  <HStack justify="between" align="center">
                    <H3>Gross Pay:</H3>
                    <span className="text-2xl font-bold text-primary-700">
                      {formatCurrency(grossPay)}
                    </span>
                  </HStack>
                  <BodySmall className="mt-2">
                    Based on bi-monthly attendance entered in Timesheet
                  </BodySmall>
                </div>
              </CardSection>

              {/* Deductions */}
              <CardSection title="Deductions">
                <VStack gap="6">
                  {/* Weekly Deductions */}
                  <VStack gap="2" align="start">
                    <H4>Bi-Monthly Deductions</H4>
                    <VStack
                      gap="2"
                      className="bg-gray-50 p-4 rounded-lg w-full"
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
                      {(deductions?.uniform_ppe_amount || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <BodySmall>Uniform/PPE:</BodySmall>
                          <span className="font-semibold">
                            {formatCurrency(
                              deductions?.uniform_ppe_amount || 0
                            )}
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
                      <div className="border-t pt-2 mt-2 w-full">
                        <HStack
                          justify="between"
                          align="center"
                          className="w-full"
                        >
                          <span className="font-semibold">Subtotal:</span>
                          <span className="font-semibold">
                            {formatCurrency(weeklyDed)}
                          </span>
                        </HStack>
                      </div>
                    </VStack>
                  </VStack>

                  {/* Government Contributions */}
                  <VStack gap="3" align="start">
                    <H4>Government Contributions</H4>
                    <VStack gap="3" className="w-full">
                      <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={applySss}
                            onChange={(e) => setApplySss(e.target.checked)}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="ml-3 font-medium">
                            SSS Contribution
                          </span>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.sss_contribution || 0)}
                        </span>
                      </label>

                      <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={applyPhilhealth}
                            onChange={(e) =>
                              setApplyPhilhealth(e.target.checked)
                            }
                            className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="ml-3 font-medium">
                            PhilHealth Contribution
                          </span>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(
                            deductions?.philhealth_contribution || 0
                          )}
                        </span>
                      </label>

                      <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={applyPagibig}
                            onChange={(e) => setApplyPagibig(e.target.checked)}
                            className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="ml-3 font-medium">
                            Pag-IBIG Contribution
                          </span>
                        </div>
                        <span className="font-semibold">
                          {formatCurrency(
                            deductions?.pagibig_contribution || 0
                          )}
                        </span>
                      </label>

                      {(deductions?.withholding_tax || 0) > 0 && (
                        <HStack
                          justify="between"
                          align="center"
                          className="p-3 border rounded-lg bg-gray-50 w-full"
                        >
                          <span className="font-medium">Withholding Tax</span>
                          <span className="font-semibold">
                            {formatCurrency(deductions?.withholding_tax || 0)}
                          </span>
                        </HStack>
                      )}
                    </VStack>
                  </VStack>

                  {/* Adjustments */}
                  <VStack gap="3" align="start">
                    <H4>Adjustments</H4>
                    <VStack gap="3" className="w-full">
                      <VStack gap="2" align="start" className="w-full">
                        <Label>Adjustment Amount (+ add, - subtract)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={adjustmentAmount}
                          onChange={(e) => setAdjustmentAmount(e.target.value)}
                        />
                        <Caption>
                          Use negative for additions, positive for deductions
                        </Caption>
                      </VStack>
                      <VStack gap="2" align="start" className="w-full">
                        <Label>Adjustment Reason</Label>
                        <Textarea
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          rows={2}
                        />
                        <Caption>Explain the reason for adjustment</Caption>
                      </VStack>
                    </VStack>
                  </VStack>

                  {/* Allowance */}
                  <VStack gap="3" align="start">
                    <H4>Allowance</H4>
                    <VStack gap="2" align="start" className="w-full">
                      <Label>Allowance Amount</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={allowanceAmount}
                        onChange={(e) => setAllowanceAmount(e.target.value)}
                      />
                      <Caption>Optional allowance for this period</Caption>
                    </VStack>
                  </VStack>
                </VStack>
              </CardSection>

              {/* Summary */}
              <CardSection title="Payslip Summary">
                <VStack gap="3">
                  <HStack
                    justify="between"
                    align="center"
                    className="text-lg w-full"
                  >
                    <span className="font-medium">Gross Pay:</span>
                    <span className="font-semibold">
                      {formatCurrency(grossPay)}
                    </span>
                  </HStack>
                  <HStack
                    justify="between"
                    align="center"
                    className="text-lg text-red-600 w-full"
                  >
                    <span className="font-medium">Total Deductions:</span>
                    <span className="font-semibold">
                      ({formatCurrency(totalDed)})
                    </span>
                  </HStack>
                  {allowance > 0 && (
                    <HStack
                      justify="between"
                      align="center"
                      className="text-lg text-green-600 w-full"
                    >
                      <span className="font-medium">Allowance:</span>
                      <span className="font-semibold">
                        +{formatCurrency(allowance)}
                      </span>
                    </HStack>
                  )}
                  <div className="border-t-2 pt-3 w-full">
                    <HStack
                      justify="between"
                      align="center"
                      className="text-2xl w-full"
                    >
                      <span className="font-bold">NET PAY:</span>
                      <span className="font-bold text-primary-700">
                        {formatCurrency(netPay)}
                      </span>
                    </HStack>
                  </div>
                </VStack>

                <HStack justify="end" gap="3" className="mt-6">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setApplySss(false);
                      setApplyPhilhealth(false);
                      setApplyPagibig(false);
                      setAdjustmentAmount("0");
                      setAdjustmentReason("");
                      setAllowanceAmount("0");
                    }}
                  >
                    Reset
                  </Button>
                  <Button
                    onClick={() => setShowPrintModal(true)}
                    variant="secondary"
                  >
                    <Icon name="Eye" size={IconSizes.sm} />
                    Preview & Print Payslip
                  </Button>
                  <Button onClick={generatePayslip} disabled={generating}>
                    <Icon name="FileText" size={IconSizes.sm} />
                    Save Payslip to Database
                  </Button>
                </HStack>
              </CardSection>
            </>
          )}

          {selectedEmployee && !attendance && (
            <Card>
              <CardContent className="text-center py-12">
                <VStack gap="4" align="center">
                  <Icon
                    name="FileText"
                    size={IconSizes.xl}
                    className="text-muted-foreground"
                  />
                  <H3>No Attendance Record Found</H3>
                  <BodySmall>
                    Please enter attendance for this employee and period in the
                    Timesheet page first.
                  </BodySmall>
                  <Button onClick={() => (window.location.href = "/timesheet")}>
                    Go to Timesheet
                  </Button>
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
                      employee={selectedEmployee as any}
                      weekStart={periodStart}
                      weekEnd={periodEnd}
                      attendance={attendance}
                      earnings={calculateEarningsBreakdown()}
                      deductions={{
                        vale: deductions?.vale_amount || 0,
                        uniformPPE: deductions?.uniform_ppe_amount || 0,
                        sssLoan: deductions?.sss_salary_loan || 0,
                        sssCalamityLoan: deductions?.sss_calamity_loan || 0,
                        pagibigLoan: deductions?.pagibig_salary_loan || 0,
                        pagibigCalamityLoan:
                          deductions?.pagibig_calamity_loan || 0,
                        sssContribution: applySss
                          ? deductions?.sss_contribution || 0
                          : 0,
                        philhealthContribution: applyPhilhealth
                          ? deductions?.philhealth_contribution || 0
                          : 0,
                        pagibigContribution: applyPagibig
                          ? deductions?.pagibig_contribution || 0
                          : 0,
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
                      <Button onClick={() => window.print()}>
                        <Icon name="Printer" size={IconSizes.sm} />
                        Print Payslip
                      </Button>
                    </DialogFooter>
                  </VStack>
                </>
              )}
            </DialogContent>
          </Dialog>

          {/* Multi-Print Preview Modal */}
          <Dialog
            open={showMultiPrintPreview}
            onOpenChange={(open) => {
              if (!open) {
                setShowMultiPrintPreview(false);
                setMultiPrintData([]);
              }
            }}
          >
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              {multiPrintData.length > 0 && (
                <>
                  <DialogHeader>
                    <DialogTitle>
                      Print {multiPrintData.length} Payslips
                    </DialogTitle>
                  </DialogHeader>
                  <VStack gap="4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <HStack gap="2" align="center">
                        <Icon
                          name="FileText"
                          size={IconSizes.sm}
                          className="text-emerald-600"
                        />
                        <BodySmall className="text-emerald-800">
                          <strong>{multiPrintData.length} payslips</strong>{" "}
                          ready to print. Set paper to{" "}
                          <strong>Legal (8.5" × 14")</strong> when printing.
                        </BodySmall>
                      </HStack>
                    </div>

                    <div className="print:block">
                      <PayslipMultiPrint payslips={multiPrintData} />
                    </div>

                    <DialogFooter className="print:hidden">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setShowMultiPrintPreview(false);
                          setMultiPrintData([]);
                        }}
                      >
                        Close
                      </Button>
                      <Button onClick={() => window.print()}>
                        <Icon name="Printer" size={IconSizes.sm} />
                        Print {multiPrintData.length} Payslips
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
