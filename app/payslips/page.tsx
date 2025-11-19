'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { Input, Select, Textarea } from '@/components/Input';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { Badge } from '@/components/Badge';
import toast from 'react-hot-toast';
import { format, startOfWeek, addDays, getWeek } from 'date-fns';
import { formatCurrency, generatePayslipNumber } from '@/utils/format';
import { getWeekOfMonth } from '@/utils/holidays';

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  rate_per_day: number;
  rate_per_hour: number;
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
    startOfWeek(new Date(), { weekStartsOn: 1 })
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
        .select('*')
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
      // Load attendance
      const { data: attData, error: attError } = await supabase
        .from('weekly_attendance')
        .select('*')
        .eq('employee_id', selectedEmployeeId)
        .eq('week_start_date', format(weekStart, 'yyyy-MM-dd'))
        .single();

      if (attError && attError.code !== 'PGRST116') throw attError;
      setAttendance(attData);

      // Load deductions
      const { data: dedData, error: dedError } = await supabase
        .from('employee_deductions')
        .select('*')
        .eq('employee_id', selectedEmployeeId)
        .eq('is_active', true)
        .single();

      if (dedError && dedError.code !== 'PGRST116') throw dedError;
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
    if (!selectedEmployee || !attendance || !deductions) {
      toast.error('Missing required data');
      return;
    }

    setGenerating(true);

    try {
      // Calculate totals
      const grossPay = attendance.gross_pay;

      // Weekly deductions (always applied)
      let totalDeductions =
        deductions.vale_amount +
        deductions.uniform_ppe_amount +
        deductions.sss_salary_loan +
        deductions.sss_calamity_loan +
        deductions.pagibig_salary_loan +
        deductions.pagibig_calamity_loan;

      // Government contributions (checkbox controlled)
      const sssAmount = applySss ? deductions.sss_contribution : 0;
      const philhealthAmount = applyPhilhealth ? deductions.philhealth_contribution : 0;
      const pagibigAmount = applyPagibig ? deductions.pagibig_contribution : 0;

      totalDeductions += sssAmount + philhealthAmount + pagibigAmount + deductions.withholding_tax;

      // Adjustment
      const adjustment = parseFloat(adjustmentAmount) || 0;
      totalDeductions += adjustment;

      // Allowance
      const allowance = parseFloat(allowanceAmount) || 0;

      // Net pay
      const netPay = grossPay - totalDeductions + allowance;

      // Create deductions breakdown
      const deductionsBreakdown: any = {
        weekly: {
          vale: deductions.vale_amount,
          uniform_ppe: deductions.uniform_ppe_amount,
          sss_loan: deductions.sss_salary_loan,
          sss_calamity: deductions.sss_calamity_loan,
          pagibig_loan: deductions.pagibig_salary_loan,
          pagibig_calamity: deductions.pagibig_calamity_loan,
        },
        tax: deductions.withholding_tax,
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payslip Generation</h1>
          <p className="text-gray-600 mt-1">
            Generate weekly payslips with automatic calculations
          </p>
        </div>

        {/* Controls */}
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Week
              </label>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => changeWeek('prev')}>
                  ← Prev
                </Button>
                <div className="flex-1 flex items-center justify-center bg-gray-100 rounded-lg px-4 py-2">
                  <span className="font-semibold text-sm">
                    {format(weekStart, 'MMM dd')} - {format(addDays(weekStart, 6), 'MMM dd, yyyy')}
                  </span>
                  <Badge variant={weekNumber === 4 ? 'success' : 'info'} className="ml-2">
                    Week {weekNumber}
                  </Badge>
                </div>
                <Button variant="secondary" size="sm" onClick={() => changeWeek('next')}>
                  Next →
                </Button>
              </div>
            </div>

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
          </div>
        </Card>

        {selectedEmployee && attendance && deductions && (
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
                    {deductions.vale_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Vale:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.vale_amount)}
                        </span>
                      </div>
                    )}
                    {deductions.uniform_ppe_amount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Uniform/PPE:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.uniform_ppe_amount)}
                        </span>
                      </div>
                    )}
                    {deductions.sss_salary_loan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SSS Salary Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.sss_salary_loan)}
                        </span>
                      </div>
                    )}
                    {deductions.sss_calamity_loan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">SSS Calamity Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.sss_calamity_loan)}
                        </span>
                      </div>
                    )}
                    {deductions.pagibig_salary_loan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pag-IBIG Salary Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.pagibig_salary_loan)}
                        </span>
                      </div>
                    )}
                    {deductions.pagibig_calamity_loan > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Pag-IBIG Calamity Loan:</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.pagibig_calamity_loan)}
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
                        {formatCurrency(deductions.sss_contribution)}
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
                        {formatCurrency(deductions.philhealth_contribution)}
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
                        {formatCurrency(deductions.pagibig_contribution)}
                      </span>
                    </label>

                    {deductions.withholding_tax > 0 && (
                      <div className="flex justify-between p-3 border rounded-lg bg-gray-50">
                        <span className="font-medium">Withholding Tax</span>
                        <span className="font-semibold">
                          {formatCurrency(deductions.withholding_tax)}
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
                <Button onClick={generatePayslip} isLoading={generating}>
                  Generate Payslip
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
      </div>
    </DashboardLayout>
  );
}

