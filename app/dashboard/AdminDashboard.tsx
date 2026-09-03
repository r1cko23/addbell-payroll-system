"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/ui/metric-card";
import { PageSubtitle, SectionHeading, KpiValue } from "@/components/ui/typography";
import { toTitleCase } from "@/lib/to-title-case";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { dbHeaderActions, dbHeaderButton, dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useProfile } from "@/lib/hooks/useProfile";
import { useSessionQuery } from "@/lib/hooks/useSessionQuery";
import { bustCache } from "@/lib/cache-client";
import { isPurchasingOrAdminRole } from "@/lib/user-roles";
import type { AdminDashboardPayload } from "@/lib/fetch-admin-dashboard";
import {
  approvalApprovedStatusBadgeClass,
  approvalPendingStatusBadgeClass,
  approvalRejectedStatusBadgeClass,
} from "@/lib/approval-status-badge";

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalProjects: number;
  activeProjects: number;
  pendingFundRequests: number;
  pendingPOs: number;
  totalProjectValue: number;
}

interface RecentFundRequest {
  id: string;
  purpose: string;
  total_requested_amount: number;
  status: string;
  request_date: string;
  projects: { name: string } | null;
}

interface RecentPO {
  id: string;
  po_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  vendors: { name: string } | null;
  projects: { name: string } | null;
}

interface ProjectSummary {
  id: string;
  code: string;
  name: string;
  status: string;
  contract_value: number | null;
  progress_percentage: number | null;
}

