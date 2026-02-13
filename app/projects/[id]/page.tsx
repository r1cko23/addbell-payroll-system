"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatLabel } from "@/utils/format";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProfile } from "@/lib/hooks/useProfile";
import {
  ArrowLeft,
  Plus,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  MapPin,
  Edit,
  Clock,
  Trash2,
  FileText,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_id: string | null;
  project_location: string | null;
  deliver_to: string | null;
  project_type: string | null;
  project_sector: string | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  project_status: "planning" | "active" | "on-hold" | "completed" | "cancelled";
  progress_percentage: number;
  budget_amount: number | null;
  contract_amount: number | null;
  description: string | null;
  clients: {
    client_code: string;
    client_name: string;
  } | null;
}

interface ProjectCost {
  id: string;
  cost_type: "material" | "manpower" | "machine" | "other";
  cost_category: string | null;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_cost: number | null;
  total_cost: number;
  cost_date: string;
  vendor_supplier: string | null;
  invoice_number: string | null;
  payment_status: "pending" | "partial" | "paid";
}

interface ProjectAssignment {
  id: string;
  employee_id: string;
  role: string | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  employees: {
    employee_id: string;
    full_name: string;
  } | null;
}

interface ProjectTimeEntry {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  regular_hours: number;
  overtime_hours: number;
  night_diff_hours: number;
  total_hours: number;
  notes: string | null;
  is_approved: boolean;
  employees: {
    employee_id: string;
    full_name: string;
  } | null;
}

