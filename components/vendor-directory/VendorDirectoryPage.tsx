"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageSubtitle } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  dbHeaderActions,
  dbHeaderButton,
  dbMobileListCard,
  dbPageHeaderRow,
  dbPageWrapper,
  dbTableShell,
} from "@/lib/dashboard-ui";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { cn } from "@/lib/utils";
import type { VendorType } from "@/types/vendor";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  VENDOR_DIRECTORY_CONFIG,
  type VendorRecord,
} from "@/components/vendor-directory/vendor-directory-config";

type VendorDirectoryPageProps = {
  vendorType: VendorType;
};

export function VendorDirectoryPage({ vendorType }: VendorDirectoryPageProps) {
  const config = VENDOR_DIRECTORY_CONFIG[vendorType];
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const canCreateVendors = canCreate("vendors");
  const canUpdateVendors = canUpdate("vendors");
  const canDeleteVendors = canDelete("vendors");
  const canManageVendors =
    canCreateVendors || canUpdateVendors || canDeleteVendors;
  const supabase = createClient();
  const [records, setRecords] = useState<VendorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VendorRecord | null>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [tin, setTin] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchRecords();
  }, [vendorType]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("vendors")
        .select("*")
        .eq("type", vendorType)
        .order("name", { ascending: true });

      if (error) throw error;
      setRecords(
        (data || []).map((record) => ({
          ...record,
          type: record.type === "subcontractor" ? "subcontractor" : "supplier",
        }))
      );
    } catch (error) {
      toast.error(config.loadError);
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (record?: VendorRecord) => {
    if (record) {
      setEditingRecord(record);
      setName(record.name);
      setContactPerson(record.contact_person || "");
      setTin(record.tin || "");
      setAddress(record.address || "");
      setPhone(record.phone || "");
      setEmail(record.email || "");
      setIsActive(record.is_active);
    } else {
      setEditingRecord(null);
      setName("");
      setContactPerson("");
      setTin("");
      setAddress("");
      setPhone("");
      setEmail("");
      setIsActive(true);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingRecord(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error(config.nameRequired);
      return;
    }
    if (!contactPerson.trim()) {
      toast.error("Contact person is required.");
      return;
    }
    if (!tin.trim()) {
      toast.error("TIN is required.");
      return;
    }
    if (!address.trim()) {
      toast.error("Address is required.");
      return;
    }
    if (!phone.trim()) {
      toast.error("Phone is required.");
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        tin: tin.trim(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim() || "",
        type: vendorType,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      };

      if (editingRecord) {
        const { error } = await supabase
          .from("vendors")
          .update(payload)
          .eq("id", editingRecord.id);

        if (error) throw error;
        toast.success(config.updateSuccess);
      } else {
        const { error } = await supabase.from("vendors").insert(payload);

        if (error) throw error;
        toast.success(config.createSuccess);
      }

      handleCloseDialog();
      fetchRecords();
    } catch (error: unknown) {
      toast.error((error as Error).message || config.saveError);
      console.error(error);
    }
  };

  const handleDelete = async (record: VendorRecord) => {
    if (!confirm(`Are you sure you want to delete ${record.name}?`)) return;

    try {
      const { error } = await supabase.from("vendors").delete().eq("id", record.id);

      if (error) throw error;
      toast.success(config.deleteSuccess);
      fetchRecords();
    } catch (error: unknown) {
      toast.error((error as Error).message || config.saveError);
      console.error(error);
    }
  };

  const filteredRecords = records.filter((record) => {
    if (statusFilter === "active" && !record.is_active) return false;
    if (statusFilter === "inactive" && record.is_active) return false;
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      record.name.toLowerCase().includes(s) ||
      (record.contact_person && record.contact_person.toLowerCase().includes(s)) ||
      (record.tin && record.tin.includes(s)) ||
      (record.email && record.email.toLowerCase().includes(s))
    );
  });

  return (
    <DashboardLayout>
      <div className={cn("min-w-0 w-full", dbPageWrapper)}>
        <div className={dbPageHeaderRow}>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{config.title}</h1>
            <PageSubtitle>{config.subtitle}</PageSubtitle>
          </div>
          <div className={dbHeaderActions}>
            {canCreateVendors ? (
            <Button onClick={() => handleOpenDialog()} className={dbHeaderButton}>
              <Plus className="mr-2 h-4 w-4" />
              {config.addButtonLabel}
            </Button>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, contact, TIN, or email..."
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
          <CardContent>
            {loading ? (
              <div className="py-12 text-center text-muted-foreground">Loading...</div>
            ) : filteredRecords.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                {searchTerm || statusFilter !== "all"
                  ? "No records match your filters."
                  : config.emptyState}
              </div>
            ) : (
              <>
                <DbMobileBlock>
                  <div className="space-y-2">
                    {filteredRecords.map((record) => (
                      <div key={record.id} className={dbMobileListCard}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 truncate text-sm font-medium">{record.name}</p>
                          <Badge
                            variant={record.is_active ? "default" : "secondary"}
                            className="shrink-0"
                          >
                            {record.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          <DashboardMobileField
                            label="Contact"
                            value={record.contact_person || "—"}
                          />
                          <DashboardMobileField label="TIN" value={record.tin || "—"} />
                          <DashboardMobileField
                            label="Phone / email"
                            value={record.phone || record.email || "—"}
                          />
                        </div>
                        {canManageVendors ? (
                        <div className="mt-3 flex justify-end gap-2">
                          {canUpdateVendors ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDialog(record)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          ) : null}
                          {canDeleteVendors ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(record)}
                          >
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
                  <Table className="w-full min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>TIN</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        {canManageVendors ? (
                        <TableHead className="w-24">Actions</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.name}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.contact_person || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.tin || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {record.phone || record.email || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={record.is_active ? "default" : "secondary"}>
                              {record.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          {canManageVendors ? (
                          <TableCell>
                            <div className="flex gap-2">
                              {canUpdateVendors ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenDialog(record)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              ) : null}
                              {canDeleteVendors ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(record)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                              ) : null}
                            </div>
                          </TableCell>
                          ) : null}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingRecord ? config.dialogEditTitle : config.dialogAddTitle}
            </DialogTitle>
            {(editingRecord ? config.dialogEditDescription : config.dialogAddDescription) ? (
              <DialogDescription>
                {editingRecord
                  ? config.dialogEditDescription
                  : config.dialogAddDescription}
              </DialogDescription>
            ) : null}
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={config.namePlaceholder}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_person">Contact Person *</Label>
              <Input
                id="contact_person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="Primary contact person"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tin">TIN *</Label>
              <Input
                id="tin"
                value={tin}
                onChange={(e) => setTin(e.target.value)}
                placeholder="000 000 000 000000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Textarea
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Street, Barangay, City, Province"
                rows={2}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Phone number"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vendor@example.com"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="record_status">Status</Label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(value) => setIsActive(value === "active")}
              >
                <SelectTrigger id="record_status">
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
              <Button type="submit">{editingRecord ? "Update" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
