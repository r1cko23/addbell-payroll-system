"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageSubtitle, SectionHeading, KpiValue } from "@/components/ui/typography";
import { toTitleCase } from "@/lib/to-title-case";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { dbHeaderActions, dbHeaderButton, dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useSessionQuery } from "@/lib/hooks/useSessionQuery";
import { bustCache } from "@/lib/cache-client";
import {
  buildManagerQueueUrl,
  formatApproverGroupHeading,
} from "@/lib/manager-approval-queue";
import type { CurrentlyClockedInEmployee, HrDashboardPayload } from "@/lib/fetch-hr-dashboard";
import { DashboardApprovalQueueCards } from "@/components/DashboardApprovalQueueCards";
import { cn } from "@/lib/utils";

function CurrentlyClockedInSection({
  employees,
  description,
  className,
  showViewAllLink = true,
}: {
  employees: CurrentlyClockedInEmployee[];
  description: string;
  className?: string;
  showViewAllLink?: boolean;
}) {
  return (
    <CardSection
      title="Currently Clocked In"
      description={description}
      className={className}
    >
      {employees.length === 0 ? (
        <p className="text-muted-foreground text-center py-6">
          No employees currently clocked in.
        </p>
      ) : (
        <>
        <DbMobileBlock>
          <div className="space-y-2">
            {employees.map((emp) => (
              <div key={emp.id} className="rounded-lg border border-border/80 bg-card p-3">
                <Link
                  href={`/employees/${emp.id}`}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  {emp.first_name} {emp.last_name}
                </Link>
                <p className="text-xs font-mono text-muted-foreground">{emp.company_id_no}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Department</span>
                  <span className="text-right font-medium">{emp.department_name || "—"}</span>
                  <span className="text-muted-foreground">Clocked in</span>
                  <span className="text-right font-medium">
                    {format(new Date(emp.clocked_in_at), "h:mm a")}
                  </span>
                  <span className="text-muted-foreground">Time clock ID</span>
                  <span className="text-right font-mono">{emp.employee_code || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        </DbMobileBlock>
        <DbDesktopBlock className={dbTableShell}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Clocked in at</TableHead>
                <TableHead>Time clock ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.map((emp) => (
                <TableRow key={emp.id}>
                  <TableCell>
                    <Link
                      href={`/employees/${emp.id}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {emp.first_name} {emp.last_name}
                    </Link>
                    <p className="text-xs font-mono text-muted-foreground">
                      {emp.company_id_no}
                    </p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {emp.department_name || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(emp.clocked_in_at), "MMM d, h:mm a")}
                  </TableCell>
                  <TableCell className="text-sm font-mono">
                    {emp.employee_code}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DbDesktopBlock>
        </>
      )}
      {showViewAllLink ? (
        <div className="mt-2 flex justify-end">
          <Link href="/employees">
            <Button variant="ghost" className={dbHeaderButton}>
              View all employees
            </Button>
          </Link>
        </div>
      ) : null}
    </CardSection>
  );
}

export default function HRDashboard() {
  const { isHR, isOvertimeGroupQueueApprover, isManagement, loading: roleLoading } =
    useUserRole();
  const showAllCompanyPending =
    isManagement && !isHR && !isOvertimeGroupQueueApprover;
  const usesManagerApprovalQueue =
    isOvertimeGroupQueueApprover || isHR || showAllCompanyPending;

  const {
    data,
    loading,
    validating,
    refresh,
  } = useSessionQuery<HrDashboardPayload>(
    "hr-dashboard",
    "/api/dashboard/hr",
    { enabled: !roleLoading }
  );

  const totalEmployees = data?.totalEmployees ?? 0;
  const activeEmployees = data?.activeEmployees ?? 0;
  const pendingLeaveApprovals = data?.pendingLeaveApprovals ?? 0;
  const pendingOvertimeApprovals = data?.pendingOvertimeApprovals ?? 0;
  const pendingFailureToLogApprovals = data?.pendingFailureToLogApprovals ?? 0;
  const managerPendingLeaveCount = data?.managerPendingLeaveCount ?? 0;
  const managerPendingOvertimeCount = data?.managerPendingOvertimeCount ?? 0;
  const managerPendingFailureToLogCount =
    data?.managerPendingFailureToLogCount ?? 0;
  const companyPendingLeaveCount = data?.companyPendingLeaveCount ?? 0;
  const companyPendingOvertimeCount = data?.companyPendingOvertimeCount ?? 0;
  const companyPendingFtlCount = data?.companyPendingFtlCount ?? 0;
  const deptStats = data?.deptStats ?? [];
  const unassignedActiveEmployees = data?.unassignedActiveEmployees ?? 0;
  const currentlyClockedIn = data?.currentlyClockedIn ?? [];
  const typeBreakdown = data?.typeBreakdown ?? [];
  const queueItems = data?.queueItems ?? [];
  const approverGroupNames = data?.approverGroupNames ?? [];
  const refreshing = validating;

  async function loadData() {
    await bustCache();
    await refresh({ force: true });
  }

  if ((loading && !data) || roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const inactiveEmployees = totalEmployees - activeEmployees;
  const isManagerFocus = !isHR;
  const displayedLeaveCount = isOvertimeGroupQueueApprover
    ? managerPendingLeaveCount
    : isHR
      ? pendingLeaveApprovals
      : showAllCompanyPending
        ? companyPendingLeaveCount
        : managerPendingLeaveCount;
  const displayedOtCount = isOvertimeGroupQueueApprover
    ? managerPendingOvertimeCount
    : isHR
      ? pendingOvertimeApprovals
      : showAllCompanyPending
        ? companyPendingOvertimeCount
        : managerPendingOvertimeCount;
  const displayedFtlCount = isOvertimeGroupQueueApprover
    ? managerPendingFailureToLogCount
    : isHR
      ? pendingFailureToLogApprovals
      : showAllCompanyPending
        ? companyPendingFtlCount
        : managerPendingFailureToLogCount;
  const totalPendingApprovals =
    displayedLeaveCount + displayedOtCount + displayedFtlCount;
  const leaveQueueHref = buildManagerQueueUrl("leave", {
    status: usesManagerApprovalQueue ? "pending" : undefined,
  });
  const otQueueHref = buildManagerQueueUrl("overtime", {
    status: usesManagerApprovalQueue ? "pending" : undefined,
  });
  const ftlQueueHref = buildManagerQueueUrl("ftl", {
    status: usesManagerApprovalQueue ? "pending" : undefined,
  });
  const operationsManagerHeading = formatApproverGroupHeading(approverGroupNames);
  const operationsManagerGroupLabel =
    approverGroupNames.length === 1
      ? approverGroupNames[0]
      : approverGroupNames.length > 1
        ? approverGroupNames.join(", ")
        : "your group";

  return (
    <div className={cn("w-full", dbPageWrapper)}>
      <DashboardPageHeader
        title={
          isOvertimeGroupQueueApprover ? operationsManagerHeading : "Workforce overview"
        }
        description={
          isOvertimeGroupQueueApprover
            ? `Pending approvals of leave, overtime, and failure to log by ${operationsManagerGroupLabel}.`
            : "Track employee registrations and the latest time in/out activity."
        }
        actions={
          <div className={dbHeaderActions}>
            {!isOvertimeGroupQueueApprover ? (
              <Link href="/employees">
                <Button variant="outline" className={dbHeaderButton}>
                  Open employees
                </Button>
              </Link>
            ) : null}
            <Button
              variant="outline"
              className={dbHeaderButton}
              onClick={() => loadData()}
              disabled={refreshing}
            >
              <Icon
                name="ArrowsClockwise"
                size={IconSizes.sm}
                className={refreshing ? "animate-spin" : ""}
              />
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        }
      />

      {isOvertimeGroupQueueApprover ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <Card className="h-full border-primary/20 bg-gradient-to-r from-primary/10 to-background">
            <CardHeader className="pb-2">
              <CardTitle>
                {queueItems.length === 0
                  ? "No Pending Approvals"
                  : `${queueItems.length} Request${queueItems.length === 1 ? "" : "s"} Waiting For You`}
                {totalPendingApprovals > queueItems.length ? (
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    Showing {queueItems.length} of {totalPendingApprovals} pending (all dates) ·
                    Leave {displayedLeaveCount} · OT {displayedOtCount} · FTL {displayedFtlCount}
                  </span>
                ) : totalPendingApprovals > 0 ? (
                  <span className="mt-1 block text-sm font-normal text-muted-foreground">
                    All dates · Leave {displayedLeaveCount} · OT {displayedOtCount} · FTL{" "}
                    {displayedFtlCount}
                  </span>
                ) : null}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DashboardApprovalQueueCards
                items={queueItems}
                queueHrefByType={{
                  leave: leaveQueueHref,
                  overtime: otQueueHref,
                  ftl: ftlQueueHref,
                }}
              />
            </CardContent>
          </Card>
          <CurrentlyClockedInSection
            employees={currentlyClockedIn}
            description={`Team members under you clocked in today.`}
            className="h-full"
            showViewAllLink={false}
          />
        </div>
      ) : (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/10 to-background">
          <CardHeader className="pb-2">
            <CardDescription>
              {toTitleCase(
                showAllCompanyPending
                  ? "All pending approvals — click a request to review."
                  : isHR
                    ? "Pending HR approvals — click a request to review."
                    : "Your approval groups — click a request to review."
              )}
            </CardDescription>
            <CardTitle>
              {queueItems.length === 0
                ? "No Pending Approvals"
                : `${queueItems.length} Request${queueItems.length === 1 ? "" : "s"} Waiting For You`}
              {totalPendingApprovals > queueItems.length ? (
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  Showing {queueItems.length} of {totalPendingApprovals} pending (all dates) ·
                  Leave {displayedLeaveCount} · OT {displayedOtCount} · FTL {displayedFtlCount}
                </span>
              ) : totalPendingApprovals > 0 ? (
                <span className="mt-1 block text-sm font-normal text-muted-foreground">
                  All dates · Leave {displayedLeaveCount} · OT {displayedOtCount} · FTL{" "}
                  {displayedFtlCount}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardApprovalQueueCards
              items={queueItems}
              queueHrefByType={{
                leave: leaveQueueHref,
                overtime: otQueueHref,
                ftl: ftlQueueHref,
              }}
            />
          </CardContent>
        </Card>
      )}

      {!isOvertimeGroupQueueApprover ? (
        <>
      <HStack justify="between" align="start" className="flex-col gap-2">
        <div className="space-y-1">
          <SectionHeading>Workforce Health</SectionHeading>
          <PageSubtitle>
            {toTitleCase("Staffing metrics at a glance.")}
          </PageSubtitle>
        </div>
      </HStack>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <MetricCard
          className="xl:col-span-3"
          label="Employees"
          value={totalEmployees}
          meta={`${activeEmployees} active · ${inactiveEmployees} inactive`}
          icon={<Icon name="UsersThree" size={IconSizes.sm} />}
        />
        <MetricCard
          className="xl:col-span-3"
          label="Departments"
          value={deptStats.length}
          meta={
            unassignedActiveEmployees > 0
              ? `${unassignedActiveEmployees} active employee(s) without department`
              : "All active employees assigned to a department"
          }
          icon={<Icon name="Users" size={IconSizes.sm} />}
        />
        <Card className="rounded-2xl border bg-card/90 shadow-sm xl:col-span-6">
          <CardHeader className="pb-3">
            <CardDescription>
              {toTitleCase("Active employees by employment type.")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {typeBreakdown.map((t) => (
                <div key={t.type} className="rounded-xl border border-border/80 bg-background/80 p-3">
                  <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Employment type
                  </p>
                  <HStack justify="between" align="end" className="mt-2">
                    <p className="text-base font-semibold">{t.type}</p>
                    <KpiValue>{t.count}</KpiValue>
                  </HStack>
                </div>
              ))}
              {typeBreakdown.length === 0 && <p className="text-xs text-muted-foreground">No data</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Breakdown & Currently Clocked In */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <CardSection title="By department" description="Active count per department." className="xl:col-span-4">
          {deptStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No assigned departments yet.</p>
          ) : (
            <div className="space-y-2">
              {deptStats.map((d) => (
                <div key={d.name} className="flex items-center justify-between rounded-lg border border-border/80 bg-background/80 p-2.5">
                  <span className="text-sm font-medium">{d.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 rounded-full bg-muted">
                      <div className="h-2 rounded-sm bg-primary" style={{ width: `${Math.min(100, (d.count / Math.max(activeEmployees, 1)) * 100)}%` }} />
                    </div>
                    <span className="text-sm font-mono w-6 text-right">{d.count}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {unassignedActiveEmployees > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {unassignedActiveEmployees} active employee(s) are currently unassigned to a department.
            </div>
          ) : null}
        </CardSection>

        <CurrentlyClockedInSection
          employees={currentlyClockedIn}
          description="Employees clocked in today."
          className="xl:col-span-8"
        />
      </div>
        </>
      ) : null}
    </div>
  );
}
