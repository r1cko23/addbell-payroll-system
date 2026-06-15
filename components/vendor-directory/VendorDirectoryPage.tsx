"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useVendors } from "@/lib/hooks/useVendors";
import { invalidateVendors } from "@/lib/queries/invalidate";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageSubtitle } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  canonicalizePhilippinePhoneDigits,
  formatPhilippinePhoneDisplay,
  getPhilippinePhoneLabel,
  isAcceptableVendorPhoneEntry,
  normalizePhoneEntryForStorage,
  normalizePhilippinePhone,
  primaryStoredPhone,
} from "@/lib/philippine-phone";

import {
  isValidEmailAddress,
  partitionVendorContactDisplay,
  recordMatchesContactSearch,
} from "@/lib/vendor-contacts";

type VendorDirectoryPageProps = {
  vendorType: VendorType;
};

function VendorPhoneList({ record }: { record: VendorRecord }) {
  const { phones } = partitionVendorContactDisplay(record);

  if (phones.length === 0) return <span>—</span>;

  return (
    <div className="space-y-0.5 text-sm">
      {phones.map((entry, index) => (
        <p key={`${canonicalizePhilippinePhoneDigits(entry)}-${index}`}>
          <span className="text-muted-foreground">{getPhilippinePhoneLabel(entry)}: </span>
          {formatPhilippinePhoneDisplay(entry)}
        </p>
      ))}
    </div>
  );
}

function VendorEmailList({ record }: { record: VendorRecord }) {
  const { emails } = partitionVendorContactDisplay(record);

  if (emails.length === 0) return <span>—</span>;

  return (
    <div className="space-y-0.5 text-sm">
      {emails.map((entry) => (
        <p key={entry}>{entry}</p>
      ))}
    </div>
  );
}

export function VendorDirectoryPage({ vendorType }: VendorDirectoryPageProps) {
  const config = VENDOR_DIRECTORY_CONFIG[vendorType];
  const { canCreate, canUpdate, canDelete } = usePermissions();
  const canCreateVendors = canCreate("vendors");
  const canUpdateVendors = canUpdate("vendors");
  const canDeleteVendors = canDelete("vendors");
  const canManageVendors =
    canCreateVendors || canUpdateVendors || canDeleteVendors;
  const supabase = createClient();
  const queryClient = useQueryClient();
  const {
    data: records = [],
    isLoading: loading,
    isError,
  } = useVendors(vendorType);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VendorRecord | null>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [tin, setTin] = useState("");
  const [address, setAddress] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const resetContactFields = () => {
    setPhones([]);
    setEmails([]);
  };

  const addPhone = () => setPhones((current) => [...current, ""]);
  const updatePhone = (index: number, value: string) => {
    setPhones((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index
          ? normalizePhilippinePhone(value).slice(0, 11)
          : entry
      )
    );
  };
  const removePhone = (index: number) => {
    setPhones((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  const addEmail = () => setEmails((current) => [...current, ""]);
  const updateEmail = (index: number, value: string) => {
    setEmails((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? value : entry
      )
    );
  };
  const removeEmail = (index: number) => {
    setEmails((current) => current.filter((_, entryIndex) => entryIndex !== index));
  };

  useEffect(() => {
    if (isError) {
      toast.error(config.loadError);
    }
  }, [config.loadError, isError]);

  const handleOpenDialog = (record?: VendorRecord) => {
    if (record) {
      setEditingRecord(record);
      setName(record.name);
      setContactPerson(record.contact_person || "");
      setTin(record.tin || "");
      setAddress(record.address || "");
      const { phones: existingPhones, emails: existingEmails } =
        partitionVendorContactDisplay(record);
      setPhones(existingPhones);
      setEmails(existingEmails);
      setIsActive(record.is_active);
    } else {
      setEditingRecord(null);
      setName("");
      setContactPerson("");
      setTin("");
      setAddress("");
      resetContactFields();
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
      toast.error("Business address is required.");
      return;
    }
    const normalizedPhones = phones
      .map((entry) => normalizePhoneEntryForStorage(entry))
      .filter(Boolean);
    const invalidPhone = normalizedPhones.find(
      (entry) => !isAcceptableVendorPhoneEntry(entry)
    );
    if (invalidPhone) {
      toast.error(
        "Each phone must be a valid Philippine mobile, landline, or international (+...) number."
      );
      return;
    }
    const normalizedEmails = emails
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const invalidEmail = normalizedEmails.find((entry) => !isValidEmailAddress(entry));
    if (invalidEmail) {
      toast.error("Enter a valid email address or remove the invalid email.");
      return;
    }

    try {
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        tin: tin.trim(),
        address: address.trim(),
        phones: normalizedPhones,
        emails: normalizedEmails,
        phone: primaryStoredPhone(normalizedPhones[0] ?? ""),
        email: normalizedEmails[0] ?? "",
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
      await invalidateVendors(queryClient);
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
      await invalidateVendors(queryClient);
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
      recordMatchesContactSearch(record.phones, record.phone, record.emails, record.email, s)
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
                            label="Phone"
                            value={
                              partitionVendorContactDisplay(record).phones
                                .map(
                                  (entry) =>
                                    `${getPhilippinePhoneLabel(entry)}: ${formatPhilippinePhoneDisplay(entry)}`
                                )
                                .join("\n") || "—"
                            }
                          />
                          <DashboardMobileField
                            label="Email"
                            value={
                              partitionVendorContactDisplay(record).emails.join("\n") || "—"
                            }
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
                  <Table className="w-full min-w-[900px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Registered Name</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>TIN</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Email</TableHead>
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
                            <VendorPhoneList record={record} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <VendorEmailList record={record} />
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
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
              <Label htmlFor="name">{config.nameLabel} *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={config.namePlaceholder}
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
              <Label>Phone</Label>
              {phones.length > 0 ? (
                <div className="space-y-2">
                  {phones.map((entry, index) => (
                    <div key={`phone-${index}`} className="flex gap-2">
                      <Input
                        value={entry}
                        onChange={(e) => updatePhone(index, e.target.value)}
                        placeholder="09XXXXXXXXX or 02XXXXXXXX"
                        inputMode="numeric"
                        maxLength={11}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removePhone(index)}
                        aria-label="Remove phone"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No phone added yet.</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addPhone}>
                <Plus className="mr-2 h-4 w-4" />
                Add phone
              </Button>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              {emails.length > 0 ? (
                <div className="space-y-2">
                  {emails.map((entry, index) => (
                    <div key={`email-${index}`} className="flex gap-2">
                      <Input
                        type="email"
                        value={entry}
                        onChange={(e) => updateEmail(index, e.target.value)}
                        placeholder="vendor@example.com"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeEmail(index)}
                        aria-label="Remove email"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No email added yet.</p>
              )}
              <Button type="button" variant="outline" size="sm" onClick={addEmail}>
                <Plus className="mr-2 h-4 w-4" />
                Add email
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="record_status"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
              />
              <Label htmlFor="record_status" className="font-normal">
                Active
              </Label>
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
