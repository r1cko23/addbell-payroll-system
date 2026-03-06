"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { ArrowLeft, Plus, TrendingUp, DollarSign, Users, Calendar, MapPin, Clock, Trash2, FileText } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Project {
  id: string; code: string; name: string; client_id: string | null; site_address: string | null;
  city: string | null; province: string | null; description: string | null;
  start_date: string | null; target_end_date: string | null; actual_end_date: string | null;
  status: string; contract_value: number | null; budget_labor: number | null; budget_materials: number | null;
  budget_subcontract: number | null; budget_other: number | null; project_manager_id: string | null;
  progress_percentage: number; is_active: boolean;
  clients: { name: string } | null;
}
interface ProjectCost { id: string; cost_type: string; cost_category: string | null; description: string; quantity: number | null; unit: string | null; unit_cost: number | null; total_cost: number; cost_date: string; vendor_supplier: string | null; invoice_number: string | null; payment_status: string; }
interface ProjectAssignment { id: string; employee_id: string; role: string | null; start_date: string; end_date: string | null; is_active: boolean; employees: { employee_code: string; first_name: string; last_name: string } | null; }
interface ProjectTimeEntry { id: string; employee_id: string; clock_in: string; clock_out: string | null; regular_hours: number; overtime_hours: number; night_diff_hours: number; total_hours: number; notes: string | null; is_approved: boolean; employees: { employee_code: string; first_name: string; last_name: string } | null; }
interface ProjectProgressEntry { id: string; progress_date: string; progress_percentage: number; notes: string | null; milestone: string | null; created_at: string; }
interface FundRequestBrief { id: string; purpose: string; total_requested_amount: number; status: string; request_date: string; }
interface POBrief { id: string; po_number: string; total_amount: number; status: string; po_date: string; vendors: { name: string } | null; }

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", completed: "default", "on-hold": "secondary", cancelled: "destructive", planned: "outline",
};

