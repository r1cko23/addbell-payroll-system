'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, UserCheck, Clock, DollarSign, Calendar, FileText, UserPlus, Info, CheckCircle2, AlertTriangle, Copy, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { format, startOfWeek, addDays, addWeeks, subWeeks } from 'date-fns';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingPayslips: number;
  thisWeekGross: number;
}

interface BankTransferRecord {
  accountNumber: string;
  amount: number;
  name: string;
  employeeId: string;
}

export default function HRDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [bankTransferData, setBankTransferData] = useState<BankTransferRecord[]>([]);
  const [loadingBankData, setLoadingBankData] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 3 }));
  const supabase = createClient();

  useEffect(() => {
    async function fetchStats() {
      try {
        const { count: totalEmployees } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        const { count: activeEmployees } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        const { count: pendingPayslips } = await supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'draft');

        const today = new Date();
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay() + 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);

        const { data: weekPayslips } = await supabase
          .from('payslips')
          .select('gross_pay')
          .gte('week_start_date', weekStart.toISOString().split('T')[0])
          .lte('week_end_date', weekEnd.toISOString().split('T')[0]);

        const thisWeekGross = weekPayslips?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;

        setStats({
          totalEmployees: totalEmployees || 0,
          activeEmployees: activeEmployees || 0,
          pendingPayslips: pendingPayslips || 0,
          thisWeekGross,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [supabase]);

  useEffect(() => {
    loadBankTransferData();
  }, [weekStart]);

  async function loadBankTransferData() {
    setLoadingBankData(true);
    try {
      // Get all active employees with bank account numbers
      const { data: employees, error: empError } = await supabase
        .from('employees')
        .select('id, employee_id, full_name, bank_account_number')
        .eq('is_active', true)
        .order('full_name');

      if (empError) throw empError;
      if (!employees) return;

      const bankRecords: BankTransferRecord[] = [];
      const weekStartStr = format(weekStart, 'yyyy-MM-dd');

      for (const emp of employees) {
        // Load attendance for this week
        const { data: attData } = await supabase
          .from('weekly_attendance')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('week_start_date', weekStartStr)
          .maybeSingle();

        if (!attData) continue; // Skip employees without timesheet

        // Load deductions for this week
        const { data: dedData } = await supabase
          .from('employee_deductions')
          .select('*')
          .eq('employee_id', emp.id)
          .eq('week_start_date', weekStartStr)
          .maybeSingle();

        const grossPay = attData.gross_pay || 0;

        // Calculate total deductions
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

        bankRecords.push({
          accountNumber: emp.bank_account_number || 'NOT SET',
          amount: netPay,
          name: emp.full_name,
          employeeId: emp.employee_id,
        });
      }

      setBankTransferData(bankRecords);
    } catch (error) {
      console.error('Error loading bank transfer data:', error);
      toast.error('Failed to load bank transfer data');
    } finally {
      setLoadingBankData(false);
    }
  }

  function copyToClipboard() {
    if (bankTransferData.length === 0) {
      toast.error('No data to copy');
      return;
    }

    // Format as tab-separated values for easy paste into Excel/Sheets
    const header = 'ACCOUNT #\tAMOUNT\tNAME\tREMARKS\n';
    const rows = bankTransferData.map(record => 
      `${record.accountNumber}\t${record.amount.toFixed(2)}\t${record.name}\t`
    ).join('\n');
    const total = bankTransferData.reduce((sum, r) => sum + r.amount, 0);
    const footer = `\t${total.toFixed(2)}\t\t`;
    
    const text = header + rows + '\n' + footer;
    
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard! Ready to paste into Excel/Sheets');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome to Addbell Payroll System. Here's your overview for this week.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Employees
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.totalEmployees}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Employees
              </CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.activeEmployees}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Pending Payslips
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.pendingPayslips}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                This Week Gross
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(stats?.thisWeekGross || 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bank Transfer Summary */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">🏦 Bank Transfer Summary</CardTitle>
                <CardDescription>
                  Week of {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(subWeeks(weekStart, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setWeekStart(addWeeks(weekStart, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={copyToClipboard}
                  disabled={bankTransferData.length === 0}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Clipboard
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loadingBankData ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : bankTransferData.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No timesheet data found for this week.</p>
                <p className="text-sm mt-2">Enter attendance in the Timesheet page first.</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="p-3 text-left font-semibold text-foreground">ACCOUNT #</th>
                        <th className="p-3 text-right font-semibold text-foreground">AMOUNT</th>
                        <th className="p-3 text-left font-semibold text-foreground">NAME</th>
                        <th className="p-3 text-left font-semibold text-foreground">REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bankTransferData.map((record) => (
                        <tr key={record.employeeId} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-mono text-sm text-foreground">
                            {record.accountNumber}
                          </td>
                          <td className="p-3 text-right font-semibold text-foreground">
                            {record.amount.toFixed(2)}
                          </td>
                          <td className="p-3 text-foreground">{record.name}</td>
                          <td className="p-3 text-muted-foreground"></td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-bold">
                        <td className="p-3 text-foreground"></td>
                        <td className="p-3 text-right text-lg text-foreground">
                          {bankTransferData.reduce((sum, r) => sum + r.amount, 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-foreground"></td>
                        <td className="p-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span>
                      <strong className="text-foreground">{bankTransferData.length}</strong> employees
                    </span>
                    <span>
                      Total: <strong className="text-foreground">
                        {formatCurrency(bankTransferData.reduce((sum, r) => sum + r.amount, 0))}
                      </strong>
                    </span>
                  </div>
                  <div className="text-xs">
                    💡 Click "Copy to Clipboard" to paste directly into your bank's Excel sheet
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Link href="/timesheet">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4 px-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-foreground">Enter Timesheet</div>
                      <div className="text-sm text-muted-foreground">Record weekly attendance</div>
                    </div>
                  </div>
                </Button>
              </Link>

              <Link href="/payslips">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4 px-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-blue-500/10 p-2">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-foreground">Generate Payslips</div>
                      <div className="text-sm text-muted-foreground">Create weekly payslips</div>
                    </div>
                  </div>
                </Button>
              </Link>

              <Link href="/employees">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4 px-4"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-green-500/10 p-2">
                      <UserPlus className="h-6 w-6 text-green-600" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-foreground">Manage Employees</div>
                      <div className="text-sm text-muted-foreground">Add or update employee info</div>
                    </div>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <Info className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Weekly Workflow:</span>{' '}
                  <span className="text-muted-foreground">
                    Enter attendance on Monday, generate payslips, get admin approval, then print/export.
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Auto-Detection:</span>{' '}
                  <span className="text-muted-foreground">
                    System automatically detects Sundays and Philippine holidays for correct rate calculation.
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm text-foreground">
                  <span className="font-semibold">Government Contributions:</span>{' '}
                  <span className="text-muted-foreground">
                    Remember to check SSS, PhilHealth, and Pag-IBIG boxes on 3rd/4th week payslips!
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

