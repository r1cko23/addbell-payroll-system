"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, Plus, Search } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DbDesktopBlock,
  DbMobileBlock,
} from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { DashboardTablePagination } from "@/components/dashboard/DashboardTablePagination";
import { MultiSelectCheckboxFilter } from "@/components/projects/MultiSelectCheckboxFilter";
import {
  dbDialogWideForm,
  dbDialogWideFormBody,
  dbDialogWideFormFooter,
  dbDialogWideFormHeader,
  dbDialogWideFormStyle,
  dbDialogFooter,
  dbHeaderButton,
  dbMobileListCard,
  dbStatusBadge,
  dbStatusBadgeCell,
  dbTableShellFit,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { PO_MASTERLIST_SHEET_HEADERS } from "@/lib/po-masterlist-sheet-row";
import {
  PO_MASTERLIST_EDITABLE_COLUMNS,
  type PoMasterlistEditableColumn,
} from "@/lib/po-masterlist-column-acl";
import {
  createPoMasterlistJob,
  patchPoMasterlistJob,
  PO_MASTERLIST_DEFAULT_PROJECT_STATUSES,
  PO_MASTERLIST_MIN_YEAR,
  PO_MASTERLIST_PAGE_SIZE,
  usePoMasterlistJobs,
} from "@/lib/hooks/usePoMasterlistJobs";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import { formatPoMasterlistSheetAmount } from "@/lib/po-masterlist-sheet-row";

const PROJECT_STATUS_FILTER_OPTIONS = [
  { value: "ON-GOING", label: "On-going" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const PAYMENT_STATUS_FILTER_OPTIONS = [
  { value: "PAID", label: "Paid" },
  { value: "PENDING", label: "Pending" },
  { value: "FOR INVOICE", label: "For invoice" },
  { value: "CANCELLED", label: "Cancelled" },
] as const;

const FIELD_LABEL: Record<PoMasterlistEditableColumn, string> = {
  po_date: PO_MASTERLIST_SHEET_HEADERS[0],
  po_received_date: PO_MASTERLIST_SHEET_HEADERS[1],
  po_number: PO_MASTERLIST_SHEET_HEADERS[2],
  po_amount: PO_MASTERLIST_SHEET_HEADERS[3],
  project_title: PO_MASTERLIST_SHEET_HEADERS[4],
  client_name: PO_MASTERLIST_SHEET_HEADERS[5],
  location: PO_MASTERLIST_SHEET_HEADERS[6],
  payment_terms: PO_MASTERLIST_SHEET_HEADERS[7],
  cari: PO_MASTERLIST_SHEET_HEADERS[8],
  cari_expiry: PO_MASTERLIST_SHEET_HEADERS[9],
  project_status: PO_MASTERLIST_SHEET_HEADERS[10],
  payment_status: PO_MASTERLIST_SHEET_HEADERS[11],
  invoice_numbers: PO_MASTERLIST_SHEET_HEADERS[12],
  general_remarks: PO_MASTERLIST_SHEET_HEADERS[13],
};

const PROJECT_STATUS_OPTIONS = [
  "ON-GOING",
  "PENDING",
  "COMPLETED",
  "CANCELLED",
] as const;
const PAYMENT_STATUS_OPTIONS = [
  "PENDING",
  "PAID",
  "FOR INVOICE",
  "CANCELLED",
] as const;

const EMPTY_CREATE_FORM: Record<PoMasterlistEditableColumn, string> = {
  po_date: "",
  po_received_date: "",
  po_number: "",
  po_amount: "",
  project_title: "",
  client_name: "",
  location: "",
  payment_terms: "",
  cari: "",
  cari_expiry: "",
  project_status: "PENDING",
  payment_status: "PENDING",
  invoice_numbers: "",
  general_remarks: "",
};

function displayValue(
  job: PoMasterlistJob,
  field: PoMasterlistEditableColumn
): string {
  const value = job[field];
  if (value == null || value === "") return "—";
  if (field === "po_amount" && typeof value === "number") {
    return formatPoMasterlistSheetAmount(value);
  }
  return String(value);
}

function draftFromJob(
  job: PoMasterlistJob,
  fields: PoMasterlistEditableColumn[]
): Record<string, string> {
  const draft: Record<string, string> = {};
  for (const field of fields) {
    const value = job[field];
    draft[field] = value == null ? "" : String(value);
  }
  return draft;
}

function statusBadgeVariant(
  status: string | null
): "default" | "secondary" | "outline" | "destructive" {
  const normalized = (status ?? "").toUpperCase();
  if (normalized === "COMPLETED" || normalized === "PAID") return "default";
  if (normalized === "CANCELLED") return "destructive";
  if (normalized === "ON-GOING" || normalized === "ONGOING" || normalized === "PENDING") {
    return "secondary";
  }
  return "outline";
}

function JobIdentitySummary({ job }: { job: PoMasterlistJob }) {
  return (
    <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-5 sm:gap-y-1">
      <p className="font-medium shrink-0">{job.po_number}</p>
      <p className="truncate text-muted-foreground sm:max-w-[16rem]">
        {job.client_name || "—"}
      </p>
      <p
        className="min-w-0 truncate sm:flex-1"
        title={job.project_title || undefined}
      >
        {job.project_title || "—"}
      </p>
    </div>
  );
}

function FieldControl({
  field,
  value,
  onChange,
  idPrefix = "job_field",
}: {
  field: PoMasterlistEditableColumn;
  value: string;
  onChange: (next: string) => void;
  idPrefix?: string;
}) {
  const id = `${idPrefix}_${field}`;
  const label = FIELD_LABEL[field];
  const requiredMark =
    field === "po_number" ||
    field === "project_title" ||
    field === "client_name"
      ? " *"
      : "";
  const fieldWrap = "space-y-2 min-w-0";
  const controlClass = "h-10";

  if (field === "project_status") {
    const options = PROJECT_STATUS_OPTIONS.includes(
      value.toUpperCase() as (typeof PROJECT_STATUS_OPTIONS)[number]
    )
      ? PROJECT_STATUS_OPTIONS
      : ([value.toUpperCase(), ...PROJECT_STATUS_OPTIONS].filter(
          (item, index, all) => item && all.indexOf(item) === index
        ) as string[]);
    return (
      <div className={fieldWrap}>
        <Label htmlFor={id} className="text-xs font-medium tracking-wide">
          {label}
          {requiredMark}
        </Label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} className={controlClass}>
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field === "payment_status") {
    const options = PAYMENT_STATUS_OPTIONS.includes(
      value.toUpperCase() as (typeof PAYMENT_STATUS_OPTIONS)[number]
    )
      ? PAYMENT_STATUS_OPTIONS
      : ([value.toUpperCase(), ...PAYMENT_STATUS_OPTIONS].filter(
          (item, index, all) => item && all.indexOf(item) === index
        ) as string[]);
    return (
      <div className={fieldWrap}>
        <Label htmlFor={id} className="text-xs font-medium tracking-wide">
          {label}
          {requiredMark}
        </Label>
        <Select value={value || undefined} onValueChange={onChange}>
          <SelectTrigger id={id} className={controlClass}>
            <SelectValue placeholder="Select payment status" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field === "invoice_numbers") {
    return (
      <div className={fieldWrap}>
        <Label htmlFor={id} className="text-xs font-medium tracking-wide">
          {label}
          {requiredMark}
        </Label>
        <Input
          id={id}
          type="text"
          className={controlClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (field === "general_remarks") {
    return (
      <div className={cn(fieldWrap, "sm:col-span-2 xl:col-span-3")}>
        <Label htmlFor={id} className="text-xs font-medium tracking-wide">
          {label}
          {requiredMark}
        </Label>
        <Textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          className="min-h-[5.5rem] resize-y px-3 py-2.5"
        />
      </div>
    );
  }

  if (field === "project_title") {
    return (
      <div className={cn(fieldWrap, "sm:col-span-2 xl:col-span-2")}>
        <Label htmlFor={id} className="text-xs font-medium tracking-wide">
          {label}
          {requiredMark}
        </Label>
        <Input
          id={id}
          type="text"
          className={controlClass}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  return (
    <div className={fieldWrap}>
      <Label htmlFor={id} className="text-xs font-medium tracking-wide">
        {label}
      </Label>
      <Input
        id={id}
        className={controlClass}
        type={
          field === "po_amount"
            ? "text"
            : field.includes("date")
              ? "date"
              : "text"
        }
        inputMode={field === "po_amount" ? "decimal" : undefined}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

const stickyActionsHead =
  "sticky right-0 z-20 w-[16%] bg-muted text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]";
const stickyActionsCell =
  "sticky right-0 z-10 w-[16%] bg-background text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)] group-hover:bg-muted/50";

export function PoMasterlistProjectsGrid() {
  const [q, setQ] = useState("");
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState<string[]>(
    [...PO_MASTERLIST_DEFAULT_PROJECT_STATUSES]
  );
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState<string[]>(
    []
  );
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [editingJob, setEditingJob] = useState<PoMasterlistJob | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] =
    useState<Record<PoMasterlistEditableColumn, string>>(EMPTY_CREATE_FORM);
  const [localJobs, setLocalJobs] = useState<PoMasterlistJob[] | null>(null);

  const filters = useMemo(
    () => ({
      q,
      project_statuses: selectedProjectStatuses,
      payment_statuses: selectedPaymentStatuses,
      clients: selectedClients,
      years: selectedYears,
      page,
      pageSize: PO_MASTERLIST_PAGE_SIZE,
    }),
    [
      q,
      selectedProjectStatuses,
      selectedPaymentStatuses,
      selectedClients,
      selectedYears,
      page,
    ]
  );

  const {
    jobs,
    total,
    page: currentPage,
    pageCount,
    pageSize,
    filterOptions,
    editableColumns,
    canCreate,
    isLoading,
    isFetching,
    isError,
    invalidate,
  } = usePoMasterlistJobs(filters);

  const rows = localJobs ?? jobs;
  const canUpdate = editableColumns.length > 0;
  const yearOptions = useMemo(() => {
    const maxYear = new Date().getFullYear() + 1;
    const fromApi = filterOptions.years.filter(
      (year) => year >= PO_MASTERLIST_MIN_YEAR && year <= maxYear
    );
    if (fromApi.length > 0) {
      return fromApi.map((year) => ({
        value: String(year),
        label: String(year),
      }));
    }
    const years: { value: string; label: string }[] = [];
    for (let year = maxYear; year >= PO_MASTERLIST_MIN_YEAR; year -= 1) {
      years.push({ value: String(year), label: String(year) });
    }
    return years;
  }, [filterOptions.years]);
  const clientOptions = useMemo(
    () =>
      filterOptions.clients.map((client) => ({
        value: client,
        label: client,
      })),
    [filterOptions.clients]
  );

  function resetListState() {
    setLocalJobs(null);
    setPage(1);
  }

  function openEdit(job: PoMasterlistJob) {
    setEditingJob(job);
    setDraft(draftFromJob(job, editableColumns));
  }

  function replaceJob(updated: PoMasterlistJob) {
    setLocalJobs((prev) => {
      const base = prev ?? jobs;
      return base.map((job) => (job.id === updated.id ? updated : job));
    });
  }

  async function handleSave() {
    if (!editingJob) return;
    const payload: Partial<Record<PoMasterlistEditableColumn, unknown>> = {};
    for (const field of editableColumns) {
      const next = draft[field] ?? "";
      const current = editingJob[field];
      const currentText = current == null ? "" : String(current);
      if (next === currentText) continue;
      payload[field] =
        field === "po_amount"
          ? next.trim() === ""
            ? null
            : Number(next.replace(/[₱,]/g, ""))
          : next.trim() === ""
            ? null
            : next;
    }
    if (Object.keys(payload).length === 0) {
      setEditingJob(null);
      return;
    }
    setSaving(true);
    try {
      const updated = await patchPoMasterlistJob(editingJob.id, payload);
      replaceJob(updated);
      toast.success("Job updated");
      setEditingJob(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreate() {
    if (
      !createForm.po_number.trim() ||
      !createForm.project_title.trim() ||
      !createForm.client_name.trim()
    ) {
      toast.error("P.O. NUMBER, PROJECT TITLE, and CLIENT are required");
      return;
    }
    setCreating(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const field of PO_MASTERLIST_EDITABLE_COLUMNS) {
        const raw = (createForm[field] ?? "").trim();
        if (field === "po_amount") {
          payload[field] =
            raw === "" ? null : Number(raw.replace(/[₱,]/g, ""));
          continue;
        }
        payload[field] = raw === "" ? null : raw;
      }
      await createPoMasterlistJob(payload);
      toast.success("Job created");
      setCreateOpen(false);
      setCreateForm({ ...EMPTY_CREATE_FORM });
      setLocalJobs(null);
      setPage(1);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => {
                resetListState();
                setQ(event.target.value);
              }}
              placeholder="Search P.O., client, title…"
              className="pl-8"
              aria-label="Search jobs"
            />
          </div>
          <MultiSelectCheckboxFilter
            label="Clients"
            allLabel="All clients"
            options={clientOptions}
            selected={selectedClients}
            searchable
            searchPlaceholder="Search clients…"
            onChange={(next) => {
              resetListState();
              setSelectedClients(next);
            }}
          />
          <MultiSelectCheckboxFilter
            label="Years"
            allLabel="All years"
            options={yearOptions}
            selected={selectedYears}
            onChange={(next) => {
              resetListState();
              setSelectedYears(next);
            }}
          />
          <MultiSelectCheckboxFilter
            label="Project status"
            allLabel="All project statuses"
            options={[...PROJECT_STATUS_FILTER_OPTIONS]}
            selected={selectedProjectStatuses}
            onChange={(next) => {
              resetListState();
              setSelectedProjectStatuses(next);
            }}
          />
          <MultiSelectCheckboxFilter
            label="Payment status"
            allLabel="All payment statuses"
            options={[...PAYMENT_STATUS_FILTER_OPTIONS]}
            selected={selectedPaymentStatuses}
            onChange={(next) => {
              resetListState();
              setSelectedPaymentStatuses(next);
            }}
          />
        </div>

        {canCreate ? (
          <Dialog open={createOpen} onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateForm({ ...EMPTY_CREATE_FORM });
          }}>
            <DialogTrigger asChild>
              <Button className={cn(dbHeaderButton, "w-full sm:w-auto")}>
                <Plus className="mr-2 h-4 w-4" />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent className={dbDialogWideForm} style={dbDialogWideFormStyle}>
              <DialogHeader className={dbDialogWideFormHeader}>
                <DialogTitle>New Job</DialogTitle>
                <DialogDescription>
                  Fill the ADD-BELL masterlist columns (A–N). Required: P.O.
                  NUMBER, PROJECT TITLE, and CLIENT.
                </DialogDescription>
              </DialogHeader>
              <div className={dbDialogWideFormBody}>
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {PO_MASTERLIST_EDITABLE_COLUMNS.map((field) => (
                    <FieldControl
                      key={field}
                      field={field}
                      idPrefix="new_job"
                      value={createForm[field]}
                      onChange={(next) =>
                        setCreateForm((form) => ({
                          ...form,
                          [field]: next,
                        }))
                      }
                    />
                  ))}
                </div>
              </div>
              <DialogFooter className={cn(dbDialogWideFormFooter, dbDialogFooter)}>
                <Button
                  variant="outline"
                  onClick={() => {
                    setCreateOpen(false);
                    setCreateForm({ ...EMPTY_CREATE_FORM });
                  }}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button onClick={() => void handleCreate()} disabled={creating}>
                  {creating ? "Creating…" : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load jobs.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs match these filters.</p>
      ) : (
        <>
          <DbDesktopBlock>
            <div className={dbTableShellFit}>
              <Table
                className="w-full table-fixed"
                containerClassName="overflow-x-hidden"
              >
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[10%]">P.O.</TableHead>
                    <TableHead className="w-[13%]">Client</TableHead>
                    <TableHead className="w-[18%]">Project</TableHead>
                    <TableHead className="hidden w-[10%] 2xl:table-cell">
                      Location
                    </TableHead>
                    <TableHead className="w-[9%] text-right">Amount</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                    <TableHead className="hidden w-[12%] xl:table-cell">
                      Payment
                    </TableHead>
                    <TableHead className={stickyActionsHead}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((job) => (
                    <TableRow key={job.id} className="group">
                      <TableCell className="min-w-0 font-medium">
                        <span className="block truncate" title={job.po_number}>
                          {job.po_number}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <span
                          className="block truncate"
                          title={job.client_name || undefined}
                        >
                          {job.client_name || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0">
                        <span
                          className="line-clamp-2 break-words"
                          title={job.project_title || undefined}
                        >
                          {job.project_title || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden min-w-0 text-muted-foreground 2xl:table-cell">
                        <span
                          className="block truncate"
                          title={job.location || undefined}
                        >
                          {job.location || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="min-w-0 text-right tabular-nums">
                        <span
                          className="block truncate"
                          title={displayValue(job, "po_amount")}
                        >
                          {displayValue(job, "po_amount")}
                        </span>
                      </TableCell>
                      <TableCell className={dbStatusBadgeCell}>
                        <Badge
                          variant={statusBadgeVariant(job.project_status)}
                          className={dbStatusBadge}
                          title={job.project_status || undefined}
                        >
                          {job.project_status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={cn(dbStatusBadgeCell, "hidden xl:table-cell")}
                      >
                        <Badge
                          variant={statusBadgeVariant(job.payment_status)}
                          className={dbStatusBadge}
                          title={job.payment_status || undefined}
                        >
                          {job.payment_status || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className={cn(stickyActionsCell, "min-w-0")}>
                        <div className="inline-flex max-w-full items-center justify-end gap-1">
                          {canUpdate ? (
                            <Button
                              size="sm"
                              className="h-8 shrink-0 px-2"
                              onClick={() => openEdit(job)}
                              title="Update job"
                              aria-label={`Update ${job.po_number}`}
                            >
                              <Pencil className="h-3.5 w-3.5 sm:mr-1" aria-hidden />
                              <span className="hidden sm:inline">Update</span>
                            </Button>
                          ) : null}
                          {job.id ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 shrink-0 px-2"
                              asChild
                            >
                              <Link href={`/projects/${job.id}`}>
                                Detail
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </DbDesktopBlock>

          <DbMobileBlock>
            <div className="space-y-3">
              {rows.map((job) => (
                <article key={job.id} className={dbMobileListCard}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{job.po_number}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {job.client_name || "—"}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(job.project_status)}>
                      {job.project_status || "—"}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm">{job.project_title || "—"}</p>
                  <DashboardMobileField
                    label="Location"
                    value={job.location || "—"}
                  />
                  <DashboardMobileField
                    label="Amount"
                    value={displayValue(job, "po_amount")}
                  />
                  <DashboardMobileField
                    label="Payment"
                    value={job.payment_status || "—"}
                  />
                  <div className="flex gap-2 pt-1">
                    {canUpdate ? (
                      <Button
                        size="sm"
                        className="min-h-10 flex-1"
                        onClick={() => openEdit(job)}
                      >
                        <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Update
                      </Button>
                    ) : null}
                    {job.id ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="min-h-10 flex-1"
                        asChild
                      >
                        <Link href={`/projects/${job.id}`}>Detail</Link>
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </DbMobileBlock>

          <DashboardTablePagination
            page={currentPage}
            pageCount={pageCount}
            total={total}
            pageSize={pageSize}
            disabled={isFetching}
            onPageChange={(next) => {
              setLocalJobs(null);
              setPage(next);
            }}
          />
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Updating…</p>
          ) : null}
        </>
      )}

      <Dialog
        open={Boolean(editingJob)}
        onOpenChange={(open) => {
          if (!open) setEditingJob(null);
        }}
      >
        <DialogContent
          className={dbDialogWideForm}
          style={dbDialogWideFormStyle}
        >
          <DialogHeader className={dbDialogWideFormHeader}>
            <DialogTitle>Update job</DialogTitle>
            <DialogDescription>
              Only the fields your role can change are shown.
            </DialogDescription>
          </DialogHeader>
          {editingJob ? (
            <div className={dbDialogWideFormBody}>
              <JobIdentitySummary job={editingJob} />
              <div
                className={
                  editableColumns.length <= 2
                    ? "grid gap-x-5 gap-y-5 sm:grid-cols-2"
                    : "grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                }
              >
                {editableColumns.map((field) => (
                  <FieldControl
                    key={field}
                    field={field}
                    value={draft[field] ?? ""}
                    onChange={(next) =>
                      setDraft((current) => ({ ...current, [field]: next }))
                    }
                  />
                ))}
              </div>
            </div>
          ) : null}
          <DialogFooter className={cn(dbDialogWideFormFooter, dbDialogFooter)}>
            <Button
              variant="outline"
              onClick={() => setEditingJob(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
