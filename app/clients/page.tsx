"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useClients } from "@/lib/hooks/useClients";
import { bustCache } from "@/lib/cache-client";
import { formatTinWithDashes, TIN_PLACEHOLDER } from "@/lib/tin-format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageSubtitle } from "@/components/ui/typography";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProfile } from "@/lib/hooks/useProfile";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Plus, Pencil, Trash2, Search, ListOrdered } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  ClientMasterlistJobsDialog,
} from "@/components/clients/ClientMasterlistJobsDialog";
import {
  DashboardTablePagination,
  DASHBOARD_TABLE_PAGE_SIZE,
  paginateItems,
} from "@/components/dashboard/DashboardTablePagination";
import { dbDialogFooter, dbDialogFormControl, dbDialogFormField, dbDialogFormGrid, dbDialogWideForm, dbDialogWideFormBody, dbDialogWideFormFooter, dbDialogWideFormHeader, dbDialogWideFormStyle, dbHeaderActions, dbHeaderButton, dbMobileListCard, dbPageHeaderRow, dbPageWrapper, dbTableShellFit } from "@/lib/dashboard-ui";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { fetchPoMasterlistJobsForClients } from "@/lib/queries/fetchers";
import {
  summarizeClientMasterlistJobs,
  type ClientMasterlistJobSummary,
} from "@/lib/client-masterlist-job-stats";
import { cn } from "@/lib/utils";

