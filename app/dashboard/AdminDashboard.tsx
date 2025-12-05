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
        currentWeekStart.setHours(0, 0, 0, 0);
        
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
        currentWeekEnd.setHours(23, 59, 59, 999);
        
        const previousWeekStart = subWeeks(currentWeekStart, 1);
        const previousWeekEnd = new Date(previousWeekStart);
        previousWeekEnd.setDate(previousWeekStart.getDate() + 6);
        previousWeekEnd.setHours(23, 59, 59, 999);
        
        const yearStart = startOfYear(today);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

        // 1. Workforce Stats
        const { count: totalEmployees, error: employeesError } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true });

        if (employeesError) {
          console.error('Error fetching employees:', employeesError);
        }

        const { count: activeEmployees, error: activeEmployeesError } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        if (activeEmployeesError) {
          console.error('Error fetching active employees:', activeEmployeesError);
        }

        const inactiveEmployees = (totalEmployees || 0) - (activeEmployees || 0);

        // 2. Current Week Time Entries Stats
        const { data: currentWeekEntries, error: currentWeekError } = await supabase
          .from('time_clock_entries')
          .select('total_hours, regular_hours, employee_id')
          .gte('clock_in_time', currentWeekStart.toISOString())
          .lte('clock_in_time', currentWeekEnd.toISOString());

        if (currentWeekError) {
          console.error('Error fetching current week entries:', currentWeekError);
        }

        const currentWeekTotalHours = currentWeekEntries?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const currentWeekRegularHours = currentWeekEntries?.reduce((sum, e) => sum + Number(e.regular_hours || 0), 0) || 0;
        const currentWeekEmployeeCount = new Set(currentWeekEntries?.map(e => e.employee_id)).size || 0;

        // 3. Previous Week Time Entries Stats
        const { data: previousWeekEntries } = await supabase
          .from('time_clock_entries')
          .select('total_hours, regular_hours')
          .gte('clock_in_time', previousWeekStart.toISOString())
          .lte('clock_in_time', previousWeekEnd.toISOString());

        const previousWeekTotalHours = previousWeekEntries?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const previousWeekRegularHours = previousWeekEntries?.reduce((sum, e) => sum + Number(e.regular_hours || 0), 0) || 0;

        // 4. Year to Date Stats
        const { data: ytdEntries } = await supabase
          .from('time_clock_entries')
          .select('total_hours, regular_hours')
          .gte('clock_in_time', yearStart.toISOString());

        const ytdTotalHours = ytdEntries?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const ytdRegularHours = ytdEntries?.reduce((sum, e) => sum + Number(e.regular_hours || 0), 0) || 0;

        // 5. Month to Date
        const { data: mtdEntries } = await supabase
          .from('time_clock_entries')
          .select('total_hours, clock_in_time')
          .gte('clock_in_time', monthStart.toISOString());

        const mtdTotalHours = mtdEntries?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const uniqueDays = new Set(mtdEntries?.map(e => format(new Date(e.clock_in_time), 'yyyy-MM-dd')));
        const mtdDays = uniqueDays.size;

        // 6. Pending Approvals (time entries that need approval)
        const { count: pendingApprovals } = await supabase
          .from('time_clock_entries')
          .select('*', { count: 'exact', head: true })
          .in('status', ['clocked_in', 'clocked_out'])
          .is('approved_by', null);

        // Calculate estimated costs (placeholder - would need employee rates)
        // For now, using hours as proxy since we don't have payslips
        const avgHourlyRate = 200; // Placeholder - would come from employees table
        const currentWeekGross = currentWeekTotalHours * avgHourlyRate;
        const previousWeekGross = previousWeekTotalHours * avgHourlyRate;
        const ytdGross = ytdTotalHours * avgHourlyRate;
        const mtdGross = mtdTotalHours * avgHourlyRate;

        setStats({
          currentWeekGross,
          currentWeekNet: currentWeekGross * 0.85, // Estimate 15% deductions
          currentWeekEmployeeCount,
          previousWeekGross,
          previousWeekNet: previousWeekGross * 0.85,
          ytdGross,
          ytdNet: ytdGross * 0.85,
          ytdDeductions: ytdGross * 0.15,
          totalEmployees: totalEmployees || 0,
          activeEmployees: activeEmployees || 0,
          inactiveEmployees,
          mtdGross,
          mtdWeeks: Math.ceil(mtdDays / 7),
          criticalAlerts: 0,
          warningAlerts: 0,
          pendingApprovals: pendingApprovals || 0,
        });

        // 7. Weekly Trends (last 12 weeks) - using time entries
        const twelveWeeksAgo = subWeeks(currentWeekStart, 12);
        const { data: trendData } = await supabase
          .from('time_clock_entries')
          .select('clock_in_time, total_hours, employee_id')
          .gte('clock_in_time', twelveWeeksAgo.toISOString())
          .order('clock_in_time', { ascending: true });

        // Group by week
        const weekGroups: { [key: string]: any[] } = {};
        trendData?.forEach(record => {
          const weekStart = format(new Date(record.clock_in_time), 'yyyy-MM-dd');
          const weekKey = format(new Date(weekStart), 'yyyy-\'W\'ww');
          if (!weekGroups[weekKey]) {
            weekGroups[weekKey] = [];
          }
          weekGroups[weekKey].push(record);
        });

        const trends: WeeklyTrend[] = Object.entries(weekGroups).map(([weekKey, records]) => {
          const weekHours = records.reduce((sum, r) => sum + Number(r.total_hours || 0), 0);
          return {
            weekStart: weekKey,
            grossPay: weekHours * avgHourlyRate,
            netPay: weekHours * avgHourlyRate * 0.85,
            employeeCount: new Set(records.map(r => r.employee_id)).size,
          };
        });

        setWeeklyTrends(trends);

        // 8. Cost Breakdown (current week) - simplified
        if (currentWeekTotalHours > 0) {
          setCostBreakdown({
            regularPay: currentWeekRegularHours * avgHourlyRate,
            nightDiffPay: (currentWeekTotalHours - currentWeekRegularHours) * avgHourlyRate * 0.1,
            holidayPay: 0, // Would need holiday data
            sundayPay: 0, // Would need day type data
          });
        }

      } catch (error: any) {
        console.error('Error fetching executive metrics:', error);
        console.error('Error details:', {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code
        });
        // Set default stats on error so UI doesn't break
        setStats({
          currentWeekGross: 0,
          currentWeekNet: 0,
          currentWeekEmployeeCount: 0,
          previousWeekGross: 0,
          previousWeekNet: 0,
          ytdGross: 0,
          ytdNet: 0,
          ytdDeductions: 0,
          totalEmployees: 0,
          activeEmployees: 0,
          inactiveEmployees: 0,
          mtdGross: 0,
          mtdWeeks: 0,
          criticalAlerts: 0,
          warningAlerts: 0,
          pendingApprovals: 0,
        });
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
                  <Clock className="h-4 w-4 text-emerald-600" />
                  <span className="text-sm text-foreground">Pending Approvals</span>
                </div>
                <span className="text-xl font-bold text-emerald-600">{stats?.pendingApprovals}</span>
              </div>
                <Link href="/payslips">
                <Button variant="secondary" className="w-full mt-4">
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
                <Button variant="secondary" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <span className="text-sm">Review Payslips</span>
                  </div>
                </Button>
              </Link>
              <Link href="/employees">
                <Button variant="secondary" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="h-5 w-5" />
                    <span className="text-sm">Manage Staff</span>
                  </div>
                </Button>
              </Link>
              <Link href="/time-entries">
                <Button variant="secondary" className="w-full h-20">
                  <div className="flex flex-col items-center gap-2">
                    <Clock className="h-5 w-5" />
                    <span className="text-sm">Time Entries</span>
                  </div>
                </Button>
              </Link>
              <Link href="/timesheet">
                <Button variant="secondary" className="w-full h-20">
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

