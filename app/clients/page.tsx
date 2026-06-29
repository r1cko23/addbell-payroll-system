"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useClients } from "@/lib/hooks/useClients";
import { invalidateClients, invalidateProjects } from "@/lib/queries/invalidate";
import { formatTinWithDashes, TIN_PLACEHOLDER } from "@/lib/tin-format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { dbDialogContent, dbDialogFooter, dbHeaderActions, dbHeaderButton, dbMobileListCard, dbPageHeaderRow, dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
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
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const {
    data: clients = [],
    isLoading: loading,
    isError,
  } = useClients();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

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

  useEffect(() => {
    if (isError) {
      toast.error("Failed to load clients");
    }
  }, [isError]);

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
      await Promise.all([
        invalidateClients(queryClient),
        invalidateProjects(queryClient),
      ]);
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
      await Promise.all([
        invalidateClients(queryClient),
        invalidateProjects(queryClient),
      ]);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete client");
      console.error(error);
    }
  };

  const filteredClients = clients.filter((client) => {
    if (statusFilter === "active" && !client.is_active) return false;
    if (statusFilter === "inactive" && client.is_active) return false;
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      (client.client_code && client.client_code.toLowerCase().includes(search)) ||
      client.name.toLowerCase().includes(search) ||
      (client.contact_person && client.contact_person.toLowerCase().includes(search)) ||
      (client.contact_email && client.contact_email.toLowerCase().includes(search)) ||
      (client.business_unit_sub_company &&
        client.business_unit_sub_company.toLowerCase().includes(search))
    );
  });

  const canCreateClients = canCreate("clients");
  const canUpdateClients = canUpdate("clients");
  const canDeleteClients = canDelete("clients");
  const canManageClients =
    canCreateClients || canUpdateClients || canDeleteClients;

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
            Manage clients and their information.
          </PageSubtitle>
        </div>
        {canCreateClients && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <div className={dbHeaderActions}>
                <Button onClick={() => handleOpenDialog()} className={dbHeaderButton}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Client
                </Button>
              </div>
            </DialogTrigger>
            <DialogContent className={cn(dbDialogContent, "max-w-2xl")}>
              <DialogHeader>
                <DialogTitle>
                  {editingClient ? "Edit Client" : "Add Client"}
                </DialogTitle>
                <DialogDescription>
                  {editingClient
                    ? "Update client information"
                    : "Add a new client to the system."}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="client_code">Client Code *</Label>
                    <Input
                      id="client_code"
                      value={clientCode}
                      onChange={(e) => setClientCode(e.target.value)}
                      required
                      disabled={!!editingClient}
                      placeholder="e.g. PUC, SMC"
                    />
                  </div>
                  <div>
                    <Label htmlFor="client_name">Registered Name *</Label>
                    <Input
                      id="client_name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Client name"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="business_unit_sub_company">Business Unit / Sub Company</Label>
                  <Input
                    id="business_unit_sub_company"
                    value={businessUnitSubCompany}
                    onChange={(e) => setBusinessUnitSubCompany(e.target.value)}
                    placeholder="Business unit or sub company"
                  />
                </div>
                <div>
                  <Label htmlFor="address">Business Address *</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Barangay, City, Province"
                    rows={2}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="tin">TIN *</Label>
                  <Input
                    id="tin"
                    value={tin}
                    onChange={(e) => setTin(formatTinWithDashes(e.target.value))}
                    placeholder={TIN_PLACEHOLDER}
                    inputMode="numeric"
                    autoComplete="off"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Primary contact person"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="contact_email">Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="client@example.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Phone number"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="client_status"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  <Label htmlFor="client_status" className="font-normal">
                    Active
                  </Label>
                </div>
                <DialogFooter className={dbDialogFooter}>
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
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by code, name, contact, or email..."
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
                  {filteredClients.map((client) => (
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
                        <DashboardMobileField label="email" value={client.contact_email || "—"} />
                        <DashboardMobileField label="phone" value={client.contact_phone || "—"} />
                      </div>
                      {canManageClients ? (
                        <div className="mt-3 flex justify-end gap-2">
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
                      ) : null}
                    </div>
                  ))}
                </div>
              </DbMobileBlock>
              <DbDesktopBlock className={dbTableShell}>
                <Table className="w-full min-w-[960px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead>BU/Sub</TableHead>
                      <TableHead>Contact person</TableHead>
                      <TableHead>email</TableHead>
                      <TableHead>phone</TableHead>
                      <TableHead>Status</TableHead>
                      {canManageClients && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.client_code || "—"}</TableCell>
                        <TableCell>{client.name}</TableCell>
                        <TableCell>{client.business_unit_sub_company || "—"}</TableCell>
                        <TableCell>{client.contact_person || "—"}</TableCell>
                        <TableCell>{client.contact_email || "—"}</TableCell>
                        <TableCell>{client.contact_phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={client.is_active ? "default" : "secondary"}>
                            {client.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        {canManageClients && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {canUpdateClients ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(client)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              ) : null}
                              {canDeleteClients ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(client)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              ) : null}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DbDesktopBlock>
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}