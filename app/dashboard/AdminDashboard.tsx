'use client';

/**
 * ADMIN/EXECUTIVE DASHBOARD - Example Implementation
 * 
 * This is an example implementation showing what an admin-specific dashboard
 * would look like with executive-level metrics and analytics.
 * 
 * To use this:
 * 1. Check user role on page load
 * 2. If role === 'admin', show this dashboard
 * 3. If role === 'hr', show the regular dashboard (current dashboard/page.tsx)
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Loader2, Users, DollarSign, TrendingUp, TrendingDown, 
  AlertTriangle, CheckCircle2, Clock, Building2, 
  FileText, Activity, Calendar, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { format, subWeeks, startOfYear } from 'date-fns';

interface ExecutiveStats {
  // Current Week
  currentWeekGross: number;
  currentWeekNet: number;
  currentWeekEmployeeCount: number;
  
  // Previous Week (for comparison)
  previousWeekGross: number;
  previousWeekNet: number;
  
  // Year to Date
  ytdGross: number;
  ytdNet: number;
  ytdDeductions: number;
  
  // Workforce
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  
  // Month to Date (current month)
  mtdGross: number;
  mtdWeeks: number;
  
  // Alerts
  criticalAlerts: number;
  warningAlerts: number;
  pendingApprovals: number;
}

interface DepartmentCost {
  department: string;
  employeeCount: number;
  totalCost: number;
  avgCostPerEmployee: number;
  percentage: number;
}

interface WeeklyTrend {
  weekStart: string;
  grossPay: number;
  netPay: number;
  employeeCount: number;
}

interface CostBreakdown {
  regularPay: number;
  overtimePay: number;
  nightDiffPay: number;
  holidayPay: number;
  sundayPay: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<ExecutiveStats | null>(null);
  const [departments, setDepartments] = useState<DepartmentCost[]>([]);
  const [weeklyTrends, setWeeklyTrends] = useState<WeeklyTrend[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchExecutiveMetrics() {
      try {
        const today = new Date();
        const currentWeekStart = new Date(today);
        currentWeekStart.setDate(today.getDate() - ((today.getDay() + 4) % 7));
        const currentWeekStartStr = format(currentWeekStart, 'yyyy-MM-dd');
        
        const previousWeekStart = subWeeks(currentWeekStart, 1);
        const previousWeekStartStr = format(previousWeekStart, 'yyyy-MM-dd');
        
        const yearStart = startOfYear(today);
        const yearStartStr = format(yearStart, 'yyyy-MM-dd');

        // 1. Current Week Stats
        const { data: currentWeekData } = await supabase
          .from('payslips')
          .select('gross_pay, net_pay, total_deductions')
          .eq('week_start_date', currentWeekStartStr);

        const currentWeekGross = currentWeekData?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
        const currentWeekNet = currentWeekData?.reduce((sum, p) => sum + Number(p.net_pay), 0) || 0;
        const currentWeekEmployeeCount = currentWeekData?.length || 0;

        // 2. Previous Week Stats (for comparison)
        const { data: previousWeekData } = await supabase
          .from('payslips')
          .select('gross_pay, net_pay')
          .eq('week_start_date', previousWeekStartStr);

        const previousWeekGross = previousWeekData?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
        const previousWeekNet = previousWeekData?.reduce((sum, p) => sum + Number(p.net_pay), 0) || 0;

        // 3. Year to Date Stats
        const { data: ytdData } = await supabase
          .from('payslips')
          .select('gross_pay, net_pay, total_deductions')
          .gte('week_start_date', yearStartStr);

        const ytdGross = ytdData?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
        const ytdNet = ytdData?.reduce((sum, p) => sum + Number(p.net_pay), 0) || 0;
        const ytdDeductions = ytdData?.reduce((sum, p) => sum + Number(p.total_deductions), 0) || 0;

        // 4. Workforce Stats
        const { count: totalEmployees } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        const { count: activeEmployees } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        const inactiveEmployees = (totalEmployees || 0) - (activeEmployees || 0);

        // 5. Month to Date
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthStartStr = format(monthStart, 'yyyy-MM-dd');
        
        const { data: mtdData } = await supabase
          .from('payslips')
          .select('gross_pay, week_start_date')
          .gte('week_start_date', monthStartStr);

        const mtdGross = mtdData?.reduce((sum, p) => sum + Number(p.gross_pay), 0) || 0;
        const uniqueWeeks = new Set(mtdData?.map(p => p.week_start_date));
        const mtdWeeks = uniqueWeeks.size;

        // 6. Alerts (placeholder - would need proper logic)
        const { count: pendingApprovals } = await supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'draft');

        setStats({
          currentWeekGross,
          currentWeekNet,
          currentWeekEmployeeCount,
          previousWeekGross,
          previousWeekNet,
          ytdGross,
          ytdNet,
          ytdDeductions,
          totalEmployees: totalEmployees || 0,
          activeEmployees: activeEmployees || 0,
          inactiveEmployees,
          mtdGross,
          mtdWeeks,
          criticalAlerts: 0, // Would calculate based on business rules
          warningAlerts: 0,  // Would calculate based on business rules
          pendingApprovals: pendingApprovals || 0,
        });

        // 7. Weekly Trends (last 12 weeks)
        const twelveWeeksAgo = subWeeks(currentWeekStart, 12);
        const { data: trendData } = await supabase
          .from('payslips')
          .select('week_start_date, gross_pay, net_pay, employee_id')
          .gte('week_start_date', format(twelveWeeksAgo, 'yyyy-MM-dd'))
          .order('week_start_date', { ascending: true });

        // Group by week
        const weekGroups: { [key: string]: any[] } = {};
        trendData?.forEach(record => {
          if (!weekGroups[record.week_start_date]) {
            weekGroups[record.week_start_date] = [];
          }
          weekGroups[record.week_start_date].push(record);
        });

        const trends: WeeklyTrend[] = Object.entries(weekGroups).map(([weekStart, records]) => ({
          weekStart,
          grossPay: records.reduce((sum, r) => sum + Number(r.gross_pay), 0),
          netPay: records.reduce((sum, r) => sum + Number(r.net_pay), 0),
          employeeCount: new Set(records.map(r => r.employee_id)).size,
        }));

        setWeeklyTrends(trends);

        // 8. Cost Breakdown (current week)
        // Note: This would require parsing earnings_breakdown JSON
        // Placeholder implementation
        if (currentWeekGross > 0) {
          setCostBreakdown({
            regularPay: currentWeekGross * 0.62,
            overtimePay: currentWeekGross * 0.18,
            nightDiffPay: currentWeekGross * 0.08,
            holidayPay: currentWeekGross * 0.07,
            sundayPay: currentWeekGross * 0.05,
          });
        }

      } catch (error) {
        console.error('Error fetching executive metrics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchExecutiveMetrics();
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

  // Calculate percentage changes
  const weekOverWeekChange = stats?.previousWeekGross 
    ? ((stats.currentWeekGross - stats.previousWeekGross) / stats.previousWeekGross) * 100
    : 0;
  
  const avgCostPerEmployee = stats && stats.currentWeekEmployeeCount > 0
    ? stats.currentWeekGross / stats.currentWeekEmployeeCount
    : 0;

  const isIncreasing = weekOverWeekChange > 0;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Financial overview and key business metrics for week {format(new Date(), 'w, yyyy')}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Payroll This Week */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payroll This Week
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(stats?.currentWeekGross || 0)}
              </div>
              <p className="text-xs text-muted-foreground flex items-center mt-1">
                {isIncreasing ? (
                  <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                )}
                <span className={isIncreasing ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(weekOverWeekChange).toFixed(1)}%
                </span>
                <span className="ml-1">vs last week</span>
              </p>
            </CardContent>
          </Card>

          {/* Active Employees */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Employees
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stats?.activeEmployees}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.inactiveEmployees} inactive
              </p>
            </CardContent>
          </Card>

          {/* Avg Cost per Employee */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Cost / Employee
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(avgCostPerEmployee)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This week average
              </p>
            </CardContent>
          </Card>

          {/* YTD Payroll */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                YTD Payroll
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(stats?.ytdGross || 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Gross pay since Jan 1
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Cost Breakdown */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-foreground">Cost Breakdown</CardTitle>
              <CardDescription>Current week composition</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {costBreakdown && (
                <>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Regular Hours</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.regularPay)} (62%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Overtime</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.overtimePay)} (18%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Night Differential</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.nightDiffPay)} (8%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Holiday Pay</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.holidayPay)} (7%)
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Sunday/Rest Day</span>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.sundayPay)} (5%)
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Alerts & Actions */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-foreground">Alerts & Actions</CardTitle>
              <CardDescription>Items requiring attention</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-sm text-foreground">Critical</span>
                </div>
                <span className="text-xl font-bold text-red-600">{stats?.criticalAlerts}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span className="text-sm text-foreground">Warning</span>
                </div>
                <span className="text-xl font-bold text-yellow-600">{stats?.warningAlerts}</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-foreground">Pending Approvals</span>
                </div>
                <span className="text-xl font-bold text-blue-600">{stats?.pendingApprovals}</span>
              </div>
              <Link href="/payslips">
                <Button variant="outline" className="w-full mt-4">
                  View Pending Payslips <ArrowUpRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Cash Flow */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-foreground">Cash Flow</CardTitle>
              <CardDescription>Net payout amounts</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">This Week Net</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(stats?.currentWeekNet || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Last Week Net</span>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(stats?.previousWeekNet || 0)}
                </span>
              </div>
              <div className="flex justify-between items-center border-t pt-3">
                <span className="text-sm font-semibold text-foreground">Month to Date</span>
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(stats?.mtdGross || 0)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.mtdWeeks} weeks in current month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Payroll Trend Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Payroll Cost Trend</CardTitle>
            <CardDescription>Last 12 weeks gross payroll</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {weeklyTrends.map((trend, index) => {
                const maxValue = Math.max(...weeklyTrends.map(t => t.grossPay));
                const percentage = (trend.grossPay / maxValue) * 100;
                
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Week {format(new Date(trend.weekStart), 'MMM d')}</span>
                      <span>{formatCurrency(trend.grossPay)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-4">
              <Link href="/payslips">
                <Button variant="outline" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm">Review Payslips</span>
                  </div>
                </Button>
              </Link>
              <Link href="/employees">
                <Button variant="outline" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="text-sm">Manage Staff</span>
                  </div>
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    <span className="text-sm">Settings</span>
                  </div>
                </Button>
              </Link>
              <Link href="/timesheet">
                <Button variant="outline" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    <span className="text-sm">Timesheet</span>
                  </div>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

