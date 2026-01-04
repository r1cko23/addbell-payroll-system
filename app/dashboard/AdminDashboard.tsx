"use client";

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

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { formatCurrency } from "@/utils/format";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, subWeeks, startOfYear } from "date-fns";

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
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [payslipStats, setPayslipStats] = useState({
    totalPayslips: 0,
    pendingApprovals: 0,
    paid: 0,
    recentPayslips: [] as any[],
  });
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
          .from("employees")
          .select("*", { count: "exact", head: true });

        if (employeesError) {
          console.error("Error fetching employees:", employeesError);
        }

        const { count: activeEmployees, error: activeEmployeesError } =
          await supabase
            .from("employees")
            .select("*", { count: "exact", head: true })
            .eq("is_active", true);

        if (activeEmployeesError) {
          console.error(
            "Error fetching active employees:",
            activeEmployeesError
          );
        }

        const inactiveEmployees =
          (totalEmployees || 0) - (activeEmployees || 0);

        // 2. Current Week Time Entries Stats
        const { data: currentWeekEntries, error: currentWeekError } =
          await supabase
            .from("time_clock_entries")
            .select("total_hours, regular_hours, employee_id")
            .gte("clock_in_time", currentWeekStart.toISOString())
            .lte("clock_in_time", currentWeekEnd.toISOString());

        if (currentWeekError) {
          console.error(
            "Error fetching current week entries:",
            currentWeekError
          );
        }

        const currentWeekTotalHours =
          (
            currentWeekEntries as Array<{
              total_hours: number | null;
              regular_hours: number | null;
              employee_id: string;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const currentWeekRegularHours =
          (
            currentWeekEntries as Array<{
              total_hours: number | null;
              regular_hours: number | null;
              employee_id: string;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.regular_hours || 0), 0) || 0;
        const currentWeekEmployeeCount =
          new Set(
            (currentWeekEntries as Array<{ employee_id: string }> | null)?.map(
              (e) => e.employee_id
            )
          ).size || 0;

        // 3. Previous Week Time Entries Stats
        const { data: previousWeekEntries } = await supabase
          .from("time_clock_entries")
          .select("total_hours, regular_hours")
          .gte("clock_in_time", previousWeekStart.toISOString())
          .lte("clock_in_time", previousWeekEnd.toISOString());

        const previousWeekTotalHours =
          (
            previousWeekEntries as Array<{
              total_hours: number | null;
              regular_hours: number | null;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const previousWeekRegularHours =
          (
            previousWeekEntries as Array<{
              total_hours: number | null;
              regular_hours: number | null;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.regular_hours || 0), 0) || 0;

        // 4. Year to Date Stats
        const { data: ytdEntries } = await supabase
          .from("time_clock_entries")
          .select("total_hours, regular_hours")
          .gte("clock_in_time", yearStart.toISOString());

        const ytdTotalHours =
          (
            ytdEntries as Array<{
              total_hours: number | null;
              regular_hours: number | null;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const ytdRegularHours =
          (
            ytdEntries as Array<{
              total_hours: number | null;
              regular_hours: number | null;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.regular_hours || 0), 0) || 0;

        // 5. Month to Date
        const { data: mtdEntries } = await supabase
          .from("time_clock_entries")
          .select("total_hours, clock_in_time")
          .gte("clock_in_time", monthStart.toISOString());

        const mtdTotalHours =
          (
            mtdEntries as Array<{
              total_hours: number | null;
              clock_in_time: string;
            }> | null
          )?.reduce((sum, e) => sum + Number(e.total_hours || 0), 0) || 0;
        const uniqueDays = new Set(
          (mtdEntries as Array<{ clock_in_time: string }> | null)?.map((e) =>
            format(new Date(e.clock_in_time), "yyyy-MM-dd")
          )
        );
        const mtdDays = uniqueDays.size;

        // 6. Pending Approvals (time entries that need approval)
        const { count: pendingApprovals } = await supabase
          .from("time_clock_entries")
          .select("*", { count: "exact", head: true })
          .in("status", ["clocked_in", "clocked_out"])
          .is("approved_by", null);

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
          .from("time_clock_entries")
          .select("clock_in_time, total_hours, employee_id")
          .gte("clock_in_time", twelveWeeksAgo.toISOString())
          .order("clock_in_time", { ascending: true });

        // Group by week
        const weekGroups: { [key: string]: any[] } = {};
        (
          trendData as Array<{
            clock_in_time: string;
            total_hours: number | null;
            employee_id: string;
          }> | null
        )?.forEach((record) => {
          const weekStart = format(
            new Date(record.clock_in_time),
            "yyyy-MM-dd"
          );
          const weekKey = format(new Date(weekStart), "yyyy-'W'ww");
          if (!weekGroups[weekKey]) {
            weekGroups[weekKey] = [];
          }
          weekGroups[weekKey].push(record);
        });

        const trends: WeeklyTrend[] = Object.entries(weekGroups).map(
          ([weekKey, records]) => {
            const weekHours = records.reduce(
              (sum, r) => sum + Number(r.total_hours || 0),
              0
            );
            return {
              weekStart: weekKey,
              grossPay: weekHours * avgHourlyRate,
              netPay: weekHours * avgHourlyRate * 0.85,
              employeeCount: new Set(records.map((r) => r.employee_id)).size,
            };
          }
        );

        setWeeklyTrends(trends);

        // 8. Cost Breakdown (current week) - simplified
        if (currentWeekTotalHours > 0) {
          setCostBreakdown({
            regularPay: currentWeekRegularHours * avgHourlyRate,
            nightDiffPay:
              (currentWeekTotalHours - currentWeekRegularHours) *
              avgHourlyRate *
              0.1,
            holidayPay: 0, // Would need holiday data
            sundayPay: 0, // Would need day type data
          });
        }

        // 9. Payslip Statistics
        const { data: payslipData } = await supabase
          .from("payslips")
          .select(
            `
            id,
            status,
            created_at,
            net_pay,
            employee_id,
            employees!payslips_employee_id_fkey(full_name, employee_id)
          `
          )
          .order("created_at", { ascending: false })
          .limit(10);

        const { count: totalPayslips } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true });

        const { count: pendingPayslips } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true })
          .eq("status", "draft");

        const { count: paidPayslips } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true })
          .eq("status", "paid");

        setPayslipStats({
          totalPayslips: totalPayslips || 0,
          pendingApprovals: pendingPayslips || 0,
          paid: paidPayslips || 0,
          recentPayslips: payslipData || [],
        });
      } catch (error: any) {
        console.error("Error fetching executive metrics:", error);
        console.error("Error details:", {
          message: error?.message,
          details: error?.details,
          hint: error?.hint,
          code: error?.code,
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
        setPayslipStats({
          totalPayslips: 0,
          pendingApprovals: 0,
          paid: 0,
          recentPayslips: [],
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
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  // Calculate percentage changes
  const weekOverWeekChange = stats?.previousWeekGross
    ? ((stats.currentWeekGross - stats.previousWeekGross) /
        stats.previousWeekGross) *
      100
    : 0;

  const avgCostPerEmployee =
    stats && stats.currentWeekEmployeeCount > 0
      ? stats.currentWeekGross / stats.currentWeekEmployeeCount
      : 0;

  const isIncreasing = weekOverWeekChange > 0;

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full">
        {/* Header */}
        <VStack gap="2" align="start">
          <H1>Executive Dashboard</H1>
          <BodySmall>
            Financial overview and key business metrics for week{" "}
            {format(new Date(), "w, yyyy")}
          </BodySmall>
        </VStack>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch">
          {/* Payroll This Week */}
          <Card className="h-full min-h-[150px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payroll This Week
              </CardTitle>
              <Icon
                name="CurrencyDollarSimple"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground leading-tight">
                {formatCurrency(stats?.currentWeekGross || 0)}
              </div>
              <HStack gap="2" align="center" className="mt-2">
                <Icon
                  name={isIncreasing ? "ChartLineUp" : "ChartLineUp"}
                  size={IconSizes.xs}
                  className={
                    isIncreasing ? "text-emerald-600" : "text-destructive"
                  }
                />
                <Caption
                  className={
                    isIncreasing ? "text-emerald-600" : "text-destructive"
                  }
                >
                  {Math.abs(weekOverWeekChange).toFixed(1)}%
                </Caption>
                <Caption>vs last week</Caption>
              </HStack>
            </CardContent>
          </Card>

          {/* Active Employees */}
          <Card className="h-full min-h-[150px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Employees
              </CardTitle>
              <Icon
                name="UsersThree"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground leading-tight">
                {stats?.activeEmployees}
              </div>
              <Caption className="mt-2">
                {stats?.inactiveEmployees} inactive
              </Caption>
            </CardContent>
          </Card>

          {/* Avg Cost per Employee */}
          <Card className="h-full min-h-[150px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Avg Cost / Employee
              </CardTitle>
              <Icon
                name="ChartLineUp"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground leading-tight">
                {formatCurrency(avgCostPerEmployee)}
              </div>
              <Caption className="mt-2">This week average</Caption>
            </CardContent>
          </Card>

          {/* YTD Payroll */}
          <Card className="h-full min-h-[150px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                YTD Payroll
              </CardTitle>
              <Icon
                name="CalendarBlank"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground leading-tight">
                {formatCurrency(stats?.ytdGross || 0)}
              </div>
              <Caption className="mt-2">Gross pay since Jan 1</Caption>
            </CardContent>
          </Card>
        </div>

        {/* Financial Summary Row */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Cost Breakdown */}
          <CardSection
            title="Cost Breakdown"
            description="Current week composition"
          >
            <VStack gap="3">
              {costBreakdown && (
                <>
                  <HStack justify="between" align="center">
                    <BodySmall>Regular Hours</BodySmall>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.regularPay)} (62%)
                    </span>
                  </HStack>
                  <HStack justify="between" align="center">
                    <BodySmall>Night Differential</BodySmall>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.nightDiffPay)} (8%)
                    </span>
                  </HStack>
                  <HStack justify="between" align="center">
                    <BodySmall>Holiday Pay</BodySmall>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.holidayPay)} (7%)
                    </span>
                  </HStack>
                  <HStack justify="between" align="center">
                    <BodySmall>Sunday/Rest Day</BodySmall>
                    <span className="text-sm font-semibold text-foreground">
                      {formatCurrency(costBreakdown.sundayPay)} (5%)
                    </span>
                  </HStack>
                </>
              )}
            </VStack>
          </CardSection>

          {/* Alerts & Actions */}
          <CardSection
            title="Alerts & Actions"
            description="Items requiring attention"
          >
            <VStack gap="4">
              <HStack justify="between" align="center">
                <HStack gap="2" align="center">
                  <Icon
                    name="WarningCircle"
                    size={IconSizes.sm}
                    className="text-destructive"
                  />
                  <BodySmall>Critical</BodySmall>
                </HStack>
                <span className="text-xl font-bold text-destructive">
                  {stats?.criticalAlerts}
                </span>
              </HStack>
              <HStack justify="between" align="center">
                <HStack gap="2" align="center">
                  <Icon
                    name="WarningCircle"
                    size={IconSizes.sm}
                    className="text-yellow-600"
                  />
                  <BodySmall>Warning</BodySmall>
                </HStack>
                <span className="text-xl font-bold text-yellow-600">
                  {stats?.warningAlerts}
                </span>
              </HStack>
              <HStack justify="between" align="center">
                <HStack gap="2" align="center">
                  <Icon
                    name="Clock"
                    size={IconSizes.sm}
                    className="text-emerald-600"
                  />
                  <BodySmall>Pending Approvals</BodySmall>
                </HStack>
                <span className="text-xl font-bold text-emerald-600">
                  {stats?.pendingApprovals}
                </span>
              </HStack>
              <Link href="/payslips">
                <Button variant="secondary" className="w-full mt-2">
                  <span>View Pending Payslips</span>
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </Link>
            </VStack>
          </CardSection>

          {/* Cash Flow */}
          <CardSection title="Cash Flow" description="Net payout amounts">
            <VStack gap="3">
              <HStack justify="between" align="center">
                <BodySmall>This Week Net</BodySmall>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(stats?.currentWeekNet || 0)}
                </span>
              </HStack>
              <HStack justify="between" align="center">
                <BodySmall>Last Week Net</BodySmall>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(stats?.previousWeekNet || 0)}
                </span>
              </HStack>
              <HStack
                justify="between"
                align="center"
                className="border-t border-border pt-3"
              >
                <span className="text-sm font-semibold text-foreground">
                  Month to Date
                </span>
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(stats?.mtdGross || 0)}
                </span>
              </HStack>
              <Caption>{stats?.mtdWeeks} weeks in current month</Caption>
            </VStack>
          </CardSection>
        </div>

        {/* Payroll Trend Chart */}
        <CardSection
          title="Payroll Cost Trend"
          description="Last 12 weeks gross payroll"
        >
          <VStack gap="3">
            {weeklyTrends.map((trend, index) => {
              const maxValue = Math.max(...weeklyTrends.map((t) => t.grossPay));
              const percentage = (trend.grossPay / maxValue) * 100;

              return (
                <VStack key={index} gap="2" align="start">
                  <HStack justify="between" align="center" className="w-full">
                    <Caption>
                      Week {format(new Date(trend.weekStart), "MMM d")}
                    </Caption>
                    <span className="text-xs font-medium text-foreground">
                      {formatCurrency(trend.grossPay)}
                    </span>
                  </HStack>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </VStack>
              );
            })}
          </VStack>
        </CardSection>

        {/* Recent Payslips */}
        {payslipStats.recentPayslips.length > 0 && (
          <CardSection title="Recent Payslips">
            <div className="space-y-3">
              {payslipStats.recentPayslips.slice(0, 5).map((payslip: any) => (
                <Link
                  key={payslip.id}
                  href={`/payslips?employee=${payslip.employee_id}`}
                  className="block"
                >
                  <Card className="hover:bg-accent transition-colors">
                    <CardContent className="p-4">
                      <HStack justify="between" align="center">
                        <VStack gap="1" align="start">
                          <BodySmall className="font-semibold">
                            {(payslip.employees as any)?.full_name ||
                              "Unknown Employee"}
                          </BodySmall>
                          <Caption>
                            {format(
                              new Date(payslip.created_at),
                              "MMM d, yyyy"
                            )}{" "}
                            · {(payslip.employees as any)?.employee_id || ""}
                          </Caption>
                        </VStack>
                        <VStack gap="1" align="end">
                          <Badge
                            variant={
                              payslip.status === "paid" ? "default" : "outline"
                            }
                          >
                            {payslip.status.toUpperCase()}
                          </Badge>
                          <BodySmall className="font-semibold">
                            {formatCurrency(payslip.net_pay || 0)}
                          </BodySmall>
                        </VStack>
                      </HStack>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </CardSection>
        )}
      </VStack>
    </DashboardLayout>
  );
}