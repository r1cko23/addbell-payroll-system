"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVendors } from "@/lib/hooks/useVendors";
import { bustCache } from "@/lib/cache-client";
import { formatTinWithDashes, stripTinDigits } from "@/lib/tin-format";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PageSubtitle } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { VendorFormDialog } from "@/components/vendor-directory/VendorFormDialog";
import {
  canonicalizePhilippinePhoneDigits,
  formatPhilippinePhoneDisplay,
  getPhilippinePhoneLabel,
} from "@/lib/philippine-phone";

import {
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
  const {
    data: records = [],
    isLoading: loading,
    isError,
    refresh,
  } = useVendors(vendorType);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VendorRecord | null>(null);

  useEffect(() => {
    if (isError) {
      toast.error(config.loadError);
    }
  }, [config.loadError, isError]);

  const handleOpenDialog = (record?: VendorRecord) => {
    setEditingRecord(record ?? null);
    setIsDialogOpen(true);
  };

  const handleDialogOpenChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) setEditingRecord(null);
  };

  const handleDelete = async (record: VendorRecord) => {
    if (!confirm(`Are you sure you want to delete ${record.name}?`)) return;

    try {
      const { error } = await supabase.from("vendors").delete().eq("id", record.id);

      if (error) throw error;
      toast.success(config.deleteSuccess);
      await bustCache();
      await refresh({ force: true });
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
    const sDigits = stripTinDigits(searchTerm);
    return (
      record.name.toLowerCase().includes(s) ||
      (record.contact_person && record.contact_person.toLowerCase().includes(s)) ||
      (record.account_name && record.account_name.toLowerCase().includes(s)) ||
      (record.tin &&
        (record.tin.toLowerCase().includes(s) ||
          (sDigits.length > 0 && stripTinDigits(record.tin).includes(sDigits)))) ||
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
                  placeholder="Search by name, contact, TIN, account name, or email..."
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
                          <DashboardMobileField
                            label="TIN"
                            value={formatTinWithDashes(record.tin || "") || "—"}
                          />
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
                          {vendorType === "subcontractor" ? (
                            <DashboardMobileField
                              label="Account Name"
                              value={record.account_name?.trim() || "—"}
                            />
                          ) : null}
                        </div>
                        {canManageVendors ? (
                        <div className="mt-3 flex justify-end gap-2">
                          {canUpdateVendors ? (
                          <Button
                            variant="outline"
                            className={dbHeaderButton}
                            onClick={() => handleOpenDialog(record)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                          ) : null}
                          {canDeleteVendors ? (
                          <Button
                            variant="outline"
                            className={dbHeaderButton}
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
                        {vendorType === "subcontractor" ? (
                          <TableHead>Account Name</TableHead>
                        ) : null}
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
                            {formatTinWithDashes(record.tin || "") || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <VendorPhoneList record={record} />
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <VendorEmailList record={record} />
                          </TableCell>
                          {vendorType === "subcontractor" ? (
                            <TableCell className="text-muted-foreground">
                              {record.account_name?.trim() || "—"}
                            </TableCell>
                          ) : null}
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

      <VendorFormDialog
        vendorType={vendorType}
        open={isDialogOpen}
        onOpenChange={handleDialogOpenChange}
        editingRecord={editingRecord}
        onSaved={async () => {
          await refresh({ force: true });
        }}
      />
    </DashboardLayout>
  );
}
