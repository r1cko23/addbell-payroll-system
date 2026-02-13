"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/lib/hooks/useProfile";
import { Plus, Search, TrendingUp, DollarSign, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";

type ProjectType = "new_construction" | "renovation" | "addition" | "repair" | "interior_fitout" | "other";
type ProjectSector = "commercial" | "residential" | "industrial" | "infrastructure" | "other";

interface Project {
  id: string;
  project_code: string;
  project_name: string;
  client_id: string;
  project_location: string | null;
  deliver_to: string | null;
  project_type: ProjectType | null;
  project_sector: ProjectSector | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  project_status: "planning" | "active" | "on-hold" | "completed" | "cancelled";
  progress_percentage: number;
  budget_amount: number | null;
  contract_amount: number | null;
  project_manager_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  clients: {
    client_code: string;
    client_name: string;
  } | null;
}

interface Client {
  id: string;
  client_code: string;
  client_name: string;
}

export default function ProjectsPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);

  // Form state
  const [projectCode, setProjectCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [projectType, setProjectType] = useState<ProjectType | "">("");
  const [projectSector, setProjectSector] = useState<ProjectSector | "">("");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [projectStatus, setProjectStatus] = useState<Project["project_status"]>("planning");
  const [progressPercentage, setProgressPercentage] = useState("0");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchProjects();
    fetchClients();
  }, [supabase]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, client_code, client_name")
        .eq("is_active", true)
        .order("client_name", { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      console.error("Failed to load clients:", error);
    }
  };

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select(`
          *,
          clients:client_id (
            client_code,
            client_name
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error) {
      toast.error("Failed to load projects");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setProjectCode(project.project_code);
      setProjectName(project.project_name);
      setClientId(project.client_id || "");
      setProjectLocation(project.project_location || "");
      setDeliverTo(project.deliver_to || "");
      setProjectType((project.project_type as ProjectType) || "");
      setProjectSector((project.project_sector as ProjectSector) || "");
      setStartDate(project.start_date || "");
      setTargetEndDate(project.target_end_date || "");
      setProjectStatus(project.project_status);
      setProgressPercentage(project.progress_percentage.toString());
      setBudgetAmount(project.budget_amount?.toString() || "");
      setContractAmount(project.contract_amount?.toString() || "");
      setDescription(project.description || "");
      setIsActive(project.is_active);
    } else {
      setEditingProject(null);
      setProjectCode("");
      setProjectName("");
      setClientId("");
      setProjectLocation("");
      setDeliverTo("");
      setProjectType("");
      setProjectSector("");
      setStartDate("");
      setTargetEndDate("");
      setProjectStatus("planning");
      setProgressPercentage("0");
      setBudgetAmount("");
      setContractAmount("");
      setDescription("");
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingProject(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectCode.trim() || !projectName.trim()) {
      toast.error("Project code and name are required");
      return;
    }

    try {
      const progressValue = parseFloat(progressPercentage) || 0;
      if (progressValue < 0 || progressValue > 100) {
        toast.error("Progress must be between 0 and 100");
        return;
      }

      const payload: any = {
        project_code: projectCode.trim(),
        project_name: projectName.trim(),
        client_id: (clientId && clientId !== "__none__") ? clientId : null,
        project_location: projectLocation.trim() || null,
        deliver_to: deliverTo.trim() || null,
        project_type: projectType || null,
        project_sector: projectSector || null,
        start_date: startDate || null,
        target_end_date: targetEndDate || null,
        project_status: projectStatus,
        progress_percentage: progressValue,
        budget_amount: budgetAmount ? parseFloat(budgetAmount) : null,
        contract_amount: contractAmount ? parseFloat(contractAmount) : null,
        description: description.trim() || null,
        is_active: isActive,
        created_by: profile?.id || null,
      };

      if (editingProject) {
        const { error } = await supabase
          .from("projects")
          .update(payload)
          .eq("id", editingProject.id);

        if (error) throw error;

        const oldProgress = Number(editingProject.progress_percentage || 0);
        if (Math.abs(oldProgress - progressValue) > 0.0001) {
          const { error: progressHistoryError } = await supabase
            .from("project_progress")
            .insert({
              project_id: editingProject.id,
              progress_date: format(new Date(), "yyyy-MM-dd"),
              progress_percentage: progressValue,
              milestone: `Progress updated from ${oldProgress.toFixed(2)}% to ${progressValue.toFixed(2)}%`,
              notes: "Auto-recorded from Projects page update",
              created_by: profile?.id || null,
            });

          if (progressHistoryError) {
            console.error("Failed to record progress history:", progressHistoryError);
            toast.warning("Project updated, but progress history entry was not saved.");
          }
        }

        toast.success("Project updated successfully");
      } else {
        const { data: newProject, error } = await supabase
          .from("projects")
          .insert(payload)
          .select("id")
          .single();

        if (error) throw error;

        if (newProject?.id && progressValue > 0) {
          const { error: progressHistoryError } = await supabase
            .from("project_progress")
            .insert({
              project_id: newProject.id,
              progress_date: format(new Date(), "yyyy-MM-dd"),
              progress_percentage: progressValue,
              milestone: "Initial project progress",
              notes: "Auto-recorded when project was created",
              created_by: profile?.id || null,
            });
          if (progressHistoryError) {
            console.error("Failed to record initial progress history:", progressHistoryError);
          }
        }

        toast.success("Project created successfully");
      }

      handleCloseDialog();
      fetchProjects();
    } catch (error: any) {
      toast.error(error.message || "Failed to save project");
      console.error(error);
    }
  };

    const formatProjectType = (t: ProjectType | null) =>
    t ? formatLabel(t) : "—";
  const formatProjectSector = (s: ProjectSector | null) =>
    s ? formatLabel(s) : "—";

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

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.project_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      project.clients?.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (project.project_location && project.project_location.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "all" || project.project_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const canManage = profile?.role === "admin" || profile?.role === "hr" || profile?.role === "operations_manager";

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Manage construction projects, track progress, and monitor costs
          </p>
        </div>
        {canManage && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="h-4 w-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProject ? "Edit Project" : "New Project"}
                </DialogTitle>
                <DialogDescription>
                  {editingProject
                    ? "Update project information"
                    : "Create a new construction project"}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="project_code">Project Code *</Label>
                    <Input
                      id="project_code"
                      value={projectCode}
                      onChange={(e) => setProjectCode(e.target.value)}
                      required
                      disabled={!!editingProject}
                    />
                  </div>
                  <div>
                    <Label htmlFor="project_name">Project Name *</Label>
                    <Input
                      id="project_name"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="client_id">Client</Label>
                  <Select value={clientId || "__none__"} onValueChange={(v) => setClientId(v === "__none__" ? "" : v)}>
                    <SelectTrigger id="client_id">
                      <SelectValue placeholder="Select client (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_code} - {client.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="project_location">Project Location / Job Site Address</Label>
                  <Input
                    id="project_location"
                    value={projectLocation}
                    onChange={(e) => setProjectLocation(e.target.value)}
                    placeholder="e.g., Building name, City"
                  />
                </div>
                <div>
                  <Label htmlFor="deliver_to">Deliver To (for POs)</Label>
                  <Input
                    id="deliver_to"
                    value={deliverTo}
                    onChange={(e) => setDeliverTo(e.target.value)}
                    placeholder="Default delivery address for Purchase Orders. Leave blank to use Location."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="project_type">Project Type</Label>
                    <Select value={projectType} onValueChange={(v) => setProjectType(v as ProjectType)}>
                      <SelectTrigger id="project_type">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new_construction">New Construction</SelectItem>
                        <SelectItem value="renovation">Renovation</SelectItem>
                        <SelectItem value="addition">Addition</SelectItem>
                        <SelectItem value="repair">Repair</SelectItem>
                        <SelectItem value="interior_fitout">Interior Fit-out</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="project_sector">Sector</Label>
                    <Select value={projectSector} onValueChange={(v) => setProjectSector(v as ProjectSector)}>
                      <SelectTrigger id="project_sector">
                        <SelectValue placeholder="Select sector" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="commercial">Commercial</SelectItem>
                        <SelectItem value="residential">Residential</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="infrastructure">Infrastructure</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="target_end_date">Target End Date</Label>
                    <Input
                      id="target_end_date"
                      type="date"
                      value={targetEndDate}
                      onChange={(e) => setTargetEndDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="project_status">Status</Label>
                    <Select
                      value={projectStatus}
                      onValueChange={(value) => setProjectStatus(value as Project["project_status"])}
                    >
                      <SelectTrigger id="project_status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planning">{formatLabel("planning")}</SelectItem>
                        <SelectItem value="active">{formatLabel("active")}</SelectItem>
                        <SelectItem value="on-hold">{formatLabel("on-hold")}</SelectItem>
                        <SelectItem value="completed">{formatLabel("completed")}</SelectItem>
                        <SelectItem value="cancelled">{formatLabel("cancelled")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="progress_percentage">Progress (%)</Label>
                    <Input
                      id="progress_percentage"
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={progressPercentage}
                      onChange={(e) => setProgressPercentage(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="budget_amount">Budget Amount</Label>
                    <Input
                      id="budget_amount"
                      type="number"
                      step="0.01"
                      value={budgetAmount}
                      onChange={(e) => setBudgetAmount(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contract_amount">Contract Amount</Label>
                    <Input
                      id="contract_amount"
                      type="number"
                      step="0.01"
                      value={contractAmount}
                      onChange={(e) => setContractAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="is_active">Active</Label>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {editingProject ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="planning">{formatLabel("planning")}</SelectItem>
            <SelectItem value="active">{formatLabel("active")}</SelectItem>
            <SelectItem value="on-hold">{formatLabel("on-hold")}</SelectItem>
            <SelectItem value="completed">{formatLabel("completed")}</SelectItem>
            <SelectItem value="cancelled">{formatLabel("cancelled")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm || statusFilter !== "all"
                ? "No projects match your filters."
                : "No projects yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProjects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.project_code}</TableCell>
                    <TableCell>
                      <Link
                        href={`/projects/${project.id}`}
                        className="text-primary hover:underline font-medium"
                      >
                        {project.project_name}
                      </Link>
                    </TableCell>
                    <TableCell>{project.clients?.client_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatProjectType(project.project_type)}</TableCell>
                    <TableCell>{project.project_location || "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 min-w-[120px]">
                        <Progress value={project.progress_percentage} className="flex-1" />
                        <span className="text-sm text-muted-foreground">
                          {project.progress_percentage.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(project.project_status)}>
                        {formatLabel(project.project_status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {project.budget_amount
                        ? `₱${project.budget_amount.toLocaleString()}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="ghost" size="sm">
                          View Details
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}