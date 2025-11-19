'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Select, Textarea } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Badge } from '@/components/Badge';
import { Modal } from '@/components/Modal';
import { PayslipPrint } from '@/components/PayslipPrint';
import { PayslipMultiPrint } from '@/components/PayslipMultiPrint';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, getWeek, addWeeks, subWeeks } from 'date-fns';
import { formatCurrency, generatePayslipNumber } from '@/utils/format';
import { getWeekOfMonth } from '@/utils/holidays';
import * as XLSX from 'xlsx';
import { ChevronLeft, ChevronRight, FileSpreadsheet, Building2, FileText, Printer, Eye, AlertCircle, Info } from 'lucide-react';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  rate_per_day: number;
  rate_per_hour: number;
  bank_account_number?: string;
}

interface WeeklyAttendance {
  id: string;
  week_start_date: string;
  week_end_date: string;
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
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [weekStart, setWeekStart] = useState<Date>(
    startOfWeek(new Date(), { weekStartsOn: 3 }) // Week starts on Wednesday
  );
  const [attendance, setAttendance] = useState<WeeklyAttendance | null>(null);
  const [deductions, setDeductions] = useState<EmployeeDeductions | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Payslip form data
  const [applySss, setApplySss] = useState(false);
  const [applyPhilhealth, setApplyPhilhealth] = useState(false);
  const [applyPagibig, setApplyPagibig] = useState(false);
  const [adjustmentAmount, setAdjustmentAmount] = useState('0');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [allowanceAmount, setAllowanceAmount] = useState('0');
  const [preparedBy, setPreparedBy] = useState('Melanie R. Sapinoso');
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [multiPrintData, setMultiPrintData] = useState<any[]>([]);
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
  }, [selectedEmployeeId, weekStart]);

  // Auto-set allowance for 4th week
  useEffect(() => {
    const weekNumber = getWeekOfMonth(weekStart);
    if (weekNumber === 4) {
      setAllowanceAmount('500'); // Default allowance, user can change
    } else {
      setAllowanceAmount('0');
    }
  }, [weekStart]);

  async function loadEmployees() {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, rate_per_day, rate_per_hour, bank_account_number')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error loading employees:', error);
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }

  async function loadAttendanceAndDeductions() {
    if (!selectedEmployeeId) return;

    try {
      console.log('Loading data for employee:', selectedEmployeeId);
      console.log('Week start date:', format(weekStart, 'yyyy-MM-dd'));
      
      // Load attendance
      const { data: attData, error: attError } = await supabase
        .from('weekly_attendance')
        .select('*')
        .eq('employee_id', selectedEmployeeId)
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
        .maybeSingle();

      console.log('Attendance query result:', { attData, attError });
      
      if (attError) {
        console.error('Attendance error:', attError);
        throw attError;
      }
      setAttendance(attData);

      // Load deductions for this week
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');
      const { data: dedData, error: dedError } = await supabase
        .from('employee_deductions')
        .select('*')
        .eq('employee_id', selectedEmployeeId)
        .eq('week_start_date', weekStartStr)
        .maybeSingle();

      console.log('Deductions query result:', { dedData, dedError });
      
      if (dedError) {
        console.error('Deductions error:', dedError);
        throw dedError;
      }
      setDeductions(dedData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load attendance/deductions');
    }
  }

  function changeWeek(direction: 'prev' | 'next') {
    const newWeekStart = addDays(weekStart, direction === 'next' ? 7 : -7);
    setWeekStart(newWeekStart);
  }

  async function generatePayslip() {
    if (!selectedEmployee || !attendance) {
      toast.error('Missing timesheet data');
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
      const sssAmount = applySss ? (deductions?.sss_contribution || 0) : 0;
      const philhealthAmount = applyPhilhealth ? (deductions?.philhealth_contribution || 0) : 0;
      const pagibigAmount = applyPagibig ? (deductions?.pagibig_contribution || 0) : 0;

      totalDeductions += sssAmount + philhealthAmount + pagibigAmount + (deductions?.withholding_tax || 0);

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
      const year = weekStart.getFullYear();
      const weekNumber = getWeek(weekStart);
      const payslipNumber = generatePayslipNumber(
        selectedEmployee.employee_id,
        weekNumber,
        year
      );

      const weekEnd = addDays(weekStart, 6);

      const payslipData = {
        employee_id: selectedEmployee.id,
        payslip_number: payslipNumber,
        week_number: weekNumber,
        week_start_date: format(weekStart, 'yyyy-MM-dd'),
        week_end_date: format(weekEnd, 'yyyy-MM-dd'),
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
        status: 'draft',
      };

      // Check if payslip already exists
      const { data: existing } = await supabase
        .from('payslips')
        .select('id')
        .eq('payslip_number', payslipNumber)
        .single();

      if (existing) {
        // Update
        const { error } = await supabase
          .from('payslips')
          .update(payslipData)
          .eq('id', existing.id);

        if (error) throw error;
        toast.success('Payslip updated successfully');
      } else {
        // Create
        const { error } = await supabase.from('payslips').insert([payslipData]);

        if (error) throw error;
        toast.success('Payslip generated successfully');
      }
    } catch (error: any) {
      console.error('Error generating payslip:', error);
      toast.error(error.message || 'Failed to generate payslip');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner size="lg" className="mt-20" />
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

  const weekNumber = getWeekOfMonth(weekStart);

  // Helper function to calculate earnings breakdown from attendance data
  function calculateEarningsBreakdown() {
    if (!attendance || !attendance.attendance_data) {
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
        grossIncome: 0,
      };
    }

    const days = attendance.attendance_data as any[];
    let regularPay = 0;
    let regularOT = 0;
    let regularOTHours = 0;
    let nightDiff = 0;
    let nightDiffHours = 0;
    let sundayRestDay = 0;
    let sundayRestDayHours = 0;
    let specialHoliday = 0;
    let specialHolidayHours = 0;
    let regularHoliday = 0;
    let regularHolidayHours = 0;

    days.forEach((day: any) => {
      const dayType = day.dayType;
      const regHours = day.regularHours || 0;
      const otHours = day.overtimeHours || 0;
      const ndHours = day.nightDiffHours || 0;

      // Regular day pay
      if (dayType === 'regular') {
        regularPay += (regHours * (selectedEmployee?.rate_per_hour || 0));
        regularOTHours += otHours;
        regularOT += (otHours * (selectedEmployee?.rate_per_hour || 0) * 1.25);
      }

      // Sunday/Rest day
      if (dayType === 'sunday') {
        sundayRestDayHours += regHours + otHours;
        sundayRestDay += (regHours * (selectedEmployee?.rate_per_hour || 0) * 1.3);
        if (otHours > 0) {
          sundayRestDay += ((otHours * (selectedEmployee?.rate_per_hour || 0) * 1.3) * 1.3);
        }
      }

      // Non-working holiday (Special holiday)
      if (dayType === 'non-working-holiday') {
        specialHolidayHours += regHours + otHours;
        specialHoliday += (regHours * (selectedEmployee?.rate_per_hour || 0) * 1.3);
        if (otHours > 0) {
          specialHoliday += ((otHours * (selectedEmployee?.rate_per_hour || 0) * 1.3) * 1.3);
        }
      }

      // Regular holiday
      if (dayType === 'regular-holiday') {
        regularHolidayHours += regHours + otHours;
        regularHoliday += (regHours * (selectedEmployee?.rate_per_hour || 0) * 2);
        if (otHours > 0) {
          regularHoliday += ((otHours * (selectedEmployee?.rate_per_hour || 0) * 2) * 1.3);
        }
      }

      // Sunday + Special Holiday
      if (dayType === 'sunday-special-holiday') {
        specialHolidayHours += regHours + otHours;
        specialHoliday += (regHours * (selectedEmployee?.rate_per_hour || 0) * 1.5);
        if (otHours > 0) {
          specialHoliday += ((otHours * (selectedEmployee?.rate_per_hour || 0) * 1.5) * 1.3);
        }
      }

      // Sunday + Regular Holiday
      if (dayType === 'sunday-regular-holiday') {
        regularHolidayHours += regHours + otHours;
        regularHoliday += (regHours * (selectedEmployee?.rate_per_hour || 0) * 2.6);
        if (otHours > 0) {
          regularHoliday += ((otHours * (selectedEmployee?.rate_per_hour || 0) * 2.6) * 1.3);
        }
      }

      // Night differential
      if (ndHours > 0) {
        nightDiffHours += ndHours;
        nightDiff += (ndHours * (selectedEmployee?.rate_per_hour || 0) * 0.1);
      }
    });

    return {
      regularPay,
      regularOT,
      regularOTHours,
      nightDiff,
      nightDiffHours,
      sundayRestDay,
      sundayRestDayHours,
      specialHoliday,
      specialHolidayHours,
      regularHoliday,
      regularHolidayHours,
      grossIncome: attendance.gross_pay || 0,
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
          .from('weekly_attendance')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
          .maybeSingle();

        if (!attData) continue; // Skip employees without timesheet data

        // Load deductions
        const { data: dedData } = await supabase
          .from('employee_deductions')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
          .maybeSingle();

        // Calculate earnings breakdown
        const days = attData.attendance_data as any[];
        let regularPay = 0;
        let regularOT = 0;
        let regularOTHours = 0;
        let nightDiff = 0;
        let nightDiffHours = 0;
        let sundayRestDay = 0;
        let sundayRestDayHours = 0;
        let specialHoliday = 0;
        let specialHolidayHours = 0;
        let regularHoliday = 0;
        let regularHolidayHours = 0;

        days.forEach((day: any) => {
          const dayType = day.dayType;
          const regHours = day.regularHours || 0;
          const otHours = day.overtimeHours || 0;
          const ndHours = day.nightDiffHours || 0;

          if (dayType === 'regular') {
            regularPay += (regHours * emp.rate_per_hour);
            regularOTHours += otHours;
            regularOT += (otHours * emp.rate_per_hour * 1.25);
          }

          if (dayType === 'sunday') {
            sundayRestDayHours += regHours + otHours;
            sundayRestDay += (regHours * emp.rate_per_hour * 1.3);
            if (otHours > 0) {
              sundayRestDay += ((otHours * emp.rate_per_hour * 1.3) * 1.3);
            }
          }

          if (dayType === 'non-working-holiday') {
            specialHolidayHours += regHours + otHours;
            specialHoliday += (regHours * emp.rate_per_hour * 1.3);
            if (otHours > 0) {
              specialHoliday += ((otHours * emp.rate_per_hour * 1.3) * 1.3);
            }
          }

          if (dayType === 'regular-holiday') {
            regularHolidayHours += regHours + otHours;
            regularHoliday += (regHours * emp.rate_per_hour * 2);
            if (otHours > 0) {
              regularHoliday += ((otHours * emp.rate_per_hour * 2) * 1.3);
            }
          }

          if (dayType === 'sunday-special-holiday') {
            specialHolidayHours += regHours + otHours;
            specialHoliday += (regHours * emp.rate_per_hour * 1.5);
            if (otHours > 0) {
              specialHoliday += ((otHours * emp.rate_per_hour * 1.5) * 1.3);
            }
          }

          if (dayType === 'sunday-regular-holiday') {
            regularHolidayHours += regHours + otHours;
            regularHoliday += (regHours * emp.rate_per_hour * 2.6);
            if (otHours > 0) {
              regularHoliday += ((otHours * emp.rate_per_hour * 2.6) * 1.3);
            }
          }

          if (ndHours > 0) {
            nightDiffHours += ndHours;
            nightDiff += (ndHours * emp.rate_per_hour * 0.1);
          }
        });

        const workingDays = days.filter((day: any) => (day.regularHours || 0) > 0).length;
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

        const totalDeductions = vale + uniformPPE + sssLoan + sssCalamityLoan + 
                                pagibigLoan + pagibigCalamityLoan + sssContribution + 
                                philhealthContribution + pagibigContribution + withholdingTax;

        const netPay = grossPay - totalDeductions;

        allPayrollData.push({
          'Employee ID': emp.employee_id,
          'Employee Name': emp.full_name,
          'Rate/Hour': emp.rate_per_hour,
          'Working Days': workingDays,
          'Regular Pay': regularPay,
          'Regular OT Hours': regularOTHours,
          'Regular OT Pay': regularOT,
          'Night Diff Hours': nightDiffHours,
          'Night Diff Pay': nightDiff,
          'Sunday/RD Hours': sundayRestDayHours,
          'Sunday/RD Pay': sundayRestDay,
          'Special Holiday Hours': specialHolidayHours,
          'Special Holiday Pay': specialHoliday,
          'Regular Holiday Hours': regularHolidayHours,
          'Regular Holiday Pay': regularHoliday,
          'Gross Pay': grossPay,
          'Vale': vale,
          'Uniform/PPE': uniformPPE,
          'SSS Loan': sssLoan,
          'SSS Calamity Loan': sssCalamityLoan,
          'Pag-IBIG Loan': pagibigLoan,
          'Pag-IBIG Calamity Loan': pagibigCalamityLoan,
          'SSS Contribution': sssContribution,
          'PhilHealth Contribution': philhealthContribution,
          'Pag-IBIG Contribution': pagibigContribution,
          'Withholding Tax': withholdingTax,
          'Total Deductions': totalDeductions,
          'Net Pay': netPay,
        });
      }

      if (allPayrollData.length === 0) {
        toast.error('No payroll data found for this week');
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(allPayrollData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Employee ID
        { wch: 25 }, // Employee Name
        { wch: 10 }, // Rate/Hour
        { wch: 12 }, // Working Days
        { wch: 12 }, // Regular Pay
        { wch: 14 }, // Regular OT Hours
        { wch: 14 }, // Regular OT Pay
        { wch: 14 }, // Night Diff Hours
        { wch: 14 }, // Night Diff Pay
        { wch: 14 }, // Sunday/RD Hours
        { wch: 14 }, // Sunday/RD Pay
        { wch: 18 }, // Special Holiday Hours
        { wch: 18 }, // Special Holiday Pay
        { wch: 18 }, // Regular Holiday Hours
        { wch: 18 }, // Regular Holiday Pay
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
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Payroll Summary');

      // Generate filename
      const fileName = `Payroll_${format(weekStart, 'yyyy-MM-dd')}_to_${format(addDays(weekStart, 6), 'yyyy-MM-dd')}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);

      toast.success(`Excel file exported: ${allPayrollData.length} employees`);
    } catch (error: any) {
      console.error('Error exporting to Excel:', error);
      toast.error('Failed to export Excel file');
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
          .from('weekly_attendance')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
          .maybeSingle();

        if (!attData) continue; // Skip employees without timesheet data

        // Load deductions
        const { data: dedData } = await supabase
          .from('employee_deductions')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
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
          'Employee ID': emp.employee_id,
          'Employee Name': emp.full_name,
          'Bank Account Number': emp.bank_account_number || 'NOT SET',
          'Net Pay': netPay,
        });
      }

      if (bankTransferData.length === 0) {
        toast.error('No payroll data found for this week');
        return;
      }

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(bankTransferData);

      // Set column widths
      const colWidths = [
        { wch: 12 }, // Employee ID
        { wch: 30 }, // Employee Name
        { wch: 25 }, // Bank Account Number
        { wch: 15 }, // Net Pay
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Bank Transfer');

      // Add summary row
      const totalNetPay = bankTransferData.reduce((sum, row) => sum + row['Net Pay'], 0);
      
      // Generate filename
      const fileName = `Bank_Transfer_${format(weekStart, 'yyyy-MM-dd')}_to_${format(addDays(weekStart, 6), 'yyyy-MM-dd')}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);

      toast.success(`Bank transfer file exported: ${bankTransferData.length} employees | Total: ${formatCurrency(totalNetPay)}`);
    } catch (error: any) {
      console.error('Error exporting bank transfer:', error);
      toast.error('Failed to export bank transfer file');
    } finally {
      setExporting(false);
    }
  }

  // Toggle employee selection for bulk print
  function toggleEmployeeSelection(employeeId: string) {
    setSelectedEmployeeIds(prev => {
      if (prev.includes(employeeId)) {
        return prev.filter(id => id !== employeeId);
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
      setSelectedEmployeeIds(employees.map(e => e.id));
    }
  }

  // Generate multi-payslip data
  async function prepareMultiPrint() {
    if (selectedEmployeeIds.length === 0) {
      toast.error('Please select at least one employee');
      return;
    }

    if (selectedEmployeeIds.length > 4) {
      toast.error('Maximum 4 payslips per page');
      return;
    }

    const payslipsData: any[] = [];

    for (const empId of selectedEmployeeIds) {
      const emp = employees.find(e => e.id === empId);
      if (!emp) continue;

      // Load attendance for this employee
      const { data: attData } = await supabase
        .from('weekly_attendance')
        .select('*')
        .eq('employee_id', empId)
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
        .maybeSingle();

      if (!attData) continue;

      // Load deductions (optional - will default to 0 if not found)
      const { data: dedData } = await supabase
        .from('employee_deductions')
        .select('*')
        .eq('employee_id', empId)
        .eq('is_active', true)
        .maybeSingle();

      // Calculate earnings breakdown
      const days = attData.attendance_data as any[];
      let regularPay = 0;
      let regularOT = 0;
      let regularOTHours = 0;
      let nightDiff = 0;
      let nightDiffHours = 0;
      let sundayRestDay = 0;
      let sundayRestDayHours = 0;
      let specialHoliday = 0;
      let specialHolidayHours = 0;
      let regularHoliday = 0;
      let regularHolidayHours = 0;

      days.forEach((day: any) => {
        const dayType = day.dayType;
        const regHours = day.regularHours || 0;
        const otHours = day.overtimeHours || 0;
        const ndHours = day.nightDiffHours || 0;

        if (dayType === 'regular') {
          regularPay += (regHours * emp.rate_per_hour);
          regularOTHours += otHours;
          regularOT += (otHours * emp.rate_per_hour * 1.25);
        }

        if (dayType === 'sunday') {
          sundayRestDayHours += regHours + otHours;
          sundayRestDay += (regHours * emp.rate_per_hour * 1.3);
          if (otHours > 0) {
            sundayRestDay += ((otHours * emp.rate_per_hour * 1.3) * 1.3);
          }
        }

        if (dayType === 'non-working-holiday') {
          specialHolidayHours += regHours + otHours;
          specialHoliday += (regHours * emp.rate_per_hour * 1.3);
          if (otHours > 0) {
            specialHoliday += ((otHours * emp.rate_per_hour * 1.3) * 1.3);
          }
        }

        if (dayType === 'regular-holiday') {
          regularHolidayHours += regHours + otHours;
          regularHoliday += (regHours * emp.rate_per_hour * 2);
          if (otHours > 0) {
            regularHoliday += ((otHours * emp.rate_per_hour * 2) * 1.3);
          }
        }

        if (dayType === 'sunday-special-holiday') {
          specialHolidayHours += regHours + otHours;
          specialHoliday += (regHours * emp.rate_per_hour * 1.5);
          if (otHours > 0) {
            specialHoliday += ((otHours * emp.rate_per_hour * 1.5) * 1.3);
          }
        }

        if (dayType === 'sunday-regular-holiday') {
          regularHolidayHours += regHours + otHours;
          regularHoliday += (regHours * emp.rate_per_hour * 2.6);
          if (otHours > 0) {
            regularHoliday += ((otHours * emp.rate_per_hour * 2.6) * 1.3);
          }
        }

        if (ndHours > 0) {
          nightDiffHours += ndHours;
          nightDiff += (ndHours * emp.rate_per_hour * 0.1);
        }
      });

      const workingDays = days.filter((day: any) => (day.regularHours || 0) > 0).length;
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
        weekStart,
        weekEnd: addDays(weekStart, 6),
        earnings: {
          regularPay,
          regularOT,
          regularOTHours,
          nightDiff,
          nightDiffHours,
          sundayRestDay,
          sundayRestDayHours,
          specialHoliday,
          specialHolidayHours,
          regularHoliday,
          regularHolidayHours,
          grossIncome: grossPay,
        },
        deductions: {
          vale: dedData?.vale_amount || 0,
          uniformPPE: dedData?.uniform_ppe_amount || 0,
          sssLoan: dedData?.sss_salary_loan || 0,
          sssCalamityLoan: dedData?.sss_calamity_loan || 0,
          pagibigLoan: dedData?.pagibig_salary_loan || 0,
          pagibigCalamityLoan: dedData?.pagibig_calamity_loan || 0,
          sssContribution: applySss ? (dedData?.sss_contribution || 0) : 0,
          philhealthContribution: applyPhilhealth ? (dedData?.philhealth_contribution || 0) : 0,
          pagibigContribution: applyPagibig ? (dedData?.pagibig_contribution || 0) : 0,
          totalDeductions: totalDed,
        },
        adjustment: 0,
        netPay,
        workingDays,
        absentDays: 0,
        preparedBy,
      });
    }

    // Open print directly without modal
    setMultiPrintData(payslipsData);
    setTimeout(() => {
      window.print();
    }, 100);
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
      <div className="space-y-6 print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payslip Generation</h1>
          <p className="text-gray-600 mt-1">
            Generate weekly payslips (Wednesday to Tuesday) with automatic calculations
          </p>
        </div>

        <Card>
          <div className="space-y-4">
            {/* Week Navigation */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Week (Wednesday - Tuesday)
              </label>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => changeWeek('prev')}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <div className="flex-1 text-center">
                  <div className="font-semibold text-gray-900">
                    {format(weekStart, 'MMM d, yyyy')} -{' '}
                    {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                  </div>
                  <div className="text-sm text-gray-500 flex items-center justify-center gap-2">
                    Week of {format(weekStart, 'MMMM d, yyyy')}
                    <Badge variant={weekNumber === 4 ? 'success' : 'info'}>
                      Week {weekNumber}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => changeWeek('next')}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Employee Selection */}
            <Select
              label="Select Employee"
              options={[
                { value: '', label: '-- Select Employee --' },
                ...employees.map((emp) => ({
                  value: emp.id,
                  label: `${emp.full_name} (${emp.employee_id})`,
                })),
              ]}
              value={selectedEmployeeId}
              onChange={(e) => setSelectedEmployeeId(e.target.value)}
            />

            {/* Export Buttons */}
            <div className="flex gap-3 pt-2">
              <Button 
                onClick={exportToExcel} 
                isLoading={exporting}
                variant="secondary"
                className="flex items-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Export to Excel
              </Button>
              <Button 
                onClick={exportBankTransfer} 
                isLoading={exporting}
                className="flex items-center gap-2"
              >
                <Building2 className="w-4 h-4" />
                Bank Transfer
              </Button>
            </div>
          </div>
        </Card>

        {/* Bulk Print Section */}
        <Card 
          title={
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span>Bulk Print (Legal Size)</span>
            </div>
          }
        >
          <p className="text-sm text-gray-600 mb-4">
            Select up to 4 employees to print multiple payslips on one legal size paper (8.5" × 14")
          </p>
          
          <div className="mb-4 flex items-center justify-between">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedEmployeeIds.length === employees.length}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Select All</span>
            </label>
            
            <div className="flex items-center gap-3">
              <Badge variant={selectedEmployeeIds.length > 0 ? 'success' : 'default'}>
                {selectedEmployeeIds.length} / 4 selected
              </Badge>
              <Button
                onClick={prepareMultiPrint}
                disabled={selectedEmployeeIds.length === 0 || selectedEmployeeIds.length > 4}
                className="flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                Print {selectedEmployeeIds.length > 0 ? `${selectedEmployeeIds.length}` : ''} Payslips
              </Button>
            </div>
          </div>

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
                  <div className="font-medium text-gray-900">{emp.full_name}</div>
                  <div className="text-xs text-gray-500">{emp.employee_id}</div>
                </div>
              </label>
            ))}
          </div>
        </Card>

        {/* Missing Data Messages */}
        {selectedEmployee && !attendance && (
          <Card 
            title={
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <span>No Timesheet Data</span>
              </div>
            }
          >
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 font-medium">
                No timesheet data found for {selectedEmployee.full_name} for the week of{' '}
                {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}
              </p>
              <p className="text-yellow-700 text-sm mt-2">
                Please go to the <strong>Timesheet</strong> page and enter the hours worked for this employee before generating a payslip.
              </p>
            </div>
          </Card>
        )}

        {selectedEmployee && attendance && !deductions && (
          <Card 
            title={
              <div className="flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-600" />
                <span>No Deduction Record</span>
              </div>
            }
          >
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800 font-medium">
                No deduction record found for {selectedEmployee.full_name}
              </p>
              <p className="text-blue-700 text-sm mt-2">
                All deductions will be set to <strong>₱0.00</strong> for this payslip. You can optionally add deductions on the <strong>Deductions</strong> page.
              </p>
            </div>
          </Card>
        )}

        {selectedEmployee && attendance && (
          <>
            {/* Earnings Summary */}
            <Card title="Earnings Summary">
              <div className="bg-primary-50 p-4 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-700">Gross Pay:</span>
                  <span className="text-2xl font-bold text-primary-700">
                    {formatCurrency(grossPay)}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  Based on weekly attendance entered in Timesheet
                </p>
              </div>
            </Card>

            {/* Deductions */}
            <Card title="Deductions">
              <div className="space-y-6">
                {/* Weekly Deductions */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Weekly Deductions</h4>
                  <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                    {(deductions?.vale_amount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vale:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.vale_amount || 0)}
                        </span>
                      </div>
                    )}
                    {(deductions?.uniform_ppe_amount || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Uniform/PPE:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.uniform_ppe_amount || 0)}
                        </span>
                      </div>
                    )}
                    {(deductions?.sss_salary_loan || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SSS Salary Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.sss_salary_loan || 0)}
                        </span>
                      </div>
                    )}
                    {(deductions?.sss_calamity_loan || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SSS Calamity Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.sss_calamity_loan || 0)}
                        </span>
                      </div>
                    )}
                    {(deductions?.pagibig_salary_loan || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pag-IBIG Salary Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.pagibig_salary_loan || 0)}
                        </span>
                      </div>
                    )}
                    {(deductions?.pagibig_calamity_loan || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pag-IBIG Calamity Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.pagibig_calamity_loan || 0)}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span>Subtotal:</span>
                        <span>{formatCurrency(weeklyDed)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Government Contributions */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">
                    Government Contributions (Check for 3rd/4th week)
                  </h4>
                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={applySss}
                          onChange={(e) => setApplySss(e.target.checked)}
                          className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="ml-3 font-medium">SSS Contribution</span>
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
                          onChange={(e) => setApplyPhilhealth(e.target.checked)}
                          className="w-5 h-5 text-primary-600 rounded focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="ml-3 font-medium">PhilHealth Contribution</span>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(deductions?.philhealth_contribution || 0)}
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
                        <span className="ml-3 font-medium">Pag-IBIG Contribution</span>
                      </div>
                      <span className="font-semibold">
                        {formatCurrency(deductions?.pagibig_contribution || 0)}
                      </span>
                    </label>

                    {(deductions?.withholding_tax || 0) > 0 && (
                      <div className="flex justify-between p-3 border rounded-lg bg-gray-50">
                        <span className="font-medium">Withholding Tax</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions?.withholding_tax || 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Adjustments */}
                <div>
                  <h4 className="font-semibold text-gray-700 mb-3">Adjustments</h4>
                  <div className="space-y-3">
                    <Input
                      label="Adjustment Amount (+ add, - subtract)"
                      type="number"
                      step="0.01"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      helperText="Use negative for additions, positive for deductions"
                    />
                    <Textarea
                      label="Adjustment Reason"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      rows={2}
                      helperText="Explain the reason for adjustment"
                    />
                  </div>
                </div>

                {/* Allowance */}
                {weekNumber === 4 && (
                  <div className="bg-green-50 p-4 rounded-lg border-2 border-green-200">
                    <h4 className="font-semibold text-green-800 mb-3">
                      4th Week Allowance/Load 🎉
                    </h4>
                    <Input
                      label="Allowance Amount"
                      type="number"
                      step="0.01"
                      value={allowanceAmount}
                      onChange={(e) => setAllowanceAmount(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* Summary */}
            <Card title="Payslip Summary">
              <div className="space-y-3">
                <div className="flex justify-between text-lg">
                  <span className="font-medium">Gross Pay:</span>
                  <span className="font-semibold">{formatCurrency(grossPay)}</span>
                </div>
                <div className="flex justify-between text-lg text-red-600">
                  <span className="font-medium">Total Deductions:</span>
                  <span className="font-semibold">({formatCurrency(totalDed)})</span>
                </div>
                {allowance > 0 && (
                  <div className="flex justify-between text-lg text-green-600">
                    <span className="font-medium">Allowance:</span>
                    <span className="font-semibold">+{formatCurrency(allowance)}</span>
                  </div>
                )}
                <div className="border-t-2 pt-3">
                  <div className="flex justify-between text-2xl">
                    <span className="font-bold">NET PAY:</span>
                    <span className="font-bold text-primary-700">
                      {formatCurrency(netPay)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setApplySss(false);
                    setApplyPhilhealth(false);
                    setApplyPagibig(false);
                    setAdjustmentAmount('0');
                    setAdjustmentReason('');
                    setAllowanceAmount(weekNumber === 4 ? '500' : '0');
                  }}
                >
                  Reset
                </Button>
                <Button 
                  onClick={() => setShowPrintModal(true)} 
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Preview & Print Payslip
                </Button>
                <Button 
                  onClick={generatePayslip} 
                  isLoading={generating}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Save Payslip to Database
                </Button>
              </div>
            </Card>
          </>
        )}

        {selectedEmployee && !attendance && (
          <Card>
            <div className="text-center py-12 text-gray-500">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold mb-2">No Attendance Record Found</h3>
              <p className="mb-4">
                Please enter attendance for this employee and week in the Timesheet page first.
              </p>
              <Button onClick={() => (window.location.href = '/timesheet')}>
                Go to Timesheet
              </Button>
            </div>
          </Card>
        )}

        {/* Print Modal */}
        {showPrintModal && selectedEmployee && attendance && (
          <Modal
            title="Payslip Preview"
            isOpen={showPrintModal}
            onClose={() => setShowPrintModal(false)}
            size="xl"
          >
            <div className="space-y-4">
              <PayslipPrint
                employee={selectedEmployee}
                weekStart={weekStart}
                weekEnd={addDays(weekStart, 6)}
                attendance={attendance}
                earnings={calculateEarningsBreakdown()}
                deductions={{
                  vale: deductions?.vale_amount || 0,
                  uniformPPE: deductions?.uniform_ppe_amount || 0,
                  sssLoan: deductions?.sss_salary_loan || 0,
                  sssCalamityLoan: deductions?.sss_calamity_loan || 0,
                  pagibigLoan: deductions?.pagibig_salary_loan || 0,
                  pagibigCalamityLoan: deductions?.pagibig_calamity_loan || 0,
                  sssContribution: applySss ? (deductions?.sss_contribution || 0) : 0,
                  philhealthContribution: applyPhilhealth ? (deductions?.philhealth_contribution || 0) : 0,
                  pagibigContribution: applyPagibig ? (deductions?.pagibig_contribution || 0) : 0,
                  totalDeductions: totalDed,
                }}
                adjustment={adjustment}
                netPay={netPay}
                workingDays={calculateWorkingDays()}
                absentDays={0}
                preparedBy={preparedBy}
              />
              <div className="flex justify-end gap-3 mt-4 print:hidden">
                <Button variant="secondary" onClick={() => setShowPrintModal(false)}>
                  Close
                </Button>
                <Button onClick={() => window.print()}>
                  Print Payslip
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Hidden Multi-Print Container - Only visible when printing */}
        {multiPrintData.length > 0 && (
          <div className="hidden print:block">
            <PayslipMultiPrint payslips={multiPrintData} />
          </div>
        )}
      </div>
    </DashboardLayout>
    </>
  );
}

