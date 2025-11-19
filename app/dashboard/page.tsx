'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, UserCheck, Clock, DollarSign, Calendar, FileText, UserPlus, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  pendingPayslips: number;
  thisWeekGross: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
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
