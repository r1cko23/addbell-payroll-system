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
import { format, startOfYear } from "date-fns";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";

interface ExecutiveStats {
  // Current Cutoff Period
  currentCutoffGross: number;
  currentCutoffNet: number;
  currentCutoffEmployeeCount: number;
  currentCutoffPeriod: string;

  // Previous Cutoff (for comparison)
  previousCutoffGross: number;
  previousCutoffNet: number;
  previousCutoffPeriod: string;

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
  mtdCutoffs: number;

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

interface CutoffTrend {
  periodStart: string;
  periodEnd: string;
  grossPay: number;
  netPay: number;
  employeeCount: number;
  periodLabel: string;
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
  const [cutoffTrends, setCutoffTrends] = useState<CutoffTrend[]>([]);
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
  const [birStats, setBirStats] = useState({
    ytdTaxWithheld: 0,
    ytdSSS: 0,
    ytdPhilHealth: 0,
    ytdPagIBIG: 0,
    totalEmployeesWithPayslips: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    async function fetchExecutiveMetrics() {
      try {
        const today = new Date();
        
        // Get current bi-monthly cutoff period
        const currentCutoffStart = getBiMonthlyPeriodStart(today);
        const currentCutoffEnd = getBiMonthlyPeriodEnd(currentCutoffStart);
        currentCutoffEnd.setHours(23, 59, 59, 999);
        
        // Get previous bi-monthly cutoff period
        const previousCutoffStart = getPreviousBiMonthlyPeriod(currentCutoffStart);
        const previousCutoffEnd = getBiMonthlyPeriodEnd(previousCutoffStart);
        previousCutoffEnd.setHours(23, 59, 59, 999);

        const yearStart = startOfYear(today);
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        
        // Format period labels
        const currentCutoffLabel = formatBiMonthlyPeriod(currentCutoffStart, currentCutoffEnd);
        const previousCutoffLabel = formatBiMonthlyPeriod(previousCutoffStart, previousCutoffEnd);

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

        // 2. Current Cutoff Period Payslips (more accurate than time entries)
        const { data: currentCutoffPayslips, error: currentCutoffError } =
          await supabase
            .from("payslips")
            .select("gross_pay, net_pay, employee_id, period_start, period_end")
            .gte("period_start", format(currentCutoffStart, "yyyy-MM-dd"))
            .lte("period_end", format(currentCutoffEnd, "yyyy-MM-dd"))
            .eq("status", "paid");

        if (currentCutoffError) {
          console.error(
            "Error fetching current cutoff payslips:",
            currentCutoffError
          );
        }

        const currentCutoffGross =
          (currentCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const currentCutoffNet =
          (currentCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.net_pay || 0),
            0
          ) || 0;
        const currentCutoffEmployeeCount =
          new Set(
            (currentCutoffPayslips || []).map((p) => p.employee_id)
          ).size || 0;

        // 3. Previous Cutoff Period Payslips
        const { data: previousCutoffPayslips } = await supabase
          .from("payslips")
          .select("gross_pay, net_pay")
          .gte("period_start", format(previousCutoffStart, "yyyy-MM-dd"))
          .lte("period_end", format(previousCutoffEnd, "yyyy-MM-dd"))
          .eq("status", "paid");

        const previousCutoffGross =
          (previousCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const previousCutoffNet =
          (previousCutoffPayslips || []).reduce(
            (sum, p) => sum + Number(p.net_pay || 0),
            0
          ) || 0;

        // 4. Year to Date Stats from Payslips
        const { data: ytdPayslips } = await supabase
          .from("payslips")
          .select("gross_pay, net_pay, deductions_breakdown")
          .gte("period_start", format(yearStart, "yyyy-MM-dd"))
          .eq("status", "paid");

        const ytdGross =
          (ytdPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const ytdNet =
          (ytdPayslips || []).reduce(
            (sum, p) => sum + Number(p.net_pay || 0),
            0
          ) || 0;
        const ytdDeductions = ytdGross - ytdNet;

        // 5. Month to Date
        const { data: mtdPayslips } = await supabase
          .from("payslips")
          .select("gross_pay, period_start")
          .gte("period_start", format(monthStart, "yyyy-MM-dd"))
          .eq("status", "paid");

        const mtdGross =
          (mtdPayslips || []).reduce(
            (sum, p) => sum + Number(p.gross_pay || 0),
            0
          ) || 0;
        const uniqueCutoffs = new Set(
          (mtdPayslips || []).map((p) => p.period_start)
        );
        const mtdCutoffs = uniqueCutoffs.size;

        // 6. Pending Approvals (draft payslips)
        const { count: pendingApprovals } = await supabase
          .from("payslips")
          .select("*", { count: "exact", head: true })
          .eq("status", "draft");

        setStats({
          currentCutoffGross,
          currentCutoffNet,
          currentCutoffEmployeeCount,
          currentCutoffPeriod: currentCutoffLabel,
          previousCutoffGross,
          previousCutoffNet,
          previousCutoffPeriod: previousCutoffLabel,
          ytdGross,
          ytdNet,
          ytdDeductions,
          totalEmployees: totalEmployees || 0,
          activeEmployees: activeEmployees || 0,
          inactiveEmployees,
          mtdGross,
          mtdCutoffs,
          criticalAlerts: 0,
          warningAlerts: 0,
          pendingApprovals: pendingApprovals || 0,
        });

        // 7. Cutoff Trends (last 12 cutoffs) - using payslips
        let trendPeriodStart = getPreviousBiMonthlyPeriod(currentCutoffStart);
        const trendPeriods: CutoffTrend[] = [];
        
        for (let i = 0; i < 12; i++) {
          const trendPeriodEnd = getBiMonthlyPeriodEnd(trendPeriodStart);
          
          const { data: trendPayslips } = await supabase
            .from("payslips")
            .select("gross_pay, net_pay, employee_id")
            .gte("period_start", format(trendPeriodStart, "yyyy-MM-dd"))
            .lte("period_end", format(trendPeriodEnd, "yyyy-MM-dd"))
            .eq("status", "paid");

          const trendGross =
            (trendPayslips || []).reduce(
              (sum, p) => sum + Number(p.gross_pay || 0),
              0
            ) || 0;
          const trendNet =
            (trendPayslips || []).reduce(
              (sum, p) => sum + Number(p.net_pay || 0),
              0
            ) || 0;
          const trendEmployeeCount =
            new Set((trendPayslips || []).map((p) => p.employee_id)).size || 0;

          trendPeriods.push({
            periodStart: trendPeriodStart.toISOString(),
            periodEnd: trendPeriodEnd.toISOString(),
            grossPay: trendGross,
            netPay: trendNet,
            employeeCount: trendEmployeeCount,
            periodLabel: formatBiMonthlyPeriod(trendPeriodStart, trendPeriodEnd),
          });

          trendPeriodStart = getPreviousBiMonthlyPeriod(trendPeriodStart);
        }

        setCutoffTrends(trendPeriods.reverse()); // Reverse to show oldest first

        // 8. Cost Breakdown (current cutoff) - from payslips earnings breakdown
        if (currentCutoffPayslips && currentCutoffPayslips.length > 0) {
          let regularPay = 0;
          let nightDiffPay = 0;
          let holidayPay = 0;
          let sundayPay = 0;

          currentCutoffPayslips.forEach((payslip: any) => {
            const earnings = payslip.earnings_breakdown || {};
            regularPay += Number(earnings.regularPay || 0);
            nightDiffPay += Number(earnings.nightDifferential || 0);
            holidayPay += Number(earnings.holidayPay || 0);
            sundayPay += Number(earnings.sundayPay || 0);
          });

          setCostBreakdown({
            regularPay,
            nightDiffPay,
            holidayPay,
            sundayPay,
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

        // 10. BIR Statistics (YTD from paid payslips)
        // Reuse yearStart from line 127
        const { data: birPayslips } = await supabase
          .from("payslips")
          .select("deductions_breakdown, sss_amount, philhealth_amount, pagibig_amount, employee_id")
          .gte("period_start", yearStart.toISOString().split("T")[0])
          .eq("status", "paid");

        let ytdTaxWithheld = 0;
        let ytdSSS = 0;
        let ytdPhilHealth = 0;
        let ytdPagIBIG = 0;
        const employeesWithPayslips = new Set<string>();

        (birPayslips || []).forEach((payslip: any) => {
          const deductions = payslip.deductions_breakdown as any;
          ytdTaxWithheld += Number(deductions?.tax || 0);
          ytdSSS += Number(payslip.sss_amount || 0);
          ytdPhilHealth += Number(payslip.philhealth_amount || 0);
          ytdPagIBIG += Number(payslip.pagibig_amount || 0);
          if (payslip.employee_id) {
            employeesWithPayslips.add(payslip.employee_id);
          }
        });

        setBirStats({
          ytdTaxWithheld,
          ytdSSS,
          ytdPhilHealth,
          ytdPagIBIG,
          totalEmployeesWithPayslips: employeesWithPayslips.size,
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
          currentCutoffGross: 0,
          currentCutoffNet: 0,
          currentCutoffEmployeeCount: 0,
          currentCutoffPeriod: "",
          previousCutoffGross: 0,
          previousCutoffNet: 0,
          previousCutoffPeriod: "",
          ytdGross: 0,
          ytdNet: 0,
          ytdDeductions: 0,
          totalEmployees: 0,
          activeEmployees: 0,
          inactiveEmployees: 0,
          mtdGross: 0,
          mtdCutoffs: 0,
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
        setBirStats({
          ytdTaxWithheld: 0,
          ytdSSS: 0,
          ytdPhilHealth: 0,
          ytdPagIBIG: 0,
          totalEmployeesWithPayslips: 0,
        });
      } finally {
        setLoading(false);
      }
    }

    fetchExecutiveMetrics();
  }, [supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon
          name="ArrowsClockwise"
          size={IconSizes.lg}
          className="animate-spin text-muted-foreground"
        />
      </div>
    );
  }

  // Calculate percentage changes
  const cutoffOverCutoffChange = stats?.previousCutoffGross
    ? ((stats.currentCutoffGross - stats.previousCutoffGross) /
        stats.previousCutoffGross) *
      100
    : 0;

  const avgCostPerEmployee =
    stats && stats.currentCutoffEmployeeCount > 0
      ? stats.currentCutoffGross / stats.currentCutoffEmployeeCount
      : 0;

  const isIncreasing = cutoffOverCutoffChange > 0;

  return (
      <VStack gap="6" className="w-full max-w-[1400px] mx-auto px-4 py-6">
        {/* Header */}
        <VStack gap="2" align="start" className="w-full">
          <H1>Executive Dashboard</H1>
          <BodySmall className="text-muted-foreground">
            Financial overview and key business metrics for{" "}
            {stats?.currentCutoffPeriod || "current cutoff period"}
          </BodySmall>
        </VStack>

        {/* Key Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 items-stretch w-full">
          {/* Payroll This Cutoff */}
          <Card className="h-full min-h-[150px]">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Payroll This Cutoff
              </CardTitle>
              <Icon
                name="CurrencyDollarSimple"
                size={IconSizes.sm}
                className="text-muted-foreground"
              />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground leading-tight">
                {formatCurrency(stats?.currentCutoffGross || 0)}
              </div>
              <HStack gap="2" align="center" className="mt-2">
                <Icon
                  name={isIncreasing ? "ChartLineUp" : "ArrowDown"}
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
                  {Math.abs(cutoffOverCutoffChange).toFixed(1)}%
                </Caption>
                <Caption>vs last cutoff</Caption>
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
              <Caption className="mt-2">This cutoff average</Caption>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 w-full">
          {/* Cost Breakdown */}
          <CardSection
            title="Cost Breakdown"
            description="Current cutoff composition"
            className="w-full"
          >
            <VStack gap="3" className="w-full">
              {costBreakdown ? (
                <>
                  {(() => {
                    const total = costBreakdown.regularPay + costBreakdown.nightDiffPay + costBreakdown.holidayPay + costBreakdown.sundayPay;
                    const regularPct = total > 0 ? ((costBreakdown.regularPay / total) * 100).toFixed(0) : "0";
                    const nightDiffPct = total > 0 ? ((costBreakdown.nightDiffPay / total) * 100).toFixed(0) : "0";
                    const holidayPct = total > 0 ? ((costBreakdown.holidayPay / total) * 100).toFixed(0) : "0";
                    const sundayPct = total > 0 ? ((costBreakdown.sundayPay / total) * 100).toFixed(0) : "0";
                    
                    return (
                      <>
                        <HStack justify="between" align="center">
                          <BodySmall>Regular Hours</BodySmall>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(costBreakdown.regularPay)} ({regularPct}%)
                          </span>
                        </HStack>
                        <HStack justify="between" align="center">
                          <BodySmall>Night Differential</BodySmall>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(costBreakdown.nightDiffPay)} ({nightDiffPct}%)
                          </span>
                        </HStack>
                        <HStack justify="between" align="center">
                          <BodySmall>Holiday Pay</BodySmall>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(costBreakdown.holidayPay)} ({holidayPct}%)
                          </span>
                        </HStack>
                        <HStack justify="between" align="center">
                          <BodySmall>Sunday/Rest Day</BodySmall>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCurrency(costBreakdown.sundayPay)} ({sundayPct}%)
                          </span>
                        </HStack>
                      </>
                    );
                  })()}
                </>
              ) : (
                <BodySmall className="text-muted-foreground">No data available</BodySmall>
              )}
            </VStack>
          </CardSection>

          {/* Alerts & Actions */}
          <CardSection
            title="Alerts & Actions"
            description="Items requiring attention"
            className="w-full"
          >
            <VStack gap="4" className="w-full">
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
          <CardSection title="Cash Flow" description="Net payout amounts" className="w-full">
            <VStack gap="3" className="w-full">
              <HStack justify="between" align="center">
                <BodySmall>This Cutoff Net</BodySmall>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(stats?.currentCutoffNet || 0)}
                </span>
              </HStack>
              <HStack justify="between" align="center">
                <BodySmall>Last Cutoff Net</BodySmall>
                <span className="text-sm font-semibold text-foreground">
                  {formatCurrency(stats?.previousCutoffNet || 0)}
                </span>
              </HStack>
              <HStack
                justify="between"
                align="center"
                className="border-t border-border pt-3 mt-2"
              >
                <span className="text-sm font-semibold text-foreground">
                  Month to Date
                </span>
                <span className="text-lg font-bold text-foreground">
                  {formatCurrency(stats?.mtdGross || 0)}
                </span>
              </HStack>
              <Caption>{stats?.mtdCutoffs} cutoff{stats?.mtdCutoffs !== 1 ? 's' : ''} in current month</Caption>
            </VStack>
          </CardSection>
        </div>

        {/* BIR Tax & Contributions Summary */}
        <CardSection
          title="BIR Tax & Contributions (YTD)"
          description={`Year ${format(new Date(), "yyyy")} summary from paid payslips - Ready for BIR submission`}
          className="w-full"
        >
          <VStack gap="4" className="w-full">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 w-full">
              <VStack gap="1" align="start" className="p-4 bg-muted/50 rounded-lg">
                <Caption className="text-muted-foreground font-medium">Tax Withheld</Caption>
                <BodySmall className="text-xl font-bold text-foreground">
                  {formatCurrency(birStats.ytdTaxWithheld)}
                </BodySmall>
                <Caption className="text-xs text-muted-foreground">
                  {stats?.ytdGross ? `${((birStats.ytdTaxWithheld / stats.ytdGross) * 100).toFixed(2)}% of gross` : ''}
                </Caption>
              </VStack>
              <VStack gap="1" align="start" className="p-4 bg-muted/50 rounded-lg">
                <Caption className="text-muted-foreground font-medium">SSS Contributions</Caption>
                <BodySmall className="text-xl font-bold text-foreground">
                  {formatCurrency(birStats.ytdSSS)}
                </BodySmall>
                <Caption className="text-xs text-muted-foreground">
                  Employee + Employer
                </Caption>
              </VStack>
              <VStack gap="1" align="start" className="p-4 bg-muted/50 rounded-lg">
                <Caption className="text-muted-foreground font-medium">PhilHealth</Caption>
                <BodySmall className="text-xl font-bold text-foreground">
                  {formatCurrency(birStats.ytdPhilHealth)}
                </BodySmall>
                <Caption className="text-xs text-muted-foreground">
                  Employee + Employer
                </Caption>
              </VStack>
              <VStack gap="1" align="start" className="p-4 bg-muted/50 rounded-lg">
                <Caption className="text-muted-foreground font-medium">Pag-IBIG</Caption>
                <BodySmall className="text-xl font-bold text-foreground">
                  {formatCurrency(birStats.ytdPagIBIG)}
                </BodySmall>
                <Caption className="text-xs text-muted-foreground">
                  Employee + Employer
                </Caption>
              </VStack>
            </div>
            <div className="grid gap-4 md:grid-cols-2 w-full pt-3 border-t border-border">
              <VStack gap="1" align="start">
                <Caption className="text-muted-foreground font-medium">Total Contributions</Caption>
                <BodySmall className="text-lg font-semibold text-foreground">
                  {formatCurrency(birStats.ytdSSS + birStats.ytdPhilHealth + birStats.ytdPagIBIG)}
                </BodySmall>
              </VStack>
              <VStack gap="1" align="start">
                <Caption className="text-muted-foreground font-medium">Total Tax & Contributions</Caption>
                <BodySmall className="text-lg font-semibold text-foreground">
                  {formatCurrency(birStats.ytdTaxWithheld + birStats.ytdSSS + birStats.ytdPhilHealth + birStats.ytdPagIBIG)}
                </BodySmall>
              </VStack>
            </div>
            <HStack gap="2" align="center" justify="between" className="flex-col sm:flex-row w-full pt-2">
              <Caption className="text-muted-foreground">
                {birStats.totalEmployeesWithPayslips} employees with paid payslips this year · 
                <Link href="/bir-reports" className="text-primary hover:underline ml-1">
                  Generate BIR Reports →
                </Link>
              </Caption>
              <Link href="/bir-reports">
                <Button variant="default" className="w-full sm:w-auto">
                  <Icon name="FileText" size={IconSizes.sm} />
                  View BIR Reports
                </Button>
              </Link>
            </HStack>
          </VStack>
        </CardSection>

        {/* Payroll Trend Chart */}
        <CardSection
          title="Payroll Cost Trend"
          description="Last 12 cutoff periods gross payroll"
          className="w-full"
        >
          <VStack gap="3" className="w-full">
            {cutoffTrends.length > 0 ? (
              cutoffTrends.map((trend, index) => {
                const maxValue = Math.max(...cutoffTrends.map((t) => t.grossPay));
                const percentage = maxValue > 0 ? (trend.grossPay / maxValue) * 100 : 0;

                return (
                  <VStack key={index} gap="2" align="start" className="w-full">
                    <HStack justify="between" align="center" className="w-full">
                      <Caption className="font-medium">
                        {trend.periodLabel}
                      </Caption>
                      <span className="text-xs font-semibold text-foreground">
                        {formatCurrency(trend.grossPay)}
                      </span>
                    </HStack>
                    <div className="w-full bg-muted rounded-full h-2.5">
                      <div
                        className="bg-primary h-2.5 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <Caption className="text-xs text-muted-foreground">
                      {trend.employeeCount} employees
                    </Caption>
                  </VStack>
                );
              })
            ) : (
              <BodySmall className="text-muted-foreground py-4 text-center w-full">
                No payroll data available for trend analysis
              </BodySmall>
            )}
          </VStack>
        </CardSection>

        {/* Recent Payslips */}
        {payslipStats.recentPayslips.length > 0 && (
          <CardSection title="Recent Payslips" className="w-full">
            <div className="space-y-3 w-full">
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
  );
}