const statusStyles: Record<string, string> = {
  pending: approvalPendingStatusBadgeClass,
  approved: approvalApprovedStatusBadgeClass,
  active: "bg-emerald-100 text-emerald-900 border-emerald-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: approvalRejectedStatusBadgeClass,
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  draft: "bg-slate-100 text-slate-800 border-slate-200",
  finalized: "bg-emerald-100 text-emerald-900 border-emerald-200",
  posted: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function AdminDashboard() {
  const { canCreate, canRead } = usePermissions();
  const { profile } = useProfile();
  const {
    data,
    loading,
    validating,
    refresh,
  } = useSessionQuery<AdminDashboardPayload>(
    "admin-dashboard",
    "/api/dashboard/admin"
  );

  const stats = data?.stats ?? null;
  const recentFR = (data?.recentFR ?? []) as RecentFundRequest[];
  const recentPO = (data?.recentPO ?? []) as RecentPO[];
  const projects = data?.projects ?? [];
  const pendingLeaveApprovals = data?.pendingLeaveApprovals ?? 0;
  const pendingOvertimeApprovals = data?.pendingOvertimeApprovals ?? 0;
  const pendingFailureToLogApprovals = data?.pendingFailureToLogApprovals ?? 0;
  const refreshing = validating;
  const lastUpdatedAt = data ? new Date() : null;
  const canReadPurchaseOrders = canRead("purchase_orders");
  const canCreatePurchaseOrders =
    canCreate("purchase_orders") && isPurchasingOrAdminRole(profile?.role);
  const canReadPayslips = canRead("payslips");
  const canReadEmployees = canRead("employees");
  const showFundRequestActions = Boolean(profile);

  async function fetchDashboard(force = false) {
    await bustCache();
    await refresh({ force: true });
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("w-full", dbPageWrapper)}>
      <DashboardPageHeader
        title="Executive dashboard"
        description="Workforce, projects, and pending actions."
        actions={
          <div className={dbHeaderActions}>
            {showFundRequestActions ? (
              <Link href="/fund-request?tab=inbox">
                <Button variant="outline" className={dbHeaderButton}>
                  Fund requests
                </Button>
              </Link>
            ) : null}
            <Link href="/purchase-order">
              <Button variant="outline" className={dbHeaderButton}>
                Internal POs
              </Button>
            </Link>
            <Button
              variant="outline"
              className={dbHeaderButton}
              onClick={() => fetchDashboard()}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-12">
        <Card className="border-primary/20 bg-primary/10 xl:col-span-6">
          <CardHeader className="pb-2">
            <CardDescription>{toTitleCase("Today's operating focus.")}</CardDescription>
            <CardTitle>
              {(stats?.pendingFundRequests ?? 0) + (stats?.pendingPOs ?? 0) === 0
                ? "No Finance Approvals Pending"
                : `${(stats?.pendingFundRequests ?? 0) + (stats?.pendingPOs ?? 0)} Finance Item(s) Need Action`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link href="/fund-request?tab=inbox">
                <Button variant="outline" className={cn(dbHeaderButton, "w-full justify-start")}>
                  Fund requests ({stats?.pendingFundRequests ?? 0})
                </Button>
              </Link>
              <Link href="/purchase-order">
                <Button variant="outline" className={cn(dbHeaderButton, "w-full justify-start")}>
                  Internal POs ({stats?.pendingPOs ?? 0})
                </Button>
              </Link>
              <Link href="/projects">
                <Button variant="outline" className={cn(dbHeaderButton, "w-full justify-start")}>
                  Active projects ({stats?.activeProjects ?? 0})
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/10 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>{toTitleCase("Pending leave approvals.")}</CardDescription>
            <KpiValue>{pendingLeaveApprovals}</KpiValue>
          </CardHeader>
          <CardContent>
            <Link href="/leave-approval">
              <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>Open leave queue</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/10 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>{toTitleCase("Pending OT approvals.")}</CardDescription>
            <KpiValue>{pendingOvertimeApprovals}</KpiValue>
          </CardHeader>
          <CardContent>
            <Link href="/overtime-approval">
              <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>Open OT queue</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/10 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>
              {toTitleCase("Pending failure to log requests.")}
            </CardDescription>
            <KpiValue>{pendingFailureToLogApprovals}</KpiValue>
          </CardHeader>
          <CardContent>
            <Link href="/failure-to-log-approval">
              <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>Open FTL queue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <SectionHeading>Performance Snapshot</SectionHeading>
          <PageSubtitle>
            {toTitleCase("Key metrics and pending actions.")}
          </PageSubtitle>
        </div>
        <HStack gap="2" className={cn(dbHeaderActions, "sm:flex-wrap")}>
          <Link href="/employees">
            <Button variant="outline" className={dbHeaderButton}>People</Button>
          </Link>
          <Link href="/leave-approval">
            <Button variant="outline" className={dbHeaderButton}>Leave Queue</Button>
          </Link>
          <Link href="/overtime-approval">
            <Button variant="outline" className={dbHeaderButton}>OT Queue</Button>
          </Link>
          <Link href="/failure-to-log-approval">
            <Button variant="outline" className={dbHeaderButton}>FTL Queue</Button>
          </Link>
        </HStack>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Active employees"
          value={stats?.activeEmployees ?? 0}
          meta={`of ${stats?.totalEmployees ?? 0} total employees`}
          icon={<Icon name="UsersThree" size={IconSizes.sm} />}
        />
        <MetricCard
          label="Active projects"
          value={stats?.activeProjects ?? 0}
          meta={`of ${stats?.totalProjects ?? 0} total projects`}
          icon={<Icon name="ChartLineUp" size={IconSizes.sm} />}
        />
        <MetricCard
          label="Project value"
          value={`₱${(stats?.totalProjectValue ?? 0).toLocaleString()}`}
          meta="Total contract value across all projects"
          icon={<Icon name="CurrencyCircleDollar" size={IconSizes.sm} />}
        />
        <MetricCard
          label="Pending actions"
          value={(stats?.pendingFundRequests ?? 0) + (stats?.pendingPOs ?? 0)}
          meta={`${stats?.pendingFundRequests ?? 0} fund requests · ${stats?.pendingPOs ?? 0} internal POs`}
          icon={<Icon name="ClipboardText" size={IconSizes.sm} />}
        />
      </div>

      {/* Projects Overview */}
      <CardSection title="Recent projects" description="Latest project activity.">
        {projects.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No projects yet.</p>
        ) : (
          <>
            <DbMobileBlock>
              <div className="space-y-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-border/80 bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-muted-foreground">{p.code}</p>
                        <Link
                          href={`/projects/${p.id}`}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          {p.name}
                        </Link>
                      </div>
                      <Badge
                        variant="outline"
                        className={`shrink-0 capitalize text-xs ${statusStyles[p.status] || ""}`}
                      >
                        {p.status}
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <span className="text-muted-foreground">Contract value</span>
                      <span className="text-right font-medium">
                        {p.contract_value
                          ? `₱${Number(p.contract_value).toLocaleString()}`
                          : "—"}
                      </span>
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-right font-medium">
                        {p.progress_percentage != null
                          ? `${Number(p.progress_percentage)}%`
                          : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </DbMobileBlock>
            <DbDesktopBlock className={dbTableShell}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead className="text-right">Contract Value</TableHead>
                    <TableHead className="text-center">Progress</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">{p.code}</TableCell>
                      <TableCell>
                        <Link href={`/projects/${p.id}`} className="text-primary hover:underline font-medium">{p.name}</Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {p.contract_value ? `₱${Number(p.contract_value).toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {p.progress_percentage != null ? (
                          <div className="flex items-center gap-2 justify-center">
                            <div className="h-2 w-16 rounded-full bg-muted">
                              <div className="h-2 rounded-sm bg-primary" style={{ width: `${Math.min(100, Number(p.progress_percentage))}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{Number(p.progress_percentage)}%</span>
                          </div>
                        ) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`capitalize text-xs ${statusStyles[p.status] || ""}`}>{p.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DbDesktopBlock>
          </>
        )}
        <div className="flex justify-end mt-2">
          <Link href="/projects"><Button variant="ghost" className={dbHeaderButton}>View all projects</Button></Link>
        </div>
      </CardSection>

      {/* Fund Requests & PO Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSection title="Recent fund requests" description="Newest fund requests.">
          {recentFR.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No fund requests.</p>
          ) : (
            <div className="space-y-3">
              {recentFR.map((fr) => (
                <div key={fr.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <Link href={`/fund-request/${fr.id}`} className="text-sm font-medium text-primary hover:underline truncate block">{fr.purpose}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {fr.projects?.name || "No project"} · {format(new Date(fr.request_date), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-sm font-medium">₱{Number(fr.total_requested_amount).toLocaleString()}</span>
                    <Badge variant="outline" className={`capitalize text-xs ${statusStyles[fr.status] || ""}`}>{fr.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-2">
            <Link href="/fund-request"><Button variant="ghost" className={dbHeaderButton}>View All →</Button></Link>
          </div>
        </CardSection>

        <CardSection title="Recent internal POs" description="Latest PO status.">
          {recentPO.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No internal POs.</p>
          ) : (
            <div className="space-y-3">
              {recentPO.map((po) => (
                <div key={po.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <Link href={`/purchase-order/${po.id}`} className="text-sm font-medium text-primary hover:underline truncate block">{po.po_number || "Draft PO"}</Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {po.vendors?.name || "No vendor"} · {po.projects?.name || "No project"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                    <span className="text-sm font-medium">₱{Number(po.total_amount).toLocaleString()}</span>
                    <Badge variant="outline" className={`capitalize text-xs ${statusStyles[po.status] || ""}`}>{po.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {canReadPurchaseOrders ? (
            <div className="flex justify-end mt-2">
              <Link href="/purchase-order"><Button variant="ghost" className={dbHeaderButton}>View All →</Button></Link>
            </div>
          ) : null}
        </CardSection>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className={cn(dbHeaderActions, "sm:flex-wrap")}>
            {canReadPayslips ? (
              <Link href="/payroll"><Button variant="outline" className={dbHeaderButton}><Icon name="Receipt" size={IconSizes.sm} className="mr-2" />Run Payroll</Button></Link>
            ) : null}
            {showFundRequestActions ? (
              <Link href="/fund-request/new"><Button variant="outline" className={dbHeaderButton}><Icon name="Plus" size={IconSizes.sm} className="mr-2" />New Fund Request</Button></Link>
            ) : null}
            {canReadPurchaseOrders ? (
              <Link href="/purchase-order">
                <Button variant="outline" className={dbHeaderButton}>
                  <Icon name={canCreatePurchaseOrders ? "Plus" : "FileText"} size={IconSizes.sm} className="mr-2" />
                  {canCreatePurchaseOrders ? "New Internal PO" : "View Internal POs"}
                </Button>
              </Link>
            ) : null}
            {canReadEmployees ? (
              <Link href="/employees"><Button variant="outline" className={dbHeaderButton}><Icon name="UsersThree" size={IconSizes.sm} className="mr-2" />Manage Employees</Button></Link>
            ) : null}
            <Link href="/projects"><Button variant="outline" className={dbHeaderButton}><Icon name="ChartLineUp" size={IconSizes.sm} className="mr-2" />View Projects</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