interface Client {
  id: string;
  company_id: string | null;
  client_code: string | null;
  name: string;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  business_unit_sub_company: string | null;
  tin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClientsPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const {
    data: clients = [],
    isLoading: loading,
    isError,
    refresh,
  } = useClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [jobsByClient, setJobsByClient] = useState<
    Record<string, ClientMasterlistJobSummary[]>
  >({});
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsClient, setJobsClient] = useState<Client | null>(null);

  // Form state
  const [clientCode, setClientCode] = useState("");
  const [clientName, setClientName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [address, setAddress] = useState("");
  const [businessUnitSubCompany, setBusinessUnitSubCompany] = useState("");
  const [tin, setTin] = useState("");
  const [isActive, setIsActive] = useState(true);

  const loadClientJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const rows = (await fetchPoMasterlistJobsForClients()) as ClientMasterlistJobSummary[];
      const next: Record<string, ClientMasterlistJobSummary[]> = {};
      for (const row of rows) {
        if (!row.client_id) continue;
        const list = next[row.client_id] ?? [];
        list.push(row);
        next[row.client_id] = list;
      }
      setJobsByClient(next);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load client P.O. / jobs");
      setJobsByClient({});
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load clients");
    }
  }, [isError]);

  useEffect(() => {
    void loadClientJobs();
  }, [loadClientJobs]);

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setClientCode(client.client_code || "");
      setClientName(client.name);
      setContactPerson(client.contact_person || "");
      setContactEmail(client.contact_email || "");
      setContactPhone(client.contact_phone || "");
      setAddress(client.address || "");
      setBusinessUnitSubCompany(client.business_unit_sub_company || "");
      setTin(formatTinWithDashes(client.tin || ""));
      setIsActive(client.is_active);
    } else {
      setEditingClient(null);
      setClientCode("");
      setClientName("");
      setContactPerson("");
      setContactEmail("");
      setContactPhone("");
      setAddress("");
      setBusinessUnitSubCompany("");
      setTin("");
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingClient(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientCode.trim() || !clientName.trim()) {
      toast.error("Client code and name are required");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required");
      return;
    }
    if (!tin.trim()) {
      toast.error("TIN is required");
      return;
    }

    try {
      const payload = {
        client_code: clientCode.trim(),
        name: clientName.trim(),
        contact_person: contactPerson.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address: address.trim(),
        business_unit_sub_company: businessUnitSubCompany.trim() || null,
        tin: formatTinWithDashes(tin),
        is_active: isActive,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(payload)
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Client updated successfully");
      } else {
        const { error } = await supabase
          .from("clients")
          .insert(payload);

        if (error) throw error;
        toast.success("Client created successfully");
      }

      handleCloseDialog();
      await bustCache();
      await refresh({ force: true });
      await loadClientJobs();
    } catch (error: any) {
      toast.error(error.message || "Failed to save client");
      console.error(error);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!confirm(`Are you sure you want to delete ${client.name}?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("clients")
        .delete()
        .eq("id", client.id);

      if (error) throw error;
      toast.success("Client deleted successfully");
      await bustCache();
      await refresh({ force: true });
      await loadClientJobs();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete client");
      console.error(error);
    }
  };

  const filteredClients = useMemo(
    () =>
      clients.filter((client) => {
        if (statusFilter === "active" && !client.is_active) return false;
        if (statusFilter === "inactive" && client.is_active) return false;
        if (!searchTerm) return true;
        const search = searchTerm.toLowerCase();
        const clientJobs = jobsByClient[client.id] ?? [];
        const matchesJob = clientJobs.some(
          (job) =>
            job.po_number.toLowerCase().includes(search) ||
            (job.project_title || "").toLowerCase().includes(search)
        );
        return (
          matchesJob ||
          (client.client_code && client.client_code.toLowerCase().includes(search)) ||
          client.name.toLowerCase().includes(search) ||
          (client.contact_person && client.contact_person.toLowerCase().includes(search)) ||
          (client.contact_email && client.contact_email.toLowerCase().includes(search)) ||
          (client.business_unit_sub_company &&
            client.business_unit_sub_company.toLowerCase().includes(search))
        );
      }),
    [clients, searchTerm, statusFilter, jobsByClient]
  );

  const { pageItems: pagedClients, pageCount, safePage } = useMemo(
    () => paginateItems(filteredClients, page, DASHBOARD_TABLE_PAGE_SIZE),
    [filteredClients, page]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const canCreateClients = canCreate("clients");
  const canUpdateClients = canUpdate("clients");
  const canDeleteClients = canDelete("clients");

  if (profileLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("min-w-0 w-full", dbPageWrapper)}>
      <div className={dbPageHeaderRow}>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
          <PageSubtitle>
            Manage clients and browse their ADD-BELL P.O. / jobs from the masterlist.
          </PageSubtitle>
        </div>
        {canCreateClients ? (
          <div className={dbHeaderActions}>
            <Button onClick={() => handleOpenDialog()} className={dbHeaderButton}>
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Button>
          </div>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, contact, P.O., or project…"
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
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {jobsLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Loading P.O. / jobs…</p>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredClients.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? "No clients match your filters." : "No clients yet."}
            </div>
          ) : (
            <>
              <DbMobileBlock>
                <div className="space-y-2 p-3">
                  {pagedClients.map((client) => {
                    const stats = summarizeClientMasterlistJobs(
                      jobsByClient[client.id] ?? []
                    );
                    return (
                    <div key={client.id} className={dbMobileListCard}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{client.name}</p>
                          <p className="text-xs text-muted-foreground">{client.client_code || "—"}</p>
                        </div>
                        <Badge variant={client.is_active ? "default" : "secondary"} className="shrink-0">
                          {client.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1">
                        <DashboardMobileField
                          label="BU/Sub"
                          value={client.business_unit_sub_company || "—"}
                        />
                        <DashboardMobileField label="Contact person" value={client.contact_person || "—"} />
                        <DashboardMobileField
                          label="Active jobs"
                          value={jobsLoading ? "…" : String(stats.active)}
                        />
                        <DashboardMobileField
                          label="Completed"
                          value={jobsLoading ? "…" : String(stats.completed)}
                        />
                        <DashboardMobileField
                          label="Paid"
                          value={jobsLoading ? "…" : String(stats.paid)}
                        />
                        <DashboardMobileField
                          label="Total jobs"
                          value={jobsLoading ? "…" : String(stats.total)}
                        />
                      </div>
                      <div className="mt-3 flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setJobsClient(client)}
                          disabled={jobsLoading}
                        >
                          <ListOrdered className="mr-1 h-4 w-4" />
                          View jobs
                        </Button>
                        {canUpdateClients ? (
                          <Button variant="outline" size="sm" onClick={() => handleOpenDialog(client)}>
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        ) : null}
                        {canDeleteClients ? (
                          <Button variant="outline" size="sm" onClick={() => handleDelete(client)}>
                            <Trash2 className="mr-1 h-4 w-4" />
                            Delete
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    );
                  })}
                </div>
              </DbMobileBlock>
              <DbDesktopBlock className={dbTableShellFit}>
                <Table className="w-full table-fixed" containerClassName="overflow-x-hidden">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[10%]">Code</TableHead>
                      <TableHead className="w-[22%]">Client Name</TableHead>
                      <TableHead className="hidden w-[12%] 2xl:table-cell">BU/Sub</TableHead>
                      <TableHead className="w-[10%] text-right">Active</TableHead>
                      <TableHead className="w-[12%] text-right">Completed</TableHead>
                      <TableHead className="w-[10%] text-right">Paid</TableHead>
                      <TableHead className="hidden w-[8%] text-right xl:table-cell">Total</TableHead>
                      <TableHead className="w-[10%]">Status</TableHead>
                      <TableHead className="sticky right-0 z-20 w-[16%] bg-muted text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedClients.map((client) => {
                      const stats = summarizeClientMasterlistJobs(
                        jobsByClient[client.id] ?? []
                      );
                      return (
                      <TableRow key={client.id} className="group">
                        <TableCell
                          className="truncate font-medium"
                          title={client.client_code || undefined}
                        >
                          {client.client_code || "—"}
                        </TableCell>
                        <TableCell className="min-w-0 truncate" title={client.name}>
                          {client.name}
                        </TableCell>
                        <TableCell
                          className="hidden truncate 2xl:table-cell"
                          title={client.business_unit_sub_company || undefined}
                        >
                          {client.business_unit_sub_company || "—"}
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums"
                          title="ON-GOING + PENDING jobs"
                        >
                          {jobsLoading ? "…" : stats.active}
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums"
                          title="COMPLETED jobs"
                        >
                          {jobsLoading ? "…" : stats.completed}
                        </TableCell>
                        <TableCell
                          className="text-right tabular-nums"
                          title="PAID payment status"
                        >
                          {jobsLoading ? "…" : stats.paid}
                        </TableCell>
                        <TableCell className="hidden text-right tabular-nums text-muted-foreground xl:table-cell">
                          {jobsLoading ? "…" : stats.total}
                        </TableCell>
                        <TableCell>
                          <Badge variant={client.is_active ? "default" : "secondary"}>
                            {client.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="sticky right-0 z-10 bg-background text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)] group-hover:bg-muted/50">
                          <div className="flex justify-end gap-1 whitespace-nowrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => setJobsClient(client)}
                              disabled={jobsLoading}
                              aria-label={`View jobs for ${client.name}`}
                            >
                              <ListOrdered className="mr-1 h-4 w-4" />
                              Jobs
                            </Button>
                            {canUpdateClients ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOpenDialog(client)}
                                aria-label={`Edit ${client.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            ) : null}
                            {canDeleteClients ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleDelete(client)}
                                aria-label={`Delete ${client.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </DbDesktopBlock>
              <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                <DashboardTablePagination
                  page={safePage}
                  pageCount={pageCount}
                  total={filteredClients.length}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <ClientMasterlistJobsDialog
        open={Boolean(jobsClient)}
        onOpenChange={(open) => {
          if (!open) setJobsClient(null);
        }}
        clientName={jobsClient?.name ?? ""}
        jobs={jobsClient ? jobsByClient[jobsClient.id] ?? [] : []}
      />

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) handleCloseDialog();
          else setIsDialogOpen(true);
        }}
      >
        <DialogContent className={dbDialogWideForm} style={dbDialogWideFormStyle}>
          <DialogHeader className={dbDialogWideFormHeader}>
            <DialogTitle>
              {editingClient ? "Edit Client" : "Add Client"}
            </DialogTitle>
            <DialogDescription>
              {editingClient
                ? "Update client information"
                : "Add a new client to the system."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className={dbDialogWideFormBody}>
              <div className={dbDialogFormGrid}>
                <div className={dbDialogFormField}>
                  <Label htmlFor="client_code">Client Code *</Label>
                  <Input
                    id="client_code"
                    className={dbDialogFormControl}
                    value={clientCode}
                    onChange={(e) => setClientCode(e.target.value)}
                    required
                    disabled={!!editingClient}
                    placeholder="e.g. PUC, SMC"
                  />
                </div>
                <div className={cn(dbDialogFormField, "sm:col-span-2")}>
                  <Label htmlFor="client_name">Registered Name *</Label>
                  <Input
                    id="client_name"
                    className={dbDialogFormControl}
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Client name"
                    required
                  />
                </div>
                <div className={cn(dbDialogFormField, "sm:col-span-2")}>
                  <Label htmlFor="business_unit_sub_company">
                    Business Unit / Sub Company
                  </Label>
                  <Input
                    id="business_unit_sub_company"
                    className={dbDialogFormControl}
                    value={businessUnitSubCompany}
                    onChange={(e) => setBusinessUnitSubCompany(e.target.value)}
                    placeholder="Business unit or sub company"
                  />
                </div>
                <div className={dbDialogFormField}>
                  <Label htmlFor="tin">TIN *</Label>
                  <Input
                    id="tin"
                    className={dbDialogFormControl}
                    value={tin}
                    onChange={(e) => setTin(formatTinWithDashes(e.target.value))}
                    placeholder={TIN_PLACEHOLDER}
                    inputMode="numeric"
                    autoComplete="off"
                    required
                  />
                </div>
                <div className={cn(dbDialogFormField, "sm:col-span-2 lg:col-span-3")}>
                  <Label htmlFor="address">Business Address *</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Barangay, City, Province"
                    rows={3}
                    className="min-h-[5.5rem]"
                    required
                  />
                </div>
                <div className={dbDialogFormField}>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    className={dbDialogFormControl}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Primary contact person"
                  />
                </div>
                <div className={dbDialogFormField}>
                  <Label htmlFor="contact_email">Email</Label>
                  <Input
                    id="contact_email"
                    className={dbDialogFormControl}
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="client@example.com"
                  />
                </div>
                <div className={dbDialogFormField}>
                  <Label htmlFor="contact_phone">Phone</Label>
                  <Input
                    id="contact_phone"
                    className={dbDialogFormControl}
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                  />
                </div>
                <div className={cn(dbDialogFormField, "flex items-end")}>
                  <div className="flex min-h-10 items-center gap-2">
                    <Checkbox
                      id="client_status"
                      checked={isActive}
                      onCheckedChange={(checked) => setIsActive(checked === true)}
                    />
                    <Label htmlFor="client_status" className="font-normal">
                      Active
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className={cn(dbDialogWideFormFooter, dbDialogFooter)}>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit">
                {editingClient ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}