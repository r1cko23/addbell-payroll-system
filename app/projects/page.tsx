"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteProject } from "@/lib/delete-project-client";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/lib/hooks/useProfile";
import { Plus, Search, Trash2 } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { PageSubtitle } from "@/components/ui/typography";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { TypeToDeleteDialog } from "@/components/TypeToDeleteDialog";
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_LABELS,
  getProjectDeleteDescription,
  getProjectDeleteErrorMessage,
  getProjectStatusColor,
  getProjectStatusLabel,
  projectMatchesStatusFilter,
} from "@/types/project";

interface Project {
  id: string;
  code: string;
  name: string;
  client_id: string | null;
  site_address: string | null;
  city: string | null;
  province: string | null;
  description: string | null;
  start_date: string | null;
  target_end_date: string | null;
  actual_end_date: string | null;
  status: string;
  contract_value: number | null;
  budget_labor: number | null;
  budget_materials: number | null;
  budget_subcontract: number | null;
  budget_other: number | null;
  project_manager_id: string | null;
  progress_percentage: number;
  is_active: boolean;
  created_at: string;
  clients: { name: string } | null;
}

interface Client { id: string; name: string }

export default function ProjectsPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isHR, loading: roleLoading } = useUserRole();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [siteAddress, setSiteAddress] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [startDate, setStartDate] = useState("");
  const [targetEndDate, setTargetEndDate] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [contractValue, setContractValue] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => { fetchProjects(); fetchClients(); }, [supabase]);

  useEffect(() => {
    if (!roleLoading && isHR) {
      toast.error("Projects are not available for HR.");
      router.replace("/dashboard?type=workforce");
    }
  }, [isHR, roleLoading, router]);

  const fetchClients = async () => {
    const { data } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
    setClients(data ?? []);
  };

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("projects").select("*, clients:client_id ( name )").order("created_at", { ascending: false });
    if (error) toast.error("Failed to load projects");
    setProjects((data as Project[]) ?? []);
    setLoading(false);
  };

  const resetForm = () => {
    setCode(""); setName(""); setClientId(""); setSiteAddress(""); setCity(""); setProvince("");
    setStartDate(""); setTargetEndDate(""); setStatus("pending"); setContractValue(""); setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) { toast.error("Code and name are required."); return; }

    let companyId: string | null = null;
    const { data: co } = await supabase.from("companies").select("id").limit(1).single();
    companyId = co?.id ?? null;

    const payload = {
      company_id: companyId,
      code: code.trim(),
      name: name.trim(),
      client_id: clientId || null,
      site_address: siteAddress.trim() || null,
      city: city.trim() || null,
      province: province.trim() || null,
      start_date: startDate || null,
      target_end_date: targetEndDate || null,
      status,
      contract_value: contractValue ? Number(contractValue) : null,
      description: description.trim() || null,
    };

    const { error } = await supabase.from("projects").insert(payload as never);
    if (error) { toast.error(error.message); return; }

    toast.success("Project created.");
    setIsDialogOpen(false);
    resetForm();
    fetchProjects();
  };

  const handleDelete = async () => {
    if (!projectToDelete) return;

    setDeletingProject(true);
    try {
      await deleteProject(projectToDelete.id);
      toast.success("Project deleted successfully");
      setProjectToDelete(null);
      fetchProjects();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error
          ? error.message
          : getProjectDeleteErrorMessage(error)
      );
      console.error(error);
    } finally {
      setDeletingProject(false);
    }
  };

  const canCreateProjects = canCreate("projects");
  const canUpdateProjects = canUpdate("projects");
  const canDeleteProjects = canDelete("projects");
  const canManageProjects =
    canCreateProjects || canUpdateProjects || canDeleteProjects;

  const filteredProjects = projects.filter((p) => {
    if (!projectMatchesStatusFilter(p.status, statusFilter)) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!(p.code || "").toLowerCase().includes(term) && !(p.name || "").toLowerCase().includes(term) && !(p.clients?.name || "").toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const totalBudget = (p: Project) => (p.budget_labor ?? 0) + (p.budget_materials ?? 0) + (p.budget_subcontract ?? 0) + (p.budget_other ?? 0);

  return (
    <DashboardLayout>
      <div className={cn("min-w-0 w-full", dbPageWrapper)}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
            <PageSubtitle className="mt-1">Manage construction projects, track progress, costs, and overall status.</PageSubtitle>
          </div>
          {canCreateProjects && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />New Project</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>New Project</DialogTitle>
                  <DialogDescription>Add a new construction project.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label htmlFor="code">Project Code *</Label><Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required /></div>
                    <div><Label htmlFor="name">Project Name *</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} required /></div>
                  </div>
                  <div>
                    <Label htmlFor="client">Client</Label>
                    <Select value={clientId} onValueChange={setClientId}>
                      <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                      <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Site Address</Label><Input value={siteAddress} onChange={(e) => setSiteAddress(e.target.value)} /></div>
                    <div><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
                    <div><Label>Province</Label><Input value={province} onChange={(e) => setProvince(e.target.value)} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div><Label>Start Date</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
                    <div><Label>Target End</Label><Input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} /></div>
                    <div><Label>Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PROJECT_STATUSES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {PROJECT_STATUS_LABELS[value]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Contract Value (PHP)</Label><Input type="number" step="0.01" value={contractValue} onChange={(e) => setContractValue(e.target.value)} /></div>
                  <div><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Project</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by code, name, or client..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[160px]">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {PROJECT_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {PROJECT_STATUS_LABELS[value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {searchTerm || statusFilter !== "all" ? "No projects match your filters." : "No projects yet."}
              </div>
            ) : (
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 font-medium">Code</th>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Client</th>
                      <th className="px-4 py-3 font-medium">Location</th>
                      <th className="px-4 py-3 font-medium text-right">Contract Value</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      {canManageProjects ? (
                        <th className="px-4 py-3 font-medium text-right">Actions</th>
                      ) : (
                        <th className="px-4 py-3 font-medium" />
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProjects.map((p) => (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-sm">{p.code}</td>
                        <td className="px-4 py-3 max-w-[200px] truncate font-medium">{p.name}</td>
                        <td className="px-4 py-3 max-w-[150px] truncate">{p.clients?.name ?? "—"}</td>
                        <td className="px-4 py-3 max-w-[180px] truncate">{[p.site_address, p.city].filter(Boolean).join(", ") || "—"}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{p.contract_value ? `₱${Number(p.contract_value).toLocaleString()}` : "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={getProjectStatusColor(p.status)} className="text-xs">
                            {getProjectStatusLabel(p.status)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/projects/${p.id}`}
                              className="text-primary font-medium hover:underline text-sm"
                            >
                              View
                            </Link>
                            {canDeleteProjects ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setProjectToDelete(p)}
                                aria-label={`Delete ${p.name}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <TypeToDeleteDialog
          open={!!projectToDelete}
          onOpenChange={(open) => {
            if (!deletingProject) setProjectToDelete(open ? projectToDelete : null);
          }}
          title="Delete Project"
          description={
            projectToDelete
              ? getProjectDeleteDescription(projectToDelete.name)
              : ""
          }
          confirmLabel="Delete Project"
          deleting={deletingProject}
          onConfirm={handleDelete}
        />
      </div>
    </DashboardLayout>
  );
}
