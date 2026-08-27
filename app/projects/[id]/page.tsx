"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { deleteProject } from "@/lib/delete-project-client";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/lib/hooks/useProfile";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { ArrowLeft, Plus, TrendingUp, DollarSign, Users, Calendar, MapPin, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { dbDialogContent, dbDialogFooter, dbHeaderButton, dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { TypeToDeleteDialog } from "@/components/TypeToDeleteDialog";
import {
  getProjectDeleteDescription,
  getProjectDeleteErrorMessage,
  getProjectStatusColor,
  getProjectStatusLabel,
} from "@/types/project";

interface Project {
  id: string; code: string; name: string; client_id: string | null; site_address: string | null;
  city: string | null; province: string | null; description: string | null;
  start_date: string | null; target_end_date: string | null; actual_end_date: string | null;
  status: string; contract_value: number | null; budget_labor: number | null; budget_materials: number | null;
  budget_subcontract: number | null; budget_other: number | null; project_manager_id: string | null;
  progress_percentage: number; is_active: boolean;
  clients: { name: string } | null;
}
interface ProjectAssignment { id: string; employee_id: string; role: string | null; start_date: string; end_date: string | null; is_active: boolean; employees: { company_id_no: string; first_name: string; last_name: string } | null; }
interface ProjectProgressEntry { id: string; progress_date: string; progress_percentage: number; notes: string | null; milestone: string | null; created_at: string; }
interface FundRequestBrief { id: string; purpose: string; total_requested_amount: number; status: string; request_date: string; }
interface POBrief { id: string; po_number: string; total_amount: number; status: string; po_date: string; vendors: { name: string } | null; }

const EXCLUDED_COST_STATUSES = new Set(["rejected"]);
const APPROVED_COST_STATUSES = new Set(["management_approved"]);
const IN_REVIEW_COST_STATUSES = new Set([
  "pending",
  "project_manager_approved",
  "purchasing_officer_approved",
]);

function formatLabel(s: string): string { return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

function getFundRequestBadgeVariant(status: string): "default" | "secondary" | "destructive" {
  if (status === "management_approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const router = useRouter();
  const { isHR, loading: roleLoading } = useUserRole();

  const [project, setProject] = useState<Project | null>(null);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [progressHistory, setProgressHistory] = useState<ProjectProgressEntry[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequestBrief[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<POBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assignRole, setAssignRole] = useState("");
  const [assignStartDate, setAssignStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [assignEndDate, setAssignEndDate] = useState("");
  const [employeesList, setEmployeesList] = useState<{ id: string; company_id_no: string; first_name: string; last_name: string }[]>([]);
  const canCreatePurchaseOrders = canCreate("purchase_orders");
  const showFundRequests = Boolean(profile);

  const [progressPercentage, setProgressPercentage] = useState("");
  const [progressDate, setProgressDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [progressMilestone, setProgressMilestone] = useState("");
  const [progressNotes, setProgressNotes] = useState("");

  useEffect(() => { if (projectId) fetchProjectData(); }, [projectId]);

  useEffect(() => {
    if (!roleLoading && isHR) {
      toast.error("Projects are not available for HR.");
      router.replace("/dashboard?type=workforce");
    }
  }, [roleLoading, isHR, router]);

  const totalCost = useMemo(
    () => fundRequests
      .filter((request) => !EXCLUDED_COST_STATUSES.has(request.status))
      .reduce((sum, request) => sum + Number(request.total_requested_amount || 0), 0),
    [fundRequests]
  );

  const approvedCost = useMemo(
    () => fundRequests
      .filter((request) => APPROVED_COST_STATUSES.has(request.status))
      .reduce((sum, request) => sum + Number(request.total_requested_amount || 0), 0),
    [fundRequests]
  );

  const inReviewCost = useMemo(
    () => fundRequests
      .filter((request) => IN_REVIEW_COST_STATUSES.has(request.status))
      .reduce((sum, request) => sum + Number(request.total_requested_amount || 0), 0),
    [fundRequests]
  );

  const rejectedCost = useMemo(
    () => fundRequests
      .filter((request) => request.status === "rejected")
      .reduce((sum, request) => sum + Number(request.total_requested_amount || 0), 0),
    [fundRequests]
  );

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projRes, assignRes, progRes, frRes, poRes] = await Promise.all([
        supabase.from("projects").select("*, clients:client_id ( name )").eq("id", projectId).single(),
        supabase.from("project_assignments").select("*, employees:employee_id ( company_id_no, first_name, last_name )").eq("project_id", projectId).order("start_date", { ascending: false }),
        supabase.from("project_progress").select("*").eq("project_id", projectId).order("progress_date", { ascending: false }),
        supabase.from("fund_requests").select("id, purpose, total_requested_amount, status, request_date").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("purchase_orders").select("id, po_number, total_amount, status, po_date, vendors ( name )").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);

      if (projRes.error) throw projRes.error;
      setProject(projRes.data as Project);
      setAssignments(assignRes.data ?? []);
      setProgressHistory(progRes.data ?? []);
      setFundRequests((frRes.data as unknown as FundRequestBrief[]) ?? []);
      setPurchaseOrders((poRes.data as unknown as POBrief[]) ?? []);
    } catch (error) { toast.error("Failed to load project data"); console.error(error); } finally { setLoading(false); }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(progressPercentage);
    if (isNaN(val) || val < 0 || val > 100) { toast.error("Progress must be 0-100."); return; }
    const { error } = await supabase.from("project_progress").insert({
      project_id: projectId, progress_date: progressDate, progress_percentage: val,
      milestone: progressMilestone.trim() || null, notes: progressNotes.trim() || null,
      created_by: profile?.id || null,
    } as never);
    if (error) { toast.error(error.message); return; }
    await supabase.from("projects").update({ progress_percentage: val } as never).eq("id", projectId);
    toast.success("Progress updated.");
    setIsProgressDialogOpen(false);
    setProgressPercentage(""); setProgressDate(format(new Date(), "yyyy-MM-dd")); setProgressMilestone(""); setProgressNotes("");
    fetchProjectData();
  };

  const openAssignDialog = async () => {
    setAssignEmployeeId("");
    setAssignRole("");
    setAssignStartDate(format(new Date(), "yyyy-MM-dd"));
    setAssignEndDate("");
    const { data } = await supabase.from("employees").select("id, company_id_no, first_name, last_name").order("last_name");
    setEmployeesList(data ?? []);
    setIsAssignDialogOpen(true);
  };

  const handleAssignEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmployeeId.trim() || !assignStartDate.trim()) {
      toast.error("Select an employee and start date.");
      return;
    }
    const assignedIds = new Set(assignments.map((a) => a.employee_id));
    if (assignedIds.has(assignEmployeeId)) {
      toast.error("This employee is already assigned to the project.");
      return;
    }
    try {
      const { error } = await supabase.from("project_assignments").insert({
        project_id: projectId,
        employee_id: assignEmployeeId,
        role: assignRole.trim() || null,
        start_date: assignStartDate,
        end_date: assignEndDate.trim() || null,
        is_active: true,
      } as never);
      if (error) throw error;
      toast.success("Employee assigned to project.");
      setIsAssignDialogOpen(false);
      fetchProjectData();
    } catch (err: any) {
      toast.error(err.message || "Failed to assign employee");
    }
  };

  const handleDelete = async () => {
    if (!project) return;

    setDeletingProject(true);
    try {
      await deleteProject(project.id);
      toast.success("Project deleted successfully");
      setDeleteDialogOpen(false);
      router.push("/projects");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : getProjectDeleteErrorMessage(err)
      );
      console.error(err);
    } finally {
      setDeletingProject(false);
    }
  };

  const canCreateProjects = canCreate("projects");
  const canUpdateProjects = canUpdate("projects");
  const canDeleteProjects = canDelete("projects");
  const canManageProjects =
    canCreateProjects || canUpdateProjects || canDeleteProjects;
  const budget = project ? (project.budget_labor ?? 0) + (project.budget_materials ?? 0) + (project.budget_subcontract ?? 0) + (project.budget_other ?? 0) : 0;
  const profit = (project?.contract_value ?? 0) - totalCost;
  const profitMargin = project?.contract_value ? (profit / project.contract_value) * 100 : 0;

  if (loading || profileLoading) return <DashboardLayout><div className="animate-pulse h-8 w-48 bg-slate-200 rounded" /></DashboardLayout>;
  if (!project) return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <Link href="/projects"><Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Project not found</CardContent></Card>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className={cn("min-w-0 w-full", dbPageWrapper)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/projects"><Button variant="ghost" className={dbHeaderButton}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground text-sm">{project.code} {project.clients?.name ? `· ${project.clients.name}` : ""}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={getProjectStatusColor(project.status)} className="text-sm">
              {getProjectStatusLabel(project.status)}
            </Badge>
            {canDeleteProjects ? (
              <Button variant="outline" className={dbHeaderButton} onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4 text-destructive" />
                Delete
              </Button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{(project.progress_percentage ?? 0).toFixed(1)}%</div><Progress value={project.progress_percentage ?? 0} /></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><DollarSign className="h-4 w-4" />Total Cost</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">₱{totalCost.toLocaleString()}</div>{budget > 0 && <p className="text-xs text-muted-foreground mt-1">Budget: ₱{budget.toLocaleString()}</p>}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><TrendingUp className="h-4 w-4" />Profit/Loss</CardTitle></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>₱{profit.toLocaleString()}</div>{project.contract_value && <p className="text-xs text-muted-foreground mt-1">Margin: {profitMargin.toFixed(1)}%</p>}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" />Team</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-bold">{assignments.filter((a) => a.is_active).length}</div><p className="text-xs text-muted-foreground mt-1">Total: {assignments.length}</p></CardContent></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><Label className="text-muted-foreground"><MapPin className="inline h-4 w-4 mr-1" />Location</Label><p className="mt-1">{[project.site_address, project.city, project.province].filter(Boolean).join(", ") || "—"}</p></div>
              <div><Label className="text-muted-foreground"><Calendar className="inline h-4 w-4 mr-1" />Timeline</Label><p className="mt-1">{project.start_date ? format(new Date(project.start_date), "MMM d, yyyy") : "—"} → {project.target_end_date ? format(new Date(project.target_end_date), "MMM d, yyyy") : "—"}</p></div>
              <div><Label className="text-muted-foreground">Contract Value</Label><p className="mt-1 font-medium">{project.contract_value ? `₱${Number(project.contract_value).toLocaleString()}` : "—"}</p></div>
              {project.description && <div className="md:col-span-2"><Label className="text-muted-foreground">Description</Label><p className="mt-1">{project.description}</p></div>}
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="costs" className="space-y-4">
          <TabsList className="w-full max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="costs">Costs</TabsTrigger>
            {showFundRequests ? <TabsTrigger value="fund-requests">Fund Requests</TabsTrigger> : null}
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Project Costs</h3>
                <p className="text-sm text-muted-foreground">
                  Costs are now derived from linked fund requests. Rejected requests are excluded from the total project cost.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Total Cost", val: totalCost },
                { label: "Approved", val: approvedCost },
                { label: "In Review", val: inReviewCost },
                { label: "Rejected", val: rejectedCost },
              ].map((c) => (
                <Card key={c.label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">₱{c.val.toLocaleString()}</div></CardContent></Card>
              ))}
            </div>
            <Card><CardContent className="p-0">
              {fundRequests.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No fund requests linked to this project</p>
              ) : (
                <>
                  <DbMobileBlock className="p-4">
                    <div className="space-y-2">
                      {fundRequests.map((request) => (
                        <div key={request.id} className="rounded-lg border border-border/80 bg-card p-3">
                          <p className="text-sm font-medium">{request.purpose}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.request_date), "MMM d, yyyy")}
                          </p>
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <Badge variant={getFundRequestBadgeVariant(request.status)} className="text-xs capitalize">
                              {formatLabel(request.status)}
                            </Badge>
                            <span className="font-semibold tabular-nums">
                              ₱{Number(request.total_requested_amount).toLocaleString()}
                            </span>
                          </div>
                          <Link href={`/fund-request/${request.id}`} className="mt-2 block">
                            <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>View</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </DbMobileBlock>
                  <DbDesktopBlock>
              <div className="w-full max-w-full overflow-x-auto">
              <Table className="w-full min-w-[720px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Purpose</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {fundRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>{format(new Date(request.request_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{request.purpose}</TableCell>
                      <TableCell><Badge variant={getFundRequestBadgeVariant(request.status)} className="text-xs capitalize">{formatLabel(request.status)}</Badge></TableCell>
                      <TableCell className="text-right font-medium">₱{Number(request.total_requested_amount).toLocaleString()}</TableCell>
                      <TableCell><Link href={`/fund-request/${request.id}`} className="text-primary text-sm hover:underline">View</Link></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
              </div>
                  </DbDesktopBlock>
                </>
              )}
            </CardContent></Card>
          </TabsContent>

          {showFundRequests ? (
            <TabsContent value="fund-requests" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Fund Requests</h3>
                <Button asChild><Link href="/fund-request/new"><Plus className="h-4 w-4 mr-2" />New Request</Link></Button>
              </div>
              <Card><CardContent className="p-0">
                {fundRequests.length === 0 ? (
                  <p className="py-6 text-center text-muted-foreground">No fund requests for this project</p>
                ) : (
                  <>
                    <DbMobileBlock className="p-4">
                      <div className="space-y-2">
                        {fundRequests.map((fr) => (
                          <div key={fr.id} className="rounded-lg border border-border/80 bg-card p-3">
                            <p className="text-sm font-medium">{fr.purpose}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(fr.request_date), "MMM d, yyyy")}
                            </p>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <Badge variant={getFundRequestBadgeVariant(fr.status)} className="text-xs capitalize">
                                {formatLabel(fr.status)}
                              </Badge>
                              <span className="font-semibold tabular-nums">
                                ₱{Number(fr.total_requested_amount).toLocaleString()}
                              </span>
                            </div>
                            <Link href={`/fund-request/${fr.id}`} className="mt-2 block">
                              <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>View</Button>
                            </Link>
                          </div>
                        ))}
                      </div>
                    </DbMobileBlock>
                    <DbDesktopBlock>
                <div className="w-full max-w-full overflow-x-auto">
                <Table className="w-full min-w-[720px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                  <TableBody>
                    {fundRequests.map((fr) => (
                      <TableRow key={fr.id}>
                        <TableCell>{format(new Date(fr.request_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>{fr.purpose}</TableCell>
                        <TableCell className="text-right font-medium">₱{Number(fr.total_requested_amount).toLocaleString()}</TableCell>
                        <TableCell><Badge variant={getFundRequestBadgeVariant(fr.status)} className="text-xs capitalize">{formatLabel(fr.status)}</Badge></TableCell>
                        <TableCell><Link href={`/fund-request/${fr.id}`} className="text-primary text-sm hover:underline">View</Link></TableCell>
                      </TableRow>
                    ))}</TableBody></Table>
                </div>
                    </DbDesktopBlock>
                  </>
                )}
              </CardContent></Card>
            </TabsContent>
          ) : null}

          <TabsContent value="purchase-orders" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Purchase Orders</h3>
              {canCreatePurchaseOrders ? (
                <Button asChild><Link href="/purchase-order"><Plus className="h-4 w-4 mr-2" />New PO</Link></Button>
              ) : null}
            </div>
            <Card><CardContent className="p-0">
              {purchaseOrders.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No purchase orders for this project</p>
              ) : (
                <>
                  <DbMobileBlock className="p-4">
                    <div className="space-y-2">
                      {purchaseOrders.map((po) => (
                        <div key={po.id} className="rounded-lg border border-border/80 bg-card p-3">
                          <p className="font-mono text-xs text-muted-foreground">{po.po_number}</p>
                          <p className="text-sm font-medium">{po.vendors?.name ?? "—"}</p>
                          <div className="mt-2 space-y-1">
                            <DashboardMobileField
                              label="Date"
                              value={format(new Date(po.po_date), "MMM d, yyyy")}
                            />
                            <DashboardMobileField
                              label="Amount"
                              value={`₱${Number(po.total_amount).toLocaleString()}`}
                            />
                          </div>
                          <Badge
                            variant={po.status === "posted" || po.status === "approved" ? "default" : po.status === "cancelled" ? "destructive" : "secondary"}
                            className="mt-2 text-xs capitalize"
                          >
                            {po.status}
                          </Badge>
                          <Link href={`/purchase-order/${po.id}`} className="mt-2 block">
                            <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>View</Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  </DbMobileBlock>
                  <DbDesktopBlock>
              <div className="w-full max-w-full overflow-x-auto">
              <Table className="w-full min-w-[760px]"><TableHeader><TableRow><TableHead>PO Number</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono">{po.po_number}</TableCell>
                      <TableCell>{format(new Date(po.po_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{po.vendors?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">₱{Number(po.total_amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={po.status === "posted" || po.status === "approved" ? "default" : po.status === "cancelled" ? "destructive" : "secondary"} className="text-xs capitalize">{po.status}</Badge></TableCell>
                      <TableCell><Link href={`/purchase-order/${po.id}`} className="text-primary text-sm hover:underline">View</Link></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
              </div>
                  </DbDesktopBlock>
                </>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Assigned Employees</h3>
              {canManageProjects && (
                <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={openAssignDialog}><Plus className="h-4 w-4 mr-2" />Assign Employee</Button>
                  </DialogTrigger>
                  <DialogContent className={dbDialogContent}>
                    <DialogHeader><DialogTitle>Assign Employee to Project</DialogTitle><DialogDescription>Add an employee to this project&apos;s team.</DialogDescription></DialogHeader>
                    <form onSubmit={handleAssignEmployee} className="space-y-4">
                      <div>
                        <Label>Employee *</Label>
                        <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId} required>
                          <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                          <SelectContent>
                            {employeesList.filter((emp) => !assignments.some((a) => a.employee_id === emp.id)).map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>{emp.last_name}, {emp.first_name} ({emp.company_id_no})</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {employeesList.filter((emp) => !assignments.some((a) => a.employee_id === emp.id)).length === 0 && employeesList.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">All employees are already assigned to this project.</p>
                        )}
                      </div>
                      <div><Label>Role</Label><Input value={assignRole} onChange={(e) => setAssignRole(e.target.value)} placeholder="e.g. Foreman, Electrician" /></div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div><Label>Start Date *</Label><Input type="date" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} required /></div>
                        <div><Label>End Date</Label><Input type="date" value={assignEndDate} onChange={(e) => setAssignEndDate(e.target.value)} /></div>
                      </div>
                      <DialogFooter className={dbDialogFooter}><Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>Cancel</Button><Button type="submit">Assign</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <Card><CardContent className="p-0">
              {assignments.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No employees assigned</p>
              ) : (
                <>
                  <DbMobileBlock className="p-4">
                    <div className="space-y-2">
                      {assignments.map((a) => (
                        <div key={a.id} className="rounded-lg border border-border/80 bg-card p-3">
                          <p className="text-sm font-medium">
                            {a.employees ? `${a.employees.first_name} ${a.employees.last_name}` : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{a.employees?.company_id_no ?? "—"}</p>
                          <div className="mt-2 space-y-1">
                            <DashboardMobileField label="Role" value={a.role || "—"} />
                            <DashboardMobileField
                              label="Start"
                              value={format(new Date(a.start_date), "MMM d, yyyy")}
                            />
                            <DashboardMobileField
                              label="End"
                              value={a.end_date ? format(new Date(a.end_date), "MMM d, yyyy") : "Ongoing"}
                            />
                          </div>
                          <Badge variant={a.is_active ? "default" : "secondary"} className="mt-2">
                            {a.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </DbMobileBlock>
                  <DbDesktopBlock>
              <div className="w-full max-w-full overflow-x-auto">
              <Table className="w-full min-w-[720px]"><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.employees ? `${a.employees.first_name} ${a.employees.last_name}` : "—"} ({a.employees?.company_id_no ?? "—"})</TableCell>
                      <TableCell>{a.role || "—"}</TableCell>
                      <TableCell>{format(new Date(a.start_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{a.end_date ? format(new Date(a.end_date), "MMM d, yyyy") : "Ongoing"}</TableCell>
                      <TableCell><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
              </div>
                  </DbDesktopBlock>
                </>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Progress History</h3>
              {canManageProjects && (
                <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
                  <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Update Progress</Button></DialogTrigger>
                  <DialogContent className={dbDialogContent}>
                    <DialogHeader><DialogTitle>Update Project Progress</DialogTitle></DialogHeader>
                    <form onSubmit={handleUpdateProgress} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div><Label>Date *</Label><Input type="date" value={progressDate} onChange={(e) => setProgressDate(e.target.value)} required /></div>
                        <div><Label>Progress (%) *</Label><Input type="number" min="0" max="100" step="0.01" value={progressPercentage} onChange={(e) => setProgressPercentage(e.target.value)} required /></div>
                      </div>
                      <div><Label>Milestone</Label><Input value={progressMilestone} onChange={(e) => setProgressMilestone(e.target.value)} /></div>
                      <div><Label>Notes</Label><Textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} rows={3} /></div>
                      <DialogFooter className={dbDialogFooter}><Button type="button" variant="outline" onClick={() => setIsProgressDialogOpen(false)}>Cancel</Button><Button type="submit">Update</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <Card><CardContent className="p-0">
              {progressHistory.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">No progress updates</p>
              ) : (
                <>
                  <DbMobileBlock className="p-4">
                    <div className="space-y-2">
                      {progressHistory.map((p) => (
                        <div key={p.id} className="rounded-lg border border-border/80 bg-card p-3">
                          <p className="text-sm font-medium">
                            {format(new Date(p.progress_date), "MMM d, yyyy")}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <Progress value={p.progress_percentage} className="flex-1" />
                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                              {p.progress_percentage.toFixed(1)}%
                            </span>
                          </div>
                          {p.milestone ? (
                            <DashboardMobileField label="Milestone" value={p.milestone} />
                          ) : null}
                          {p.notes ? (
                            <p className="mt-2 text-xs text-muted-foreground line-clamp-3">{p.notes}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </DbMobileBlock>
                  <DbDesktopBlock>
              <div className="w-full max-w-full overflow-x-auto">
              <Table className="w-full min-w-[680px]"><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Progress</TableHead><TableHead>Milestone</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>
                  {progressHistory.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.progress_date), "MMM d, yyyy")}</TableCell>
                      <TableCell><div className="flex items-center gap-2"><Progress value={p.progress_percentage} className="w-24" /><span className="font-medium">{p.progress_percentage.toFixed(1)}%</span></div></TableCell>
                      <TableCell>{p.milestone || "—"}</TableCell>
                      <TableCell>{p.notes || "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
              </div>
                  </DbDesktopBlock>
                </>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>

        <TypeToDeleteDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!deletingProject) setDeleteDialogOpen(open);
          }}
          title="Delete Project"
          description={
            project ? getProjectDeleteDescription(project.name) : ""
          }
          confirmLabel="Delete Project"
          deleting={deletingProject}
          onConfirm={handleDelete}
        />
      </div>
    </DashboardLayout>
  );
}
