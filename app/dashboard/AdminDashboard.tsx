"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useProfile } from "@/lib/hooks/useProfile";

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
  pending: "bg-amber-100 text-amber-900 border-amber-200",
  approved: "bg-emerald-100 text-emerald-900 border-emerald-200",
  active: "bg-emerald-100 text-emerald-900 border-emerald-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
  rejected: "bg-red-100 text-red-900 border-red-200",
  cancelled: "bg-slate-100 text-slate-800 border-slate-200",
  draft: "bg-slate-100 text-slate-800 border-slate-200",
  finalized: "bg-emerald-100 text-emerald-900 border-emerald-200",
  posted: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function AdminDashboard() {
  const supabase = createClient();
  const { canCreate, canRead } = usePermissions();
  const { profile } = useProfile();
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFR, setRecentFR] = useState<RecentFundRequest[]>([]);
  const [recentPO, setRecentPO] = useState<RecentPO[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [pendingLeaveApprovals, setPendingLeaveApprovals] = useState(0);
  const [pendingOvertimeApprovals, setPendingOvertimeApprovals] = useState(0);
  const [pendingFailureToLogApprovals, setPendingFailureToLogApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const canReadPurchaseOrders = canRead("purchase_orders");
  const canCreatePurchaseOrders = canCreate("purchase_orders");
  const canReadPayslips = canRead("payslips");
  const canReadEmployees = canRead("employees");
  const showFundRequestActions = Boolean(profile);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    const initialLoad = !lastUpdatedAt;
    if (initialLoad) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    try {
      const [
        { count: totalEmp },
        { count: activeEmp },
        { count: totalProj },
        { count: activeProj },
        { count: pendingFR },
        { count: pendingPO },
        { count: pendingLeave },
        { count: pendingOT },
        { count: pendingFTL },
        projData,
        frData,
        poData,
        contractData,
      ] = await Promise.all([
        supabase.from("employees").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("employment_status", "active"),
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("fund_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("purchase_orders").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("overtime_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("failure_to_log").select("*", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("projects").select("id, code, name, status, contract_value, progress_percentage").order("created_at", { ascending: false }).limit(5),
        supabase.from("fund_requests").select("id, purpose, total_requested_amount, status, request_date, projects:project_id ( name )").order("created_at", { ascending: false }).limit(5),
        supabase.from("purchase_orders").select("id, po_number, total_amount, status, created_at, vendors:vendor_id ( name ), projects:project_id ( name )").order("created_at", { ascending: false }).limit(5),
        supabase.from("projects").select("contract_value"),
      ]);

      const totalProjectValue = (contractData.data || []).reduce((s: number, p: any) => s + (Number(p.contract_value) || 0), 0);

      setStats({
        totalEmployees: totalEmp || 0,
        activeEmployees: activeEmp || 0,
        totalProjects: totalProj || 0,
        activeProjects: activeProj || 0,
        pendingFundRequests: pendingFR || 0,
        pendingPOs: pendingPO || 0,
        totalProjectValue,
      });
      setProjects((projData.data || []) as ProjectSummary[]);
      setRecentFR((frData.data || []) as unknown as RecentFundRequest[]);
      setRecentPO((poData.data || []) as unknown as RecentPO[]);
      setPendingLeaveApprovals(pendingLeave || 0);
      setPendingOvertimeApprovals(pendingOT || 0);
      setPendingFailureToLogApprovals(pendingFTL || 0);
      setLastUpdatedAt(new Date());
    } catch (error: any) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <VStack gap="6" align="stretch" className="w-full pb-16">
      <DashboardPageHeader
        title="Executive dashboard"
        description="Workforce, projects, and pending actions."
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            {showFundRequestActions ? (
              <Link href="/fund-request-approval">
                <Button variant="outline" size="sm">
                  Fund Requests
                </Button>
              </Link>
            ) : null}
            <Link href="/purchase-order">
              <Button size="sm" variant="outline">
                Purchase Orders
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
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
            <CardDescription>Today&apos;s operating focus</CardDescription>
            <CardTitle>
              {(stats?.pendingFundRequests ?? 0) + (stats?.pendingPOs ?? 0) === 0
                ? "No Finance Approvals Pending"
                : `${(stats?.pendingFundRequests ?? 0) + (stats?.pendingPOs ?? 0)} Finance Item(s) Need Action`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Link href="/fund-request-approval">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  Fund requests ({stats?.pendingFundRequests ?? 0})
                </Button>
              </Link>
              <Link href="/purchase-order">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  Purchase orders ({stats?.pendingPOs ?? 0})
                </Button>
              </Link>
              <Link href="/projects">
                <Button size="sm" variant="outline" className="w-full justify-start">
                  Active projects ({stats?.activeProjects ?? 0})
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/10 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Leave Approvals</CardDescription>
            <KpiValue>{pendingLeaveApprovals}</KpiValue>
          </CardHeader>
          <CardContent>
            <Link href="/leave-approval">
              <Button size="sm" variant="outline" className="w-full">Open Leave Queue</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/10 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>OT Approvals</CardDescription>
            <KpiValue>{pendingOvertimeApprovals}</KpiValue>
          </CardHeader>
          <CardContent>
            <Link href="/overtime-approval">
              <Button size="sm" variant="outline" className="w-full">Open OT Queue</Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/10 xl:col-span-2">
          <CardHeader className="pb-2">
            <CardDescription>Failure To Log</CardDescription>
            <KpiValue>{pendingFailureToLogApprovals}</KpiValue>
          </CardHeader>
          <CardContent>
            <Link href="/failure-to-log-approval">
              <Button size="sm" variant="outline" className="w-full">Open FTL Queue</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <SectionHeading>Performance Snapshot</SectionHeading>
          <PageSubtitle>
            Key metrics and pending actions.
          </PageSubtitle>
        </div>
        <HStack gap="2" className="flex-wrap">
          <Link href="/employees">
            <Button variant="outline" size="sm">People</Button>
          </Link>
          <Link href="/leave-approval">
            <Button variant="outline" size="sm">Leave Queue</Button>
          </Link>
          <Link href="/overtime-approval">
            <Button variant="outline" size="sm">OT Queue</Button>
          </Link>
          <Link href="/failure-to-log-approval">
            <Button variant="outline" size="sm">FTL Queue</Button>
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
          meta={`${stats?.pendingFundRequests ?? 0} fund requests · ${stats?.pendingPOs ?? 0} purchase orders`}
          icon={<Icon name="ClipboardText" size={IconSizes.sm} />}
        />
      </div>

      {/* Projects Overview */}
      <CardSection title="Recent projects" description="Latest project activity.">
        {projects.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No projects yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
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
          </div>
        )}
        <div className="flex justify-end mt-2">
          <Link href="/projects"><Button variant="ghost" size="sm">View all projects</Button></Link>
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
            <Link href="/fund-request"><Button variant="ghost" size="sm">View All →</Button></Link>
          </div>
        </CardSection>

        <CardSection title="Recent purchase orders" description="Latest PO status.">
          {recentPO.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">No purchase orders.</p>
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
              <Link href="/purchase-order"><Button variant="ghost" size="sm">View All →</Button></Link>
            </div>
          ) : null}
        </CardSection>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {canReadPayslips ? (
              <Link href="/payroll"><Button variant="outline" size="sm"><Icon name="Receipt" size={IconSizes.sm} className="mr-2" />Run Payroll</Button></Link>
            ) : null}
            {showFundRequestActions ? (
              <Link href="/fund-request/new"><Button variant="outline" size="sm"><Icon name="Plus" size={IconSizes.sm} className="mr-2" />New Fund Request</Button></Link>
            ) : null}
            {canReadPurchaseOrders ? (
              <Link href="/purchase-order">
                <Button variant="outline" size="sm">
                  <Icon name={canCreatePurchaseOrders ? "Plus" : "FileText"} size={IconSizes.sm} className="mr-2" />
                  {canCreatePurchaseOrders ? "New Purchase Order" : "View Purchase Orders"}
                </Button>
              </Link>
            ) : null}
            {canReadEmployees ? (
              <Link href="/employees"><Button variant="outline" size="sm"><Icon name="UsersThree" size={IconSizes.sm} className="mr-2" />Manage Employees</Button></Link>
            ) : null}
            <Link href="/projects"><Button variant="outline" size="sm"><Icon name="ChartLineUp" size={IconSizes.sm} className="mr-2" />View Projects</Button></Link>
          </div>
        </CardContent>
      </Card>
    </VStack>
  );
}
