"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { MetricCard } from "@/components/ui/metric-card";
import { H1, BodySmall } from "@/components/ui/typography";

interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  totalProjects: number;
  activeProjects: number;
  pendingFundRequests: number;
  pendingPOs: number;
  totalPayrollRuns: number;
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
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentFR, setRecentFR] = useState<RecentFundRequest[]>([]);
  const [recentPO, setRecentPO] = useState<RecentPO[]>([]);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const [
        { count: totalEmp },
        { count: activeEmp },
        { count: totalProj },
        { count: activeProj },
        { count: pendingFR },
        { count: pendingPO },
        { count: totalPayroll },
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
        supabase.from("payroll_runs").select("*", { count: "exact", head: true }),
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
        totalPayrollRuns: totalPayroll || 0,
        totalProjectValue,
      });
      setProjects((projData.data || []) as ProjectSummary[]);
      setRecentFR((frData.data || []) as unknown as RecentFundRequest[]);
      setRecentPO((poData.data || []) as unknown as RecentPO[]);
    } catch (error: any) {
      console.error("Dashboard fetch error:", error);
    } finally {
      setLoading(false);
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
    <VStack gap="8" className="w-full pb-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <Badge variant="outline" className="font-normal">Executive dashboard</Badge>
          <H1>Business overview</H1>
          <BodySmall>
            Track workforce, active projects, pending approvals, and overall project value in one place.
          </BodySmall>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/fund-request-approval">
            <Button variant="outline" size="sm">Fund Requests</Button>
          </Link>
          <Link href="/purchase-order">
            <Button size="sm">Purchase Orders</Button>
          </Link>
        </div>
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
      <CardSection title="Recent projects" description="Latest project activity and delivery progress.">
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
                          <div className="w-16 bg-slate-200 rounded-full h-2">
                            <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${Math.min(100, Number(p.progress_percentage))}%` }} />
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
        <CardSection title="Recent fund requests" description="Newest requests that may need attention.">
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

        <CardSection title="Recent purchase orders" description="Newest purchase orders and approval status.">
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
          <div className="flex justify-end mt-2">
            <Link href="/purchase-order"><Button variant="ghost" size="sm">View All →</Button></Link>
          </div>
        </CardSection>
      </div>

      {/* Quick Links */}
      <Card>
        <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Link href="/payroll"><Button variant="outline" size="sm"><Icon name="Receipt" size={IconSizes.sm} className="mr-2" />Run Payroll</Button></Link>
            <Link href="/fund-request/new"><Button variant="outline" size="sm"><Icon name="Plus" size={IconSizes.sm} className="mr-2" />New Fund Request</Button></Link>
            <Link href="/purchase-order"><Button variant="outline" size="sm"><Icon name="Plus" size={IconSizes.sm} className="mr-2" />New Purchase Order</Button></Link>
            <Link href="/employees"><Button variant="outline" size="sm"><Icon name="UsersThree" size={IconSizes.sm} className="mr-2" />Manage Employees</Button></Link>
            <Link href="/projects"><Button variant="outline" size="sm"><Icon name="ChartLineUp" size={IconSizes.sm} className="mr-2" />View Projects</Button></Link>
          </div>
        </CardContent>
      </Card>
    </VStack>
  );
}