interface ProjectProgress {
  id: string;
  progress_date: string;
  progress_percentage: number;
  notes: string | null;
  milestone: string | null;
  created_at: string;
}

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
  const [progressHistory, setProgressHistory] = useState<ProjectProgress[]>([]);
  const [projectVendors, setProjectVendors] = useState<{ id: string; vendor_id: string; vendors: { name: string; tin: string; phone: string; email: string } | null }[]>([]);
  const [allVendors, setAllVendors] = useState<{ id: string; name: string }[]>([]);
  const [isVendorDialogOpen, setIsVendorDialogOpen] = useState(false);
  const [addVendorId, setAddVendorId] = useState("");
  const [loading, setLoading] = useState(true);

  // Cost summary
  const [materialCost, setMaterialCost] = useState(0);
  const [manpowerCost, setManpowerCost] = useState(0);
  const [machineCost, setMachineCost] = useState(0);
  const [otherCost, setOtherCost] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // Dialog states
  const [isCostDialogOpen, setIsCostDialogOpen] = useState(false);
  const [isProgressDialogOpen, setIsProgressDialogOpen] = useState(false);
  const [isAssignmentDialogOpen, setIsAssignmentDialogOpen] = useState(false);

  // Cost form state
  const [costType, setCostType] = useState<ProjectCost["cost_type"]>("material");
  const [costCategory, setCostCategory] = useState("");
  const [costDescription, setCostDescription] = useState("");
  const [costQuantity, setCostQuantity] = useState("");
  const [costUnit, setCostUnit] = useState("");
  const [costUnitCost, setCostUnitCost] = useState("");
  const [costTotalCost, setCostTotalCost] = useState("");
  const [costDate, setCostDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [costVendor, setCostVendor] = useState("");
  const [costInvoice, setCostInvoice] = useState("");
  const [costPaymentStatus, setCostPaymentStatus] = useState<ProjectCost["payment_status"]>("pending");

  // Progress form state
  const [progressPercentage, setProgressPercentage] = useState("");
  const [progressDate, setProgressDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [progressMilestone, setProgressMilestone] = useState("");
  const [progressNotes, setProgressNotes] = useState("");

  useEffect(() => {
    if (projectId) {
      fetchProjectData();
    }
  }, [projectId, supabase]);

  const fetchProjectData = async () => {
    try {
      setLoading(true);

      // Fetch project
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(`
          *,
          clients:client_id (
            client_code,
            client_name
          )
        `)
        .eq("id", projectId)
        .single();

      if (projectError) throw projectError;
      setProject(projectData);

      // Fetch costs
      const { data: costsData, error: costsError } = await supabase
        .from("project_costs")
        .select("*")
        .eq("project_id", projectId)
        .order("cost_date", { ascending: false });

      if (costsError) throw costsError;
      setCosts(costsData || []);

      // Calculate cost summary
      const material = (costsData || []).filter(c => c.cost_type === "material").reduce((sum, c) => sum + c.total_cost, 0);
      const machine = (costsData || []).filter(c => c.cost_type === "machine").reduce((sum, c) => sum + c.total_cost, 0);
      const other = (costsData || []).filter(c => c.cost_type === "other").reduce((sum, c) => sum + c.total_cost, 0);

      // Fetch manpower costs
      const { data: manpowerData, error: manpowerError } = await supabase
        .from("project_manpower_costs")
        .select("total_cost")
        .eq("project_id", projectId);

      const manpower = (manpowerData || []).reduce((sum, c) => sum + c.total_cost, 0);

      setMaterialCost(material);
      setManpowerCost(manpower);
      setMachineCost(machine);
      setOtherCost(other);
      setTotalCost(material + manpower + machine + other);

      // Fetch assignments
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from("project_assignments")
        .select(`
          *,
          employees:employee_id (
            employee_id,
            full_name
          )
        `)
        .eq("project_id", projectId)
        .order("start_date", { ascending: false });

      if (assignmentsError) throw assignmentsError;
      setAssignments(assignmentsData || []);

      // Fetch time entries
      const { data: timeEntriesData, error: timeEntriesError } = await supabase
        .from("project_time_entries")
        .select(`
          *,
          employees:employee_id (
            employee_id,
            full_name
          )
        `)
        .eq("project_id", projectId)
        .order("clock_in", { ascending: false })
        .limit(50);

      if (timeEntriesError) throw timeEntriesError;
      setTimeEntries(timeEntriesData || []);

      // Fetch progress history
      const { data: progressData, error: progressError } = await supabase
        .from("project_progress")
        .select("*")
        .eq("project_id", projectId)
        .order("progress_date", { ascending: false });

      if (progressError) throw progressError;
      setProgressHistory(progressData || []);

      // Fetch project vendors
      const { data: pvData, error: pvError } = await supabase
        .from("project_vendors")
        .select(`
          id,
          vendor_id,
          vendors(name, tin, phone, email)
        `)
        .eq("project_id", projectId);

      if (!pvError) {
        const normalized = (pvData || []).map((pv: { id: string; vendor_id: string; vendors: { name: string; tin: string; phone: string; email: string } | { name: string; tin: string; phone: string; email: string }[] | null }) => ({
          id: pv.id,
          vendor_id: pv.vendor_id,
          vendors: Array.isArray(pv.vendors) ? (pv.vendors[0] || null) : pv.vendors,
        }));
        setProjectVendors(normalized);
      }

      // Fetch all vendors for add dropdown
      const { data: vendorsData } = await supabase
        .from("vendors")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      setAllVendors(vendorsData || []);

    } catch (error) {
      toast.error("Failed to load project data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCost = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!costDescription.trim() || !costTotalCost) {
      toast.error("Description and total cost are required");
      return;
    }

    try {
      const totalCostValue = parseFloat(costTotalCost);
      if (isNaN(totalCostValue) || totalCostValue <= 0) {
        toast.error("Invalid total cost");
        return;
      }

      const payload: any = {
        project_id: projectId,
        cost_type: costType,
        cost_category: costCategory.trim() || null,
        description: costDescription.trim(),
        quantity: costQuantity ? parseFloat(costQuantity) : null,
        unit: costUnit.trim() || null,
        unit_cost: costUnitCost ? parseFloat(costUnitCost) : null,
        total_cost: totalCostValue,
        cost_date: costDate,
        vendor_supplier: costVendor.trim() || null,
        invoice_number: costInvoice.trim() || null,
        payment_status: costPaymentStatus,
        created_by: profile?.id || null,
      };

      const { error } = await supabase
        .from("project_costs")
        .insert(payload);

      if (error) throw error;

      toast.success("Cost added successfully");
      setIsCostDialogOpen(false);

      // Reset form
      setCostType("material");
      setCostCategory("");
      setCostDescription("");
      setCostQuantity("");
      setCostUnit("");
      setCostUnitCost("");
      setCostTotalCost("");
      setCostDate(format(new Date(), "yyyy-MM-dd"));
      setCostVendor("");
      setCostInvoice("");
      setCostPaymentStatus("pending");

      fetchProjectData();
    } catch (error: any) {
      toast.error(error.message || "Failed to add cost");
      console.error(error);
    }
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();

    const progressValue = parseFloat(progressPercentage);
    if (isNaN(progressValue) || progressValue < 0 || progressValue > 100) {
      toast.error("Progress must be between 0 and 100");
      return;
    }

    try {
      const payload: any = {
        project_id: projectId,
        progress_date: progressDate,
        progress_percentage: progressValue,
        milestone: progressMilestone.trim() || null,
        notes: progressNotes.trim() || null,
        created_by: profile?.id || null,
      };

      const { error } = await supabase
        .from("project_progress")
        .insert(payload);

      if (error) throw error;

      // Update project progress percentage
      const { error: updateError } = await supabase
        .from("projects")
        .update({ progress_percentage: progressValue })
        .eq("id", projectId);

      if (updateError) throw updateError;

      toast.success("Progress updated successfully");
      setIsProgressDialogOpen(false);

      // Reset form
      setProgressPercentage("");
      setProgressDate(format(new Date(), "yyyy-MM-dd"));
      setProgressMilestone("");
      setProgressNotes("");

      fetchProjectData();
    } catch (error: any) {
      toast.error(error.message || "Failed to update progress");
      console.error(error);
    }
  };

  const handleAddProjectVendor = async () => {
    if (!addVendorId) return;
    try {
      const { error } = await supabase.from("project_vendors").insert({
        project_id: projectId,
        vendor_id: addVendorId,
      });
      if (error) throw error;
      toast.success("Vendor linked to project");
      setIsVendorDialogOpen(false);
      setAddVendorId("");
      fetchProjectData();
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to add vendor");
    }
  };

  const handleRemoveProjectVendor = async (pvId: string) => {
    if (!confirm("Remove this vendor from the project?")) return;
    try {
      const { error } = await supabase.from("project_vendors").delete().eq("id", pvId);
      if (error) throw error;
      toast.success("Vendor removed");
      fetchProjectData();
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to remove vendor");
    }
  };

  const getStatusColor = (status: Project["project_status"]) => {
    switch (status) {
      case "active":
        return "default";
      case "completed":
        return "default";
      case "on-hold":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  const canManage = profile?.role === "admin" || profile?.role === "hr" || profile?.role === "operations_manager";
  const profit = (project?.contract_amount || 0) - totalCost;
  const profitMargin = project?.contract_amount ? (profit / project.contract_amount) * 100 : 0;

  if (loading || profileLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Link href="/projects">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Projects
            </Button>
          </Link>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Project not found
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/projects">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.project_name}</h1>
            <p className="text-muted-foreground text-sm">
              {project.project_code} • {project.clients?.client_name}
            </p>
          </div>
        </div>
        {canManage && (
          <Button onClick={() => router.push(`/projects/${projectId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit Project
          </Button>
        )}
      </div>

      {/* Project Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="text-2xl font-bold">{project.progress_percentage.toFixed(1)}%</div>
              <Progress value={project.progress_percentage} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₱{totalCost.toLocaleString()}</div>
            {project.budget_amount && (
              <p className="text-xs text-muted-foreground mt-1">
                Budget: ₱{project.budget_amount.toLocaleString()}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Profit/Loss
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
              ₱{profit.toLocaleString()}
            </div>
            {project.contract_amount && (
              <p className="text-xs text-muted-foreground mt-1">
                Margin: {profitMargin.toFixed(1)}%
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Assigned Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {assignments.filter(a => a.is_active).length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Total: {assignments.length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Project Details */}
      <Card>
        <CardHeader>
          <CardTitle>Project Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={getStatusColor(project.project_status)}>
                  {formatLabel(project.project_status)}
                </Badge>
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Location
              </Label>
              <p className="mt-1">{project.project_location || "—"}</p>
            </div>
            {(project.deliver_to || project.project_type || project.project_sector) && (
              <>
                {project.deliver_to && (
                  <div>
                    <Label className="text-muted-foreground">Deliver To</Label>
                    <p className="mt-1">{project.deliver_to}</p>
                  </div>
                )}
                {project.project_type && (
                  <div>
                    <Label className="text-muted-foreground">Project Type</Label>
                    <p className="mt-1">{formatLabel(project.project_type)}</p>
                  </div>
                )}
                {project.project_sector && (
                  <div>
                    <Label className="text-muted-foreground">Sector</Label>
                    <p className="mt-1">{formatLabel(project.project_sector)}</p>
                  </div>
                )}
              </>
            )}
            <div>
              <Label className="text-muted-foreground flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <p className="mt-1">
                {project.start_date ? format(new Date(project.start_date), "MMM d, yyyy") : "—"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Target End Date</Label>
              <p className="mt-1">
                {project.target_end_date ? format(new Date(project.target_end_date), "MMM d, yyyy") : "—"}
              </p>
            </div>
            {project.description && (
              <div className="md:col-span-2">
                <Label className="text-muted-foreground">Description</Label>
                <p className="mt-1">{project.description}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Costs, Assignments, Time Entries, Progress */}
      <Tabs defaultValue="costs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="time-entries">Time Entries</TabsTrigger>
          <TabsTrigger value="progress">Progress History</TabsTrigger>
        </TabsList>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Project Costs</h3>
            {canManage && (
              <Dialog open={isCostDialogOpen} onOpenChange={setIsCostDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsCostDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Cost
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Add Project Cost</DialogTitle>
                    <DialogDescription>
                      Record material, machine, or other costs for this project
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddCost} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cost_type">Cost Type *</Label>
                        <Select value={costType} onValueChange={(value) => setCostType(value as ProjectCost["cost_type"])}>
                          <SelectTrigger id="cost_type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="material">{formatLabel("material")}</SelectItem>
                            <SelectItem value="machine">{formatLabel("machine")}</SelectItem>
                            <SelectItem value="other">{formatLabel("other")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="cost_date">Date *</Label>
                        <Input
                          id="cost_date"
                          type="date"
                          value={costDate}
                          onChange={(e) => setCostDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="cost_category">Category</Label>
                      <Input
                        id="cost_category"
                        value={costCategory}
                        onChange={(e) => setCostCategory(e.target.value)}
                        placeholder="e.g., Cement, Steel, Equipment Rental"
                      />
                    </div>
                    <div>
                      <Label htmlFor="cost_description">Description *</Label>
                      <Textarea
                        id="cost_description"
                        value={costDescription}
                        onChange={(e) => setCostDescription(e.target.value)}
                        required
                        rows={2}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="cost_quantity">Quantity</Label>
                        <Input
                          id="cost_quantity"
                          type="number"
                          step="0.01"
                          value={costQuantity}
                          onChange={(e) => setCostQuantity(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost_unit">Unit</Label>
                        <Input
                          id="cost_unit"
                          value={costUnit}
                          onChange={(e) => setCostUnit(e.target.value)}
                          placeholder="e.g., bags, kg, hours"
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost_unit_cost">Unit Cost</Label>
                        <Input
                          id="cost_unit_cost"
                          type="number"
                          step="0.01"
                          value={costUnitCost}
                          onChange={(e) => setCostUnitCost(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cost_total_cost">Total Cost *</Label>
                        <Input
                          id="cost_total_cost"
                          type="number"
                          step="0.01"
                          value={costTotalCost}
                          onChange={(e) => setCostTotalCost(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost_payment_status">Payment Status</Label>
                        <Select value={costPaymentStatus} onValueChange={(value) => setCostPaymentStatus(value as ProjectCost["payment_status"])}>
                          <SelectTrigger id="cost_payment_status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">{formatLabel("pending")}</SelectItem>
                            <SelectItem value="partial">{formatLabel("partial")}</SelectItem>
                            <SelectItem value="paid">{formatLabel("paid")}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cost_vendor">Vendor/Supplier</Label>
                        <Input
                          id="cost_vendor"
                          value={costVendor}
                          onChange={(e) => setCostVendor(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cost_invoice">Invoice Number</Label>
                        <Input
                          id="cost_invoice"
                          value={costInvoice}
                          onChange={(e) => setCostInvoice(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsCostDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add Cost</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {/* Cost Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Material</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">₱{materialCost.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Manpower</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">₱{manpowerCost.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Machine</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">₱{machineCost.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Other</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">₱{otherCost.toLocaleString()}</div>
              </CardContent>
            </Card>
          </div>

          {/* Costs Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No costs recorded yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    costs.map((cost) => (
                      <TableRow key={cost.id}>
                        <TableCell>{format(new Date(cost.cost_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatLabel(cost.cost_type)}</Badge>
                        </TableCell>
                        <TableCell>{cost.description}</TableCell>
                        <TableCell>{cost.cost_category || "—"}</TableCell>
                        <TableCell className="text-right font-medium">
                          ₱{cost.total_cost.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              cost.payment_status === "paid"
                                ? "default"
                                : cost.payment_status === "partial"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {formatLabel(cost.payment_status)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Assignments Tab */}
        <TabsContent value="assignments" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Assigned Employees</h3>
            {canManage && (
              <Button disabled>
                <Plus className="h-4 w-4 mr-2" />
                Assign Employee
              </Button>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assignments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No employees assigned yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    assignments.map((assignment) => (
                      <TableRow key={assignment.id}>
                        <TableCell>
                          {assignment.employees?.full_name || "—"} ({assignment.employees?.employee_id || "—"})
                        </TableCell>
                        <TableCell>{assignment.role || "—"}</TableCell>
                        <TableCell>{format(new Date(assignment.start_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          {assignment.end_date ? format(new Date(assignment.end_date), "MMM d, yyyy") : "Ongoing"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={assignment.is_active ? "default" : "secondary"}>
                            {assignment.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Project Vendors</h3>
            {canManage && (
              <>
                <Button onClick={() => setIsVendorDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Link Vendor
                </Button>
                <Dialog open={isVendorDialogOpen} onOpenChange={setIsVendorDialogOpen}>
                  <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Link Vendor to Project</DialogTitle>
                    <DialogDescription>
                      Add a vendor to this project. Linked vendors will appear when generating Purchase Orders.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Select value={addVendorId} onValueChange={setAddVendorId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select vendor..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allVendors
                          .filter((v) => !projectVendors.some((pv) => pv.vendor_id === v.id))
                          .map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    {allVendors.filter((v) => !projectVendors.some((pv) => pv.vendor_id === v.id)).length === 0 && (
                      <p className="text-sm text-muted-foreground">All vendors are already linked. Add more in Vendors.</p>
                    )}
                    <Button onClick={handleAddProjectVendor} disabled={!addVendorId}>
                      Add
                    </Button>
                  </div>
                </DialogContent>
                </Dialog>
              </>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>TIN</TableHead>
                    <TableHead>Contact</TableHead>
                    {canManage && <TableHead className="w-16" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectVendors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No vendors linked. Link vendors to quickly select them when generating POs.
                      </TableCell>
                    </TableRow>
                  ) : (
                    projectVendors.map((pv) => (
                      <TableRow key={pv.id}>
                        <TableCell className="font-medium">{pv.vendors?.name || "—"}</TableCell>
                        <TableCell>{pv.vendors?.tin || "—"}</TableCell>
                        <TableCell>{pv.vendors?.phone || pv.vendors?.email || "—"}</TableCell>
                        {canManage && (
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => handleRemoveProjectVendor(pv.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-sm text-muted-foreground">
            <FileText className="inline h-4 w-4 mr-1" />
            Go to Purchase Order to create POs. You can select project and vendor there for quick fill.
          </p>
        </TabsContent>

        {/* Time Entries Tab */}
        <TabsContent value="time-entries" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Time Entries</h3>
            <Link href={`/projects/${projectId}/clock`}>
              <Button>
                <Clock className="h-4 w-4 mr-2" />
                Clock In/Out
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Clock In</TableHead>
                    <TableHead>Clock Out</TableHead>
                    <TableHead className="text-right">Regular Hours</TableHead>
                    <TableHead className="text-right">OT Hours</TableHead>
                    <TableHead className="text-right">Total Hours</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No time entries yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    timeEntries.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell>
                          {entry.employees?.full_name || "—"} ({entry.employees?.employee_id || "—"})
                        </TableCell>
                        <TableCell>{format(new Date(entry.clock_in), "MMM d, yyyy h:mm a")}</TableCell>
                        <TableCell>
                          {entry.clock_out ? format(new Date(entry.clock_out), "MMM d, yyyy h:mm a") : "—"}
                        </TableCell>
                        <TableCell className="text-right">{entry.regular_hours.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{entry.overtime_hours.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-medium">{entry.total_hours.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={entry.is_approved ? "default" : "secondary"}>
                            {entry.is_approved ? "Approved" : "Pending"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Progress History Tab */}
        <TabsContent value="progress" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Progress History</h3>
            {canManage && (
              <Dialog open={isProgressDialogOpen} onOpenChange={setIsProgressDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setIsProgressDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Update Progress
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Update Project Progress</DialogTitle>
                    <DialogDescription>
                      Record progress update with percentage and milestone
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleUpdateProgress} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="progress_date">Date *</Label>
                        <Input
                          id="progress_date"
                          type="date"
                          value={progressDate}
                          onChange={(e) => setProgressDate(e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="progress_percentage">Progress (%) *</Label>
                        <Input
                          id="progress_percentage"
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={progressPercentage}
                          onChange={(e) => setProgressPercentage(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="progress_milestone">Milestone</Label>
                      <Input
                        id="progress_milestone"
                        value={progressMilestone}
                        onChange={(e) => setProgressMilestone(e.target.value)}
                        placeholder="e.g., Foundation Complete, Framing Started"
                      />
                    </div>
                    <div>
                      <Label htmlFor="progress_notes">Notes</Label>
                      <Textarea
                        id="progress_notes"
                        value={progressNotes}
                        onChange={(e) => setProgressNotes(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsProgressDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Update Progress</Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progressHistory.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No progress updates yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    progressHistory.map((progress) => (
                      <TableRow key={progress.id}>
                        <TableCell>{format(new Date(progress.progress_date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={progress.progress_percentage} className="w-24" />
                            <span className="font-medium">{progress.progress_percentage.toFixed(1)}%</span>
                          </div>
                        </TableCell>
                        <TableCell>{progress.milestone || "—"}</TableCell>
                        <TableCell>{progress.notes || "—"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </DashboardLayout>
  );
}