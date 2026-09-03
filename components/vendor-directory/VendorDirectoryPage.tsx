"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useVendors } from "@/lib/hooks/useVendors";
import { bustCache } from "@/lib/cache-client";
import { formatTinWithDashes, stripTinDigits, TIN_PLACEHOLDER } from "@/lib/tin-format";
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
import { Plus, Pencil, Trash2, Search, ListOrdered } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  DashboardTablePagination,
  DASHBOARD_TABLE_PAGE_SIZE,
  paginateItems,
} from "@/components/dashboard/DashboardTablePagination";
import {
  dbDialogWideForm,
  dbDialogWideFormBody,
  dbDialogWideFormFooter,
  dbDialogWideFormHeader,
  dbDialogWideFormStyle,
  dbDialogFormControl,
  dbDialogFormField,
  dbDialogFormGrid,
  dbDialogFooter,
  dbHeaderActions,
  dbHeaderButton,
  dbMobileListCard,
  dbPageHeaderRow,
  dbPageWrapper,
  dbTableShellFit,
} from "@/lib/dashboard-ui";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { SubcontractorJobsDialog } from "@/components/vendor-directory/SubcontractorJobsDialog";
import { cn } from "@/lib/utils";
import type { VendorType } from "@/types/vendor";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { normalizeUserRole } from "@/lib/user-roles";
import {
  VENDOR_DIRECTORY_CONFIG,
  type VendorRecord,
} from "@/components/vendor-directory/vendor-directory-config";
import {
  emptySubcontractorWorkload,
  summarizeSubcontractorWorkload,
  type SubcontractorJobRow,
  type SubcontractorWorkloadStats,
} from "@/lib/subcontractor-workload";
import {
  canonicalizePhilippinePhoneDigits,
  formatPhilippinePhoneDisplay,
  getPhilippinePhoneLabel,
  isAcceptableVendorPhoneEntry,
  normalizePhoneEntryForStorage,
  formatPhilippinePhoneForInput,
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
  const { role, loading: roleLoading } = useUserRole();
  const normalizedRole = normalizeUserRole(role);
  // Temporary role split until ABAC owns page views/functions.
  // Project managers (operations_manager) + admin/UM: workload/jobs.
  // Purchasing officer: directory columns (TIN / phone / email / account).
  const showSubcontractorWorkload =
    vendorType === "subcontractor" && normalizedRole !== "purchasing_officer";
  const pageSubtitle =
    vendorType === "subcontractor" && !showSubcontractorWorkload
      ? config.purchasingSubtitle || config.subtitle
      : config.subtitle;
  const canCreateVendors = canCreate("vendors");
  const canUpdateVendors = canUpdate("vendors");
  const canDeleteVendors = canDelete("vendors");
  const supabase = createClient();
  const {
    data: records = [],
    isLoading: loading,
    isError,
    refresh,
  } = useVendors(vendorType);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<VendorRecord | null>(null);

  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [tin, setTin] = useState("");
  const [address, setAddress] = useState("");
  const [phones, setPhones] = useState<string[]>([]);
  const [emails, setEmails] = useState<string[]>([]);
  const [accountName, setAccountName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workloadByVendor, setWorkloadByVendor] = useState<
    Record<string, SubcontractorWorkloadStats>
  >({});
  const [workloadLoading, setWorkloadLoading] = useState(false);
  const [jobsRecord, setJobsRecord] = useState<VendorRecord | null>(null);

  const resetContactFields = () => {
    setPhones([]);
    setEmails([]);
  };

  const addPhone = () => setPhones((current) => [...current, ""]);
  const updatePhone = (index: number, value: string) => {
    setPhones((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? formatPhilippinePhoneForInput(value) : entry
      )
    );
  };
  const handlePhonePaste = (
    index: number,
    event: React.ClipboardEvent<HTMLInputElement>
  ) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    if (pasted) updatePhone(index, pasted);
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

  const vendorIdsKey = records.map((record) => record.id).join(",");

  useEffect(() => {
    // Suppliers never load PO/project workload.
    // Purchasing officers use the directory view only (ABAC later).
    if (!showSubcontractorWorkload) {
      setWorkloadByVendor({});
      setWorkloadLoading(false);
      return;
    }

    if (records.length === 0) {
      setWorkloadByVendor((prev) =>
        Object.keys(prev).length === 0 ? prev : {}
      );
      return;
    }

    let cancelled = false;
    const vendorIds = vendorIdsKey.split(",").filter(Boolean);

    void (async () => {
      setWorkloadLoading(true);
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          "id, vendor_id, po_number, status, project_title, po_masterlist_job_id, po_masterlist_jobs ( id, project_title, project_status )"
        )
        .in("vendor_id", vendorIds);

      if (cancelled) return;

      if (error || !data) {
        console.error(error);
        setWorkloadByVendor({});
        setWorkloadLoading(false);
        return;
      }

      const jobsByVendor: Record<string, SubcontractorJobRow[]> = {};
      for (const row of data as Array<{
        id: string;
        vendor_id: string;
        po_number: string;
        status: string | null;
        project_title: string | null;
        po_masterlist_job_id: string | null;
        po_masterlist_jobs:
          | {
              id: string;
              project_title: string | null;
              project_status: string | null;
            }
          | {
              id: string;
              project_title: string | null;
              project_status: string | null;
            }[]
          | null;
      }>) {
        const jobJoin = Array.isArray(row.po_masterlist_jobs)
          ? row.po_masterlist_jobs[0]
          : row.po_masterlist_jobs;
        const job: SubcontractorJobRow = {
          poId: row.id,
          vendorId: row.vendor_id,
          poNumber: row.po_number,
          // Detail route is now /projects/{masterlistJobId}
          projectId: jobJoin?.id ?? row.po_masterlist_job_id,
          projectName: jobJoin?.project_title || row.project_title || "",
          projectStatus: jobJoin?.project_status ?? null,
          poStatus: row.status,
        };
        const list = jobsByVendor[row.vendor_id] ?? [];
        list.push(job);
        jobsByVendor[row.vendor_id] = list;
      }

      const next: Record<string, SubcontractorWorkloadStats> = {};
      for (const vendorId of vendorIds) {
        next[vendorId] = summarizeSubcontractorWorkload(
          jobsByVendor[vendorId] ?? []
        );
      }

      if (!cancelled) {
        setWorkloadByVendor(next);
        setWorkloadLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [vendorIdsKey, supabase, showSubcontractorWorkload, records.length]);

  const handleOpenDialog = (record?: VendorRecord) => {
    if (record) {
      setEditingRecord(record);
      setName(record.name);
      setContactPerson(record.contact_person || "");
      setTin(formatTinWithDashes(record.tin || ""));
      setAddress(record.address || "");
      const { phones: existingPhones, emails: existingEmails } =
        partitionVendorContactDisplay(record);
      setPhones(existingPhones);
      setEmails(existingEmails);
      setAccountName(record.account_name?.trim() ?? "");
      setIsActive(record.is_active);
    } else {
      setEditingRecord(null);
      setName("");
      setContactPerson("");
      setTin("");
      setAddress("");
      resetContactFields();
      setAccountName("");
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
    if (saving) return;

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
      setSaving(true);
      const payload = {
        name: name.trim(),
        contact_person: contactPerson.trim(),
        tin: formatTinWithDashes(tin),
        address: address.trim(),
        phones: normalizedPhones,
        emails: normalizedEmails,
        phone: primaryStoredPhone(normalizedPhones[0] ?? ""),
        email: normalizedEmails[0] ?? "",
        ...(vendorType === "subcontractor"
          ? { account_name: accountName.trim() || null }
          : {}),
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
      await bustCache();
      await refresh({ force: true });
    } catch (error: unknown) {
      const message = (error as Error).message || config.saveError;
      if (message.includes("account_name")) {
        toast.error(
          "Account name column is missing. Run the vendors account_name migration in Supabase, then try again."
        );
      } else {
        toast.error(message);
      }
      console.error(error);
    } finally {
      setSaving(false);
    }
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

  const filteredRecords = useMemo(() => {
    const filtered = records.filter((record) => {
      if (statusFilter === "active" && !record.is_active) return false;
      if (statusFilter === "inactive" && record.is_active) return false;
      if (!searchTerm) return true;
      const s = searchTerm.toLowerCase();
      const sDigits = stripTinDigits(searchTerm);
      const workload = showSubcontractorWorkload
        ? workloadByVendor[record.id]
        : undefined;
      return (
        record.name.toLowerCase().includes(s) ||
        (record.contact_person && record.contact_person.toLowerCase().includes(s)) ||
        (record.account_name && record.account_name.toLowerCase().includes(s)) ||
        (record.tin &&
          (record.tin.toLowerCase().includes(s) ||
            (sDigits.length > 0 && stripTinDigits(record.tin).includes(sDigits)))) ||
        recordMatchesContactSearch(record.phones, record.phone, record.emails, record.email, s) ||
        (workload?.jobs.some(
          (job) =>
            job.poNumber.toLowerCase().includes(s) ||
            job.projectName.toLowerCase().includes(s)
        ) ??
          false)
      );
    });

    if (!showSubcontractorWorkload) return filtered;

    // Busiest subcontractors first — helps award decisions (PM view).
    return [...filtered].sort((a, b) => {
      const activeA = workloadByVendor[a.id]?.active ?? 0;
      const activeB = workloadByVendor[b.id]?.active ?? 0;
      if (activeB !== activeA) return activeB - activeA;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [
    records,
    searchTerm,
    statusFilter,
    workloadByVendor,
    showSubcontractorWorkload,
  ]);

  const { pageItems: pagedRecords, pageCount, safePage } = useMemo(
    () => paginateItems(filteredRecords, page, DASHBOARD_TABLE_PAGE_SIZE),
    [filteredRecords, page]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, vendorType]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  return (
    <DashboardLayout>
      <div className={cn("min-w-0 w-full", dbPageWrapper)}>
        <div className={dbPageHeaderRow}>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">{config.title}</h1>
            <PageSubtitle>{pageSubtitle}</PageSubtitle>
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
                  placeholder={
                    showSubcontractorWorkload
                      ? "Search by name, contact, TIN, account name, project, or P.O...."
                      : "Search by name, contact, TIN, account name, or email..."
                  }
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
            {loading || (vendorType === "subcontractor" && roleLoading) ? (
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
                    {pagedRecords.map((record) => {
                      const workload =
                        workloadByVendor[record.id] ?? emptySubcontractorWorkload();
                      return (
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
                          {showSubcontractorWorkload ? (
                            <>
                            <DashboardMobileField
                              label="Active jobs"
                              value={workloadLoading ? "…" : String(workload.active)}
                            />
                            <DashboardMobileField
                              label="Completed"
                              value={workloadLoading ? "…" : String(workload.completed)}
                            />
                            <DashboardMobileField
                              label="Total jobs"
                              value={workloadLoading ? "…" : String(workload.total)}
                            />
                            </>
                          ) : (
                            <>
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
                              label="Account name"
                              value={record.account_name?.trim() || "—"}
                            />
                          ) : null}
                            </>
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          {showSubcontractorWorkload ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setJobsRecord(record)}
                              disabled={workloadLoading}
                            >
                              <ListOrdered className="mr-1 h-4 w-4" />
                              View jobs
                            </Button>
                          ) : null}
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
                      </div>
                      );
                    })}
                  </div>
                </DbMobileBlock>
                <DbDesktopBlock className={dbTableShellFit}>
                  <Table className="w-full table-fixed" containerClassName="overflow-x-hidden">
                    <TableHeader>
                      <TableRow>
                        <TableHead
                          className={
                            showSubcontractorWorkload ? "w-[28%]" : "w-[18%]"
                          }
                        >
                          Registered Name
                        </TableHead>
                        <TableHead className="w-[14%]">
                          {showSubcontractorWorkload ? "Contact" : "Contact Person"}
                        </TableHead>
                        {showSubcontractorWorkload ? (
                          <>
                          <TableHead className="w-[10%] text-right" title="active, pending, on hold">
                            Active
                          </TableHead>
                          <TableHead className="w-[12%] text-right">Completed</TableHead>
                          <TableHead className="hidden w-[10%] text-right xl:table-cell">
                            Total
                          </TableHead>
                          </>
                        ) : (
                          <>
                        <TableHead className="hidden w-[12%] xl:table-cell">TIN</TableHead>
                        <TableHead className="hidden w-[12%] 2xl:table-cell">Phone</TableHead>
                        <TableHead className="hidden w-[12%] 2xl:table-cell">Email</TableHead>
                        {vendorType === "subcontractor" ? (
                          <TableHead className="hidden w-[14%] lg:table-cell">
                            Account Name
                          </TableHead>
                        ) : null}
                          </>
                        )}
                        <TableHead className="w-[10%]">Status</TableHead>
                        <TableHead className="sticky right-0 z-20 w-[16%] bg-muted text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedRecords.map((record) => {
                        const workload =
                          workloadByVendor[record.id] ?? emptySubcontractorWorkload();
                        return (
                        <TableRow key={record.id} className="group">
                          <TableCell
                            className="min-w-0 truncate font-medium"
                            title={record.name}
                          >
                            {record.name}
                          </TableCell>
                          <TableCell
                            className="truncate text-muted-foreground"
                            title={record.contact_person || undefined}
                          >
                            {record.contact_person || "—"}
                          </TableCell>
                          {showSubcontractorWorkload ? (
                            <>
                            <TableCell
                              className="text-right text-base font-semibold tabular-nums"
                              title="Jobs still open (active / pending / on hold)"
                            >
                              {workloadLoading ? "…" : workload.active}
                            </TableCell>
                            <TableCell
                              className="text-right tabular-nums text-muted-foreground"
                              title="Completed projects"
                            >
                              {workloadLoading ? "…" : workload.completed}
                            </TableCell>
                            <TableCell className="hidden text-right tabular-nums text-muted-foreground xl:table-cell">
                              {workloadLoading ? "…" : workload.total}
                            </TableCell>
                            </>
                          ) : (
                            <>
                          <TableCell
                            className="hidden truncate text-muted-foreground xl:table-cell"
                            title={formatTinWithDashes(record.tin || "") || undefined}
                          >
                            {formatTinWithDashes(record.tin || "") || "—"}
                          </TableCell>
                          <TableCell className="hidden min-w-0 text-muted-foreground 2xl:table-cell">
                            <div className="truncate">
                              <VendorPhoneList record={record} />
                            </div>
                          </TableCell>
                          <TableCell className="hidden min-w-0 text-muted-foreground 2xl:table-cell">
                            <div className="truncate">
                              <VendorEmailList record={record} />
                            </div>
                          </TableCell>
                          {vendorType === "subcontractor" ? (
                            <TableCell
                              className="hidden truncate text-muted-foreground lg:table-cell"
                              title={record.account_name || undefined}
                            >
                              {record.account_name?.trim() || "—"}
                            </TableCell>
                          ) : null}
                            </>
                          )}
                          <TableCell>
                            <Badge variant={record.is_active ? "default" : "secondary"}>
                              {record.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell className="sticky right-0 z-10 bg-background text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)] group-hover:bg-muted/50">
                            <div className="flex justify-end gap-1 whitespace-nowrap">
                              {showSubcontractorWorkload ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 px-2"
                                  onClick={() => setJobsRecord(record)}
                                  disabled={workloadLoading}
                                  aria-label={`View jobs for ${record.name}`}
                                >
                                  <ListOrdered className="mr-1 h-4 w-4" />
                                  Jobs
                                </Button>
                              ) : null}
                              {canUpdateVendors ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleOpenDialog(record)}
                                aria-label={`Edit ${record.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              ) : null}
                              {canDeleteVendors ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => handleDelete(record)}
                                aria-label={`Delete ${record.name}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
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
                <DashboardTablePagination
                  page={safePage}
                  pageCount={pageCount}
                  total={filteredRecords.length}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {showSubcontractorWorkload ? (
        <SubcontractorJobsDialog
          open={Boolean(jobsRecord)}
          onOpenChange={(open) => {
            if (!open) setJobsRecord(null);
          }}
          subcontractorName={jobsRecord?.name ?? ""}
          workload={
            jobsRecord
              ? workloadByVendor[jobsRecord.id] ?? emptySubcontractorWorkload()
              : emptySubcontractorWorkload()
          }
        />
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={dbDialogWideForm} style={dbDialogWideFormStyle}>
          <DialogHeader className={dbDialogWideFormHeader}>
            <DialogTitle>
              {editingRecord ? config.dialogEditTitle : config.dialogAddTitle}
            </DialogTitle>
            <DialogDescription>
              {editingRecord
                ? config.dialogEditDescription
                : config.dialogAddDescription}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className={dbDialogWideFormBody}>
              <div className={dbDialogFormGrid}>
                <div className={cn(dbDialogFormField, "sm:col-span-2 lg:col-span-3")}>
                  <Label htmlFor="name">{config.nameLabel} *</Label>
                  <Input
                    id="name"
                    className={dbDialogFormControl}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={config.namePlaceholder}
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
                <div className={cn(dbDialogFormField, "sm:col-span-2")}>
                  <Label htmlFor="contact_person">Contact Person *</Label>
                  <Input
                    id="contact_person"
                    className={dbDialogFormControl}
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Primary contact person"
                    required
                  />
                </div>
                {vendorType === "subcontractor" ? (
                  <div className={cn(dbDialogFormField, "sm:col-span-2 lg:col-span-3")}>
                    <Label htmlFor="account_name">Account Name</Label>
                    <Input
                      id="account_name"
                      className={dbDialogFormControl}
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="Bank account name for payments"
                    />
                  </div>
                ) : null}
                <div className={cn(dbDialogFormField, "sm:col-span-2 lg:col-span-3")}>
                  <div className="grid grid-cols-1 gap-x-5 gap-y-5 lg:grid-cols-2">
                    <div>
                      <Label>Phone</Label>
                      {phones.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {phones.map((entry, index) => (
                            <div key={`phone-${index}`} className="flex gap-2">
                              <Input
                                className={dbDialogFormControl}
                                value={entry}
                                onChange={(e) => updatePhone(index, e.target.value)}
                                onPaste={(e) => handlePhonePaste(index, e)}
                                placeholder="09XXXXXXXXX or 02XXXXXXXX"
                                inputMode="tel"
                                autoComplete="tel"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => removePhone(index)}
                                aria-label="Remove phone"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No phone added yet.
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(dbHeaderButton, "mt-3")}
                        onClick={addPhone}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add phone
                      </Button>
                    </div>
                    <div>
                      <Label>Email</Label>
                      {emails.length > 0 ? (
                        <div className="mt-2 space-y-2">
                          {emails.map((entry, index) => (
                            <div key={`email-${index}`} className="flex gap-2">
                              <Input
                                className={dbDialogFormControl}
                                type="email"
                                value={entry}
                                onChange={(e) => updateEmail(index, e.target.value)}
                                placeholder="vendor@example.com"
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => removeEmail(index)}
                                aria-label="Remove email"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">
                          No email added yet.
                        </p>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(dbHeaderButton, "mt-3")}
                        onClick={addEmail}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add email
                      </Button>
                    </div>
                  </div>
                </div>
                <div className={cn(dbDialogFormField, "flex items-end")}>
                  <div className="flex min-h-10 items-center gap-2">
                    <Checkbox
                      id="record_status"
                      checked={isActive}
                      onCheckedChange={(checked) => setIsActive(checked === true)}
                    />
                    <Label htmlFor="record_status" className="font-normal">
                      Active
                    </Label>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className={cn(dbDialogWideFormFooter, dbDialogFooter)}>
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseDialog}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingRecord ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
