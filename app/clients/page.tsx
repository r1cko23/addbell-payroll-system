"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSubtitle } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { usePermissions } from "@/lib/hooks/usePermissions";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { dbHeaderActions, dbHeaderButton, dbMobileListCard, dbPageHeaderRow, dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
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
  tin: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ClientsPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [tin, setTin] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchClients();
  }, [supabase]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setClients(data || []);
    } catch (error) {
      toast.error("Failed to load clients");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setClientCode(client.client_code || "");
      setClientName(client.name);
      setContactPerson(client.contact_person || "");
      setContactEmail(client.contact_email || "");
      setContactPhone(client.contact_phone || "");
      setAddress(client.address || "");
      setTin(client.tin || "");
      setIsActive(client.is_active);
    } else {
      setEditingClient(null);
      setClientCode("");
      setClientName("");
      setContactPerson("");
      setContactEmail("");
      setContactPhone("");
      setAddress("");
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

    try {
      const payload = {
        client_code: clientCode.trim(),
        name: clientName.trim(),
        contact_person: contactPerson.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
        address: address.trim() || null,
        tin: tin.trim() || null,
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
      fetchClients();
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
      fetchClients();
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
      (client.contact_email && client.contact_email.toLowerCase().includes(search))
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
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="client_name">Client Name *</Label>
                    <Input
                      id="client_name"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Street, Barangay, City, Province"
                  />
                </div>
                <div>
                  <Label htmlFor="tin">TIN No.</Label>
                  <Input
                    id="tin"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="000 000 000 000000"
                  />
                </div>
                <div>
                  <Label htmlFor="contact_person">Primary Contact Person</Label>
                  <Input
                    id="contact_person"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_email">Email</Label>
                    <Input
                      id="contact_email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="contact_phone">Phone</Label>
                    <Input
                      id="contact_phone"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client_status">Status</Label>
                  <Select
                    value={isActive ? "active" : "inactive"}
                    onValueChange={(value) => setIsActive(value === "active")}
                  >
                    <SelectTrigger id="client_status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <DialogFooter>
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full flex-1 min-w-0 sm:min-w-[200px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
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
                        <DashboardMobileField label="Primary Contact" value={client.contact_person || "—"} />
                        <DashboardMobileField label="Email" value={client.contact_email || "—"} />
                        <DashboardMobileField label="Phone" value={client.contact_phone || "—"} />
                        <DashboardMobileField
                          label="Created"
                          value={format(new Date(client.created_at), "MMM d, yyyy")}
                        />
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
                <Table className="w-full min-w-[860px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Client Name</TableHead>
                      <TableHead>Primary Contact Person</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      {canManageClients && <TableHead className="text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">{client.client_code || "—"}</TableCell>
                        <TableCell>{client.name}</TableCell>
                        <TableCell>{client.contact_person || "—"}</TableCell>
                        <TableCell>{client.contact_email || "—"}</TableCell>
                        <TableCell>{client.contact_phone || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={client.is_active ? "default" : "secondary"}>
                            {client.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(client.created_at), "MMM d, yyyy")}
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