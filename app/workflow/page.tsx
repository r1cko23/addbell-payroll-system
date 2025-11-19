'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import { formatCurrency } from '@/utils/format';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface WorkflowStatus {
  totalEmployees: number;
  timesheetsCompleted: number;
  deductionsCompleted: number;
  payslipsGenerated: number;
  totalGrossPay: number;
  totalNetPay: number;
  missingBankAccounts: number;
}

export default function WorkflowPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 3 }));
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadWorkflowStatus();
  }, [weekStart]);

  async function loadWorkflowStatus() {
    setLoading(true);
    try {
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      // Get all active employees
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, bank_account_number')
        .eq('is_active', true);

      if (empError) throw empError;

      const totalEmployees = employees?.length || 0;
      const missingBankAccounts = employees?.filter(emp => !emp.bank_account_number).length || 0;

      // Get timesheets for this week
      const { data: timesheets, error: timeError } = await supabase
        .from('weekly_attendance')
        .select('employee_id, gross_pay')
        .eq('week_start_date', weekStartStr);

      if (timeError) throw timeError;

      const timesheetsCompleted = timesheets?.length || 0;
      const totalGrossPay = timesheets?.reduce((sum, t) => sum + (t.gross_pay || 0), 0) || 0;

      // Get deductions for this week
      const { data: deductions, error: dedError } = await supabase
        .from('employee_deductions')
        .select('employee_id')
        .eq('week_start_date', weekStartStr);

      if (dedError) throw dedError;

      const deductionsCompleted = deductions?.length || 0;

      // Get payslips for this week
      const { data: payslips, error: payError } = await supabase
        .from('payslips')
        .select('net_pay')
        .eq('week_start_date', weekStartStr);

      if (payError) throw payError;

      const payslipsGenerated = payslips?.length || 0;
      const totalNetPay = payslips?.reduce((sum, p) => sum + (p.net_pay || 0), 0) || 0;

      setStatus({
        totalEmployees,
        timesheetsCompleted,
        deductionsCompleted,
        payslipsGenerated,
        totalGrossPay,
        totalNetPay,
        missingBankAccounts,
      });
    } catch (error) {
      console.error('Error loading workflow status:', error);
      toast.error('Failed to load workflow status');
    } finally {
      setLoading(false);
    }
  }

  const weekEnd = addDays(weekStart, 6);
  const timesheetProgress = status ? Math.round((status.timesheetsCompleted / status.totalEmployees) * 100) : 0;
  const deductionProgress = status ? Math.round((status.deductionsCompleted / status.totalEmployees) * 100) : 0;
  const payslipProgress = status ? Math.round((status.payslipsGenerated / status.totalEmployees) * 100) : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <LoadingSpinner size="lg" className="mt-20" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">📅 Weekly Payroll Workflow</h1>
            <p className="text-gray-600 mt-1">
              Track your weekly payroll progress from timesheet to bank transfer
            </p>
          </div>
        </div>

        {/* Week Navigation */}
        <Card>
          <div className="flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart(subWeeks(weekStart, 1))}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous Week
            </Button>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </div>
              <div className="text-sm text-gray-500">
                Wednesday to Tuesday
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
            >
              Next Week
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Button>
          </div>
        </Card>

        {/* Alerts */}
        {status && status.missingBankAccounts > 0 && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong className="font-medium">⚠️ WARNING:</strong> {status.missingBankAccounts} employees are missing bank account numbers. 
                  <Link href="/employees" className="ml-2 underline font-medium">Update Now →</Link>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Workflow Steps */}
        <div className="grid gap-6">
          {/* Step 1: Attendance Entry */}
          <Card>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${timesheetProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}>
                    {timesheetProgress === 100 ? '✓' : '1'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">ATTENDANCE ENTRY</h3>
                    <p className="text-sm text-gray-500">Record employee hours for the week</p>
                  </div>
                </div>

                <div className="ml-13">
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{status?.timesheetsCompleted} of {status?.totalEmployees} employees</span>
                      <span className="font-semibold text-gray-900">{timesheetProgress}% Complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${timesheetProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${timesheetProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  {timesheetProgress < 100 && status && (
                    <p className="text-sm text-yellow-600 mt-2">
                      ⏱️ {status.totalEmployees - status.timesheetsCompleted} employees still need timesheets
                    </p>
                  )}

                  <div className="flex gap-3 mt-4">
                    <Link href="/timesheet">
                      <Button size="sm">Enter Timesheets</Button>
                    </Link>
                    {timesheetProgress > 0 && timesheetProgress < 100 && (
                      <span className="text-sm text-gray-500 flex items-center">
                        Continue where you left off
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 2: Deductions Review */}
          <Card>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${deductionProgress === 100 ? 'bg-green-500' : timesheetProgress > 0 ? 'bg-blue-500' : 'bg-gray-400'}`}>
                    {deductionProgress === 100 ? '✓' : '2'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">DEDUCTIONS REVIEW</h3>
                    <p className="text-sm text-gray-500">Configure weekly deductions per employee</p>
                  </div>
                </div>

                <div className="ml-13">
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{status?.deductionsCompleted} of {status?.totalEmployees} employees</span>
                      <span className="font-semibold text-gray-900">{deductionProgress}% Complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${deductionProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${deductionProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  {timesheetProgress < 50 && (
                    <p className="text-sm text-gray-500 mt-2">
                      💡 Complete timesheets first before setting deductions
                    </p>
                  )}

                  <div className="flex gap-3 mt-4">
                    <Link href="/deductions">
                      <Button size="sm" variant={timesheetProgress < 50 ? 'secondary' : 'primary'}>
                        Set Deductions
                      </Button>
                    </Link>
                    {deductionProgress === 0 && (
                      <span className="text-sm text-gray-500 flex items-center">
                        Optional: Skip if no deductions this week
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 3: Payslip Generation */}
          <Card>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${payslipProgress === 100 ? 'bg-green-500' : timesheetProgress === 100 ? 'bg-blue-500' : 'bg-gray-400'}`}>
                    {payslipProgress === 100 ? '✓' : '3'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">PAYSLIP GENERATION</h3>
                    <p className="text-sm text-gray-500">Generate and preview payslips</p>
                  </div>
                </div>

                <div className="ml-13">
                  <div className="mb-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-600">{status?.payslipsGenerated} of {status?.totalEmployees} payslips</span>
                      <span className="font-semibold text-gray-900">{payslipProgress}% Complete</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all ${payslipProgress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                        style={{ width: `${payslipProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  {timesheetProgress < 100 && (
                    <p className="text-sm text-gray-500 mt-2">
                      💡 Complete all timesheets before generating payslips
                    </p>
                  )}

                  {status && status.totalGrossPay > 0 && (
                    <div className="text-sm text-gray-600 mt-2">
                      <strong>Total Gross Pay:</strong> {formatCurrency(status.totalGrossPay)}
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <Link href="/payslips">
                      <Button size="sm" variant={timesheetProgress < 100 ? 'secondary' : 'primary'}>
                        Generate Payslips
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Step 4: Bank Transfer */}
          <Card>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg font-bold ${payslipProgress === 100 ? 'bg-green-500' : 'bg-gray-400'}`}>
                    {payslipProgress === 100 ? '✓' : '4'}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">BANK TRANSFER</h3>
                    <p className="text-sm text-gray-500">Export data for bank payment</p>
                  </div>
                </div>

                <div className="ml-13">
                  {status && status.totalNetPay > 0 ? (
                    <>
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-blue-900">Total Net Pay:</span>
                          <span className="text-2xl font-bold text-blue-900">
                            {formatCurrency(status.totalNetPay)}
                          </span>
                        </div>
                        <div className="text-xs text-blue-700">
                          For {status.payslipsGenerated} employees • Week of {format(weekStart, 'MMM d, yyyy')}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <Link href="/dashboard">
                          <Button size="sm">
                            🏦 View Bank Transfer Summary
                          </Button>
                        </Link>
                        <Link href="/payslips">
                          <Button size="sm" variant="secondary">
                            📊 Export to Excel
                          </Button>
                        </Link>
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">
                      💡 Generate payslips first to see bank transfer data
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Overall Progress Summary */}
        {status && (
          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Weekly Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-3xl font-bold text-gray-900">{status.totalEmployees}</div>
                <div className="text-sm text-gray-600 mt-1">Total Employees</div>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-3xl font-bold text-blue-900">{timesheetProgress}%</div>
                <div className="text-sm text-blue-700 mt-1">Timesheets Done</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-3xl font-bold text-green-900">{status.payslipsGenerated}</div>
                <div className="text-sm text-green-700 mt-1">Payslips Generated</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-900">{formatCurrency(status.totalNetPay)}</div>
                <div className="text-sm text-purple-700 mt-1">Total Net Pay</div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