function formatLabel(s: string): string { return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();

  const [project, setProject] = useState<Project | null>(null);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [assignments, setAssignments] = useState<ProjectAssignment[]>([]);
  const [timeEntries, setTimeEntries] = useState<ProjectTimeEntry[]>([]);
  const [progressHistory, setProgressHistory] = useState<ProjectProgressEntry[]>([]);
  const [fundRequests, setFundRequests] = useState<FundRequestBrief[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<POBrief[]>([]);
  const [loading, setLoading] = useState(true);

  const [materialCost, setMaterialCost] = useState(0);
  const [manpowerCost, setManpowerCost] = useState(0);
  const [machineCost, setMachineCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);

  const [costType, setCostType] = useState("material");
  const [costCategory, setCostCategory] = useState("");
  const [costDescription, setCostDescription] = useState("");
  const [costQuantity, setCostQuantity] = useState("");
  const [costUnit, setCostUnit] = useState("");
  const [costUnitCost, setCostUnitCost] = useState("");
  const [costTotalCost, setCostTotalCost] = useState("");
  const [costDate, setCostDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [costVendor, setCostVendor] = useState("");
  const [costInvoice, setCostInvoice] = useState("");
  const [costPaymentStatus, setCostPaymentStatus] = useState("pending");

  const [progressPercentage, setProgressPercentage] = useState("");
  const [progressDate, setProgressDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [progressMilestone, setProgressMilestone] = useState("");
  const [progressNotes, setProgressNotes] = useState("");

  useEffect(() => { if (projectId) fetchProjectData(); }, [projectId]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);
      const [projRes, costsRes, manpRes, assignRes, timeRes, progRes, frRes, poRes] = await Promise.all([
        supabase.from("projects").select("*, clients:client_id ( name )").eq("id", projectId).single(),
        supabase.from("project_costs").select("*").eq("project_id", projectId).order("cost_date", { ascending: false }),
        supabase.from("project_manpower_costs").select("total_cost").eq("project_id", projectId),
        supabase.from("project_assignments").select("*, employees:employee_id ( employee_code, first_name, last_name )").eq("project_id", projectId).order("start_date", { ascending: false }),
        supabase.from("project_time_entries").select("*, employees:employee_id ( employee_code, first_name, last_name )").eq("project_id", projectId).order("clock_in", { ascending: false }).limit(50),
        supabase.from("project_progress").select("*").eq("project_id", projectId).order("progress_date", { ascending: false }),
        supabase.from("fund_requests").select("id, purpose, total_requested_amount, status, request_date").eq("project_id", projectId).order("created_at", { ascending: false }),
        supabase.from("purchase_orders").select("id, po_number, total_amount, status, po_date, vendors ( name )").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);

      if (projRes.error) throw projRes.error;
      setProject(projRes.data as Project);
      setCosts(costsRes.data ?? []);
      setAssignments(assignRes.data ?? []);
      setTimeEntries(timeRes.data ?? []);
      setProgressHistory(progRes.data ?? []);
      setFundRequests((frRes.data as unknown as FundRequestBrief[]) ?? []);
      setPurchaseOrders((poRes.data as unknown as POBrief[]) ?? []);

      const material = (costsRes.data ?? []).filter((c: ProjectCost) => c.cost_type === "material").reduce((s: number, c: ProjectCost) => s + c.total_cost, 0);
      const machine = (costsRes.data ?? []).filter((c: ProjectCost) => c.cost_type === "machine").reduce((s: number, c: ProjectCost) => s + c.total_cost, 0);
      const other = (costsRes.data ?? []).filter((c: ProjectCost) => c.cost_type === "other").reduce((s: number, c: ProjectCost) => s + c.total_cost, 0);
      const manpower = (manpRes.data ?? []).reduce((s: number, c: { total_cost: number }) => s + c.total_cost, 0);
      setMaterialCost(material); setManpowerCost(manpower); setMachineCost(machine); setOtherCost(other);
      setTotalCost(material + manpower + machine + other);
    } catch (error) { toast.error("Failed to load project data"); console.error(error); } finally { setLoading(false); }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!costDescription.trim() || !costTotalCost) { toast.error("Description and total cost required."); return; }
    const totalVal = parseFloat(costTotalCost);
    if (isNaN(totalVal) || totalVal <= 0) { toast.error("Invalid total cost."); return; }
    const { error } = await supabase.from("project_costs").insert({
      project_id: projectId, cost_type: costType, cost_category: costCategory.trim() || null,
      description: costDescription.trim(), quantity: costQuantity ? parseFloat(costQuantity) : null,
      unit: costUnit.trim() || null, unit_cost: costUnitCost ? parseFloat(costUnitCost) : null,
      total_cost: totalVal, cost_date: costDate, vendor_supplier: costVendor.trim() || null,
      invoice_number: costInvoice.trim() || null, payment_status: costPaymentStatus,
      created_by: profile?.id || null,
    } as never);
    if (error) { toast.error(error.message); return; }
    toast.success("Cost added.");
    setIsCostDialogOpen(false);
    setCostType("material"); setCostCategory(""); setCostDescription(""); setCostQuantity(""); setCostUnit("");
    setCostUnitCost(""); setCostTotalCost(""); setCostDate(format(new Date(), "yyyy-MM-dd")); setCostVendor(""); setCostInvoice(""); setCostPaymentStatus("pending");
    fetchProjectData();
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

  const canManage = profile?.role === "admin" || profile?.role === "hr" || profile?.role === "operations_manager";
  const budget = project ? (project.budget_labor ?? 0) + (project.budget_materials ?? 0) + (project.budget_subcontract ?? 0) + (project.budget_other ?? 0) : 0;
  const profit = (project?.contract_value ?? 0) - totalCost;
  const profitMargin = project?.contract_value ? (profit / project.contract_value) * 100 : 0;

  if (loading || profileLoading) return <DashboardLayout><div className="animate-pulse h-8 w-48 bg-slate-200 rounded" /></DashboardLayout>;
  if (!project) return (
    <DashboardLayout>
      <div className="space-y-6">
        <Link href="/projects"><Button variant="ghost"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        <Card><CardContent className="p-8 text-center text-muted-foreground">Project not found</CardContent></Card>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/projects"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
              <p className="text-muted-foreground text-sm">{project.code} {project.clients?.name ? `· ${project.clients.name}` : ""}</p>
            </div>
          </div>
          <Badge variant={STATUS_COLORS[project.status] ?? "outline"} className="text-sm capitalize">{formatLabel(project.status)}</Badge>
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
          <TabsList>
            <TabsTrigger value="costs">Costs</TabsTrigger>
            <TabsTrigger value="fund-requests">Fund Requests</TabsTrigger>
            <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="time-entries">Time Entries</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
          </TabsList>

          <TabsContent value="costs" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Project Costs</h3>
              {canManage && (
                <Dialog open={isCostDialogOpen} onOpenChange={setIsCostDialogOpen}>
                  <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Cost</Button></DialogTrigger>
                  <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader><DialogTitle>Add Project Cost</DialogTitle><DialogDescription>Record material, machine, or other costs.</DialogDescription></DialogHeader>
                    <form onSubmit={handleAddCost} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Cost Type *</Label>
                          <Select value={costType} onValueChange={setCostType}><SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="material">Material</SelectItem><SelectItem value="machine">Machine</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                          </Select></div>
                        <div><Label>Date *</Label><Input type="date" value={costDate} onChange={(e) => setCostDate(e.target.value)} required /></div>
                      </div>
                      <div><Label>Category</Label><Input value={costCategory} onChange={(e) => setCostCategory(e.target.value)} /></div>
                      <div><Label>Description *</Label><Textarea value={costDescription} onChange={(e) => setCostDescription(e.target.value)} required rows={2} /></div>
                      <div className="grid grid-cols-3 gap-4">
                        <div><Label>Quantity</Label><Input type="number" step="0.01" value={costQuantity} onChange={(e) => setCostQuantity(e.target.value)} /></div>
                        <div><Label>Unit</Label><Input value={costUnit} onChange={(e) => setCostUnit(e.target.value)} /></div>
                        <div><Label>Unit Cost</Label><Input type="number" step="0.01" value={costUnitCost} onChange={(e) => setCostUnitCost(e.target.value)} /></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Total Cost *</Label><Input type="number" step="0.01" value={costTotalCost} onChange={(e) => setCostTotalCost(e.target.value)} required /></div>
                        <div><Label>Payment Status</Label>
                          <Select value={costPaymentStatus} onValueChange={setCostPaymentStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="pending">Pending</SelectItem><SelectItem value="partial">Partial</SelectItem><SelectItem value="paid">Paid</SelectItem></SelectContent>
                          </Select></div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Vendor/Supplier</Label><Input value={costVendor} onChange={(e) => setCostVendor(e.target.value)} /></div>
                        <div><Label>Invoice Number</Label><Input value={costInvoice} onChange={(e) => setCostInvoice(e.target.value)} /></div>
                      </div>
                      <DialogFooter><Button type="button" variant="outline" onClick={() => setIsCostDialogOpen(false)}>Cancel</Button><Button type="submit">Add Cost</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[{ label: "Material", val: materialCost }, { label: "Manpower", val: manpowerCost }, { label: "Machine", val: machineCost }, { label: "Other", val: otherCost }].map((c) => (
                <Card key={c.label}><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
                  <CardContent><div className="text-xl font-bold">₱{c.val.toLocaleString()}</div></CardContent></Card>
              ))}
            </div>
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{costs.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No costs recorded</TableCell></TableRow> :
                  costs.map((cost) => (
                    <TableRow key={cost.id}>
                      <TableCell>{format(new Date(cost.cost_date), "MMM d, yyyy")}</TableCell>
                      <TableCell><Badge variant="outline">{formatLabel(cost.cost_type)}</Badge></TableCell>
                      <TableCell>{cost.description}</TableCell>
                      <TableCell className="text-right font-medium">₱{cost.total_cost.toLocaleString()}</TableCell>
                      <TableCell><Badge variant={cost.payment_status === "paid" ? "default" : "secondary"}>{formatLabel(cost.payment_status)}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="fund-requests" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Fund Requests</h3>
              <Button asChild><Link href="/fund-request/new"><Plus className="h-4 w-4 mr-2" />New Request</Link></Button>
            </div>
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Purpose</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{fundRequests.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No fund requests for this project</TableCell></TableRow> :
                  fundRequests.map((fr) => (
                    <TableRow key={fr.id}>
                      <TableCell>{format(new Date(fr.request_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{fr.purpose}</TableCell>
                      <TableCell className="text-right font-medium">₱{Number(fr.total_requested_amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={fr.status === "management_approved" ? "default" : fr.status === "rejected" ? "destructive" : "secondary"} className="text-xs capitalize">{fr.status.replace(/_/g, " ")}</Badge></TableCell>
                      <TableCell><Link href={`/fund-request/${fr.id}`} className="text-primary text-sm hover:underline">View</Link></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="purchase-orders" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Purchase Orders</h3>
              <Button asChild><Link href="/purchase-order"><Plus className="h-4 w-4 mr-2" />New PO</Link></Button>
            </div>
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>PO Number</TableHead><TableHead>Date</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>{purchaseOrders.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No purchase orders for this project</TableCell></TableRow> :
                  purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-mono">{po.po_number}</TableCell>
                      <TableCell>{format(new Date(po.po_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{po.vendors?.name ?? "—"}</TableCell>
                      <TableCell className="text-right font-medium">₱{Number(po.total_amount).toLocaleString()}</TableCell>
                      <TableCell><Badge variant={po.status === "posted" || po.status === "approved" ? "default" : po.status === "cancelled" ? "destructive" : "secondary"} className="text-xs capitalize">{po.status}</Badge></TableCell>
                      <TableCell><Link href={`/purchase-order/${po.id}`} className="text-primary text-sm hover:underline">View</Link></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-lg font-semibold">Assigned Employees</h3></div>
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Role</TableHead><TableHead>Start Date</TableHead><TableHead>End Date</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{assignments.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No employees assigned</TableCell></TableRow> :
                  assignments.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.employees ? `${a.employees.first_name} ${a.employees.last_name}` : "—"} ({a.employees?.employee_code ?? "—"})</TableCell>
                      <TableCell>{a.role || "—"}</TableCell>
                      <TableCell>{format(new Date(a.start_date), "MMM d, yyyy")}</TableCell>
                      <TableCell>{a.end_date ? format(new Date(a.end_date), "MMM d, yyyy") : "Ongoing"}</TableCell>
                      <TableCell><Badge variant={a.is_active ? "default" : "secondary"}>{a.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="time-entries" className="space-y-4">
            <h3 className="text-lg font-semibold">Time Entries</h3>
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Employee</TableHead><TableHead>Clock In</TableHead><TableHead>Clock Out</TableHead><TableHead className="text-right">Regular</TableHead><TableHead className="text-right">OT</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{timeEntries.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No time entries</TableCell></TableRow> :
                  timeEntries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.employees ? `${e.employees.first_name} ${e.employees.last_name}` : "—"}</TableCell>
                      <TableCell>{format(new Date(e.clock_in), "MMM d h:mm a")}</TableCell>
                      <TableCell>{e.clock_out ? format(new Date(e.clock_out), "MMM d h:mm a") : "—"}</TableCell>
                      <TableCell className="text-right">{e.regular_hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{e.overtime_hours.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium">{e.total_hours.toFixed(2)}</TableCell>
                      <TableCell><Badge variant={e.is_approved ? "default" : "secondary"}>{e.is_approved ? "Approved" : "Pending"}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="progress" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Progress History</h3>
              {canManage && (
                <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
                  <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Update Progress</Button></DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Update Project Progress</DialogTitle></DialogHeader>
                    <form onSubmit={handleUpdateProgress} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Date *</Label><Input type="date" value={progressDate} onChange={(e) => setProgressDate(e.target.value)} required /></div>
                        <div><Label>Progress (%) *</Label><Input type="number" min="0" max="100" step="0.01" value={progressPercentage} onChange={(e) => setProgressPercentage(e.target.value)} required /></div>
                      </div>
                      <div><Label>Milestone</Label><Input value={progressMilestone} onChange={(e) => setProgressMilestone(e.target.value)} /></div>
                      <div><Label>Notes</Label><Textarea value={progressNotes} onChange={(e) => setProgressNotes(e.target.value)} rows={3} /></div>
                      <DialogFooter><Button type="button" variant="outline" onClick={() => setIsProgressDialogOpen(false)}>Cancel</Button><Button type="submit">Update</Button></DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <Card><CardContent className="p-0">
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Progress</TableHead><TableHead>Milestone</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                <TableBody>{progressHistory.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No progress updates</TableCell></TableRow> :
                  progressHistory.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.progress_date), "MMM d, yyyy")}</TableCell>
                      <TableCell><div className="flex items-center gap-2"><Progress value={p.progress_percentage} className="w-24" /><span className="font-medium">{p.progress_percentage.toFixed(1)}%</span></div></TableCell>
                      <TableCell>{p.milestone || "—"}</TableCell>
                      <TableCell>{p.notes || "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody></Table>
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
