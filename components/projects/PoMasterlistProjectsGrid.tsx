"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Search } from "lucide-react";
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
  dbTableShell,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { PO_MASTERLIST_SHEET_HEADERS } from "@/lib/po-masterlist-sheet-row";
import {
  PO_MASTERLIST_GRID_COLUMNS,
  PO_MASTERLIST_WRAP_CELL_CLASS,
  PO_MASTERLIST_HEADER_CLASS,
  PO_MASTERLIST_CELL_ALIGN_CLASS,
} from "@/lib/po-masterlist-grid-columns";
import {
  formatPoMasterlistInvoiceGlance,
  parsePoMasterlistInvoiceNumbers,
} from "@/lib/po-masterlist-invoice-lines";
import {
  PO_MASTERLIST_EDITABLE_COLUMNS,
  type PoMasterlistEditableColumn,
} from "@/lib/po-masterlist-column-acl";
import {
  createPoMasterlistJob,
  patchPoMasterlistJob,
  pullPoMasterlistSheet,
  PO_MASTERLIST_LAST_PULL_STORAGE_KEY,
  PO_MASTERLIST_MIN_YEAR,
  PO_MASTERLIST_PAGE_SIZE,
  PO_MASTERLIST_PAGE_SIZES,
  shouldAutoPullPoMasterlistSheet,
  usePoMasterlistJobs,
} from "@/lib/hooks/usePoMasterlistJobs";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import { formatPoMasterlistSheetAmount, formatPoMasterlistSheetDate } from "@/lib/po-masterlist-sheet-row";
import {
  buildPoMasterlistCellPatch,
  editorSeedValue,
} from "@/lib/po-masterlist-cell-edit";
import { poMasterlistStatusBadgeClass } from "@/lib/po-masterlist-status-badge";
import { shouldMountDashboardViewportTree } from "@/lib/dashboard-viewport";
import { useDashboardViewportTier } from "@/lib/hooks/useDashboardViewport";

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
  if (field === "po_date" || field === "po_received_date" || field === "cari_expiry") {
    return formatPoMasterlistSheetDate(String(value)) || "—";
  }
  return String(value);
}

function renderGridCell(
  job: PoMasterlistJob,
  field: PoMasterlistEditableColumn
) {
  if (field === "invoice_numbers") {
    return <InvoiceSchedule value={job.invoice_numbers} />;
  }
  if (field === "project_status" || field === "payment_status") {
    return <StatusChip status={job[field]} />;
  }
  if (field === "po_amount") {
    return (
      <span className="block tabular-nums">
        {displayValue(job, field)}
      </span>
    );
  }
  if (field === "po_date") {
    return <span className="whitespace-nowrap">{displayValue(job, field)}</span>;
  }
  return (
    <span className={PO_MASTERLIST_WRAP_CELL_CLASS}>
      {displayValue(job, field)}
    </span>
  );
}

function StatusChip({ status }: { status: string | null }) {
  return (
    <Badge
      variant="outline"
      className={cn(dbStatusBadge, poMasterlistStatusBadgeClass(status))}
    >
      {status || "—"}
    </Badge>
  );
}

function StatusOptionLabel({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium",
        poMasterlistStatusBadgeClass(status)
      )}
    >
      {status}
    </span>
  );
}

function InvoiceSchedule({ value }: { value: string | null }) {
  const lines = parsePoMasterlistInvoiceNumbers(value);
  if (lines.length === 0) return <span>—</span>;
  return (
    <ul className="flex flex-wrap items-center justify-center gap-1">
      {lines.map((line, index) => (
        <li key={`${line.raw}-${index}`}>
          <Badge
            variant="outline"
            title={line.raw}
            className={cn(
              dbStatusBadge,
              "px-2 text-[12px] leading-snug",
              poMasterlistStatusBadgeClass(line.status)
            )}
          >
            {formatPoMasterlistInvoiceGlance(line)}
          </Badge>
        </li>
      ))}
    </ul>
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
  const controlClass = "h-11 min-h-11 rounded-full";

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
                <StatusOptionLabel status={option} />
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
                <StatusOptionLabel status={option} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field === "invoice_numbers") {
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
          rows={5}
          className="min-h-[7rem] resize-y px-3 py-2.5 font-mono text-sm"
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

type EditingCell = {
  jobId: string;
  field: PoMasterlistEditableColumn;
};

function InlineCellEditor({
  field,
  value,
  onChange,
  onCommit,
  onCancel,
}: {
  field: PoMasterlistEditableColumn;
  value: string;
  onChange: (next: string) => void;
  onCommit: (next: string) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const settled = useRef(false);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function commit(next = latest.current) {
    if (settled.current) return;
    settled.current = true;
    onCommit(next);
  }

  function cancel() {
    if (settled.current) return;
    settled.current = true;
    onCancel();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
      return;
    }
    const multiline = field === "invoice_numbers" || field === "general_remarks";
    if (event.key === "Enter" && (!multiline || event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  }

  function handleChange(next: string) {
    latest.current = next;
    onChange(next);
  }

  if (field === "project_status" || field === "payment_status") {
    const catalog =
      field === "project_status" ? PROJECT_STATUS_OPTIONS : PAYMENT_STATUS_OPTIONS;
    const options = catalog.includes(
      value.toUpperCase() as (typeof catalog)[number]
    )
      ? catalog
      : ([value.toUpperCase(), ...catalog].filter(
          (item, index, all) => item && all.indexOf(item) === index
        ) as string[]);
    return (
      <Select
        defaultOpen
        value={value || undefined}
        onValueChange={(next) => commit(next)}
        onOpenChange={(open) => {
          if (!open) cancel();
        }}
      >
        <SelectTrigger
          className="h-11 min-h-11 w-full min-w-[8rem] rounded-full"
          aria-label={`Edit ${FIELD_LABEL[field]}`}
        >
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>
              <StatusOptionLabel status={option} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (field === "invoice_numbers" || field === "general_remarks") {
    return (
      <Textarea
        ref={(node) => {
          inputRef.current = node;
        }}
        value={value}
        rows={field === "invoice_numbers" ? 5 : 3}
        className="min-h-[4.5rem] w-full min-w-[12rem] resize-y px-2 py-1.5 text-[13px]"
        aria-label={`Edit ${FIELD_LABEL[field]}`}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={() => commit()}
        onKeyDown={onKeyDown}
      />
    );
  }

  return (
    <Input
      ref={(node) => {
        inputRef.current = node;
      }}
      className="h-8 w-full min-w-[7rem]"
      type={field === "po_amount" ? "text" : field.includes("date") ? "date" : "text"}
      inputMode={field === "po_amount" ? "decimal" : undefined}
      value={value}
      aria-label={`Edit ${FIELD_LABEL[field]}`}
      onChange={(event) => handleChange(event.target.value)}
      onBlur={() => commit()}
      onKeyDown={onKeyDown}
    />
  );
}

const stickyPoHead =
  "sticky left-0 z-20 min-w-[9rem] bg-muted shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)]";
const stickyPoCell =
  "sticky left-0 z-10 min-w-[9rem] bg-background py-1.5 font-medium shadow-[6px_0_8px_-6px_rgba(15,23,42,0.18)] group-hover:bg-muted/50";

export function PoMasterlistProjectsGrid() {
  const viewportTier = useDashboardViewportTier();
  const [q, setQ] = useState("");
  const [selectedProjectStatuses, setSelectedProjectStatuses] = useState(
    [] as string[]
  );
  const [syncing, setSyncing] = useState(false);
  const [selectedPaymentStatuses, setSelectedPaymentStatuses] = useState(
    [] as string[]
  );
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PO_MASTERLIST_PAGE_SIZE);
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [cellDraft, setCellDraft] = useState("");
  const [savingCell, setSavingCell] = useState<string | null>(null);
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
      pageSize,
    }),
    [
      q,
      selectedProjectStatuses,
      selectedPaymentStatuses,
      selectedClients,
      selectedYears,
      page,
      pageSize,
    ]
  );

  const {
    jobs,
    total,
    page: currentPage,
    pageCount,
    pageSize: appliedPageSize,
    filterOptions,
    editableColumns,
    canCreate,
    lastSyncedAt,
    canSyncSheet,
    isLoading,
    isFetching,
    isError,
    invalidate,
  } = usePoMasterlistJobs(filters);

  const rows = localJobs ?? jobs;
  const autoPullStarted = useRef(false);

  useEffect(() => {
    if (!canSyncSheet || autoPullStarted.current) return;
    const stored = Number(
      sessionStorage.getItem(PO_MASTERLIST_LAST_PULL_STORAGE_KEY)
    );
    const lastPullAtMs = Number.isFinite(stored) && stored > 0 ? stored : null;
    if (
      !shouldAutoPullPoMasterlistSheet({
        canSyncSheet,
        lastPullAtMs,
        nowMs: Date.now(),
      })
    ) {
      return;
    }
    autoPullStarted.current = true;
    sessionStorage.setItem(
      PO_MASTERLIST_LAST_PULL_STORAGE_KEY,
      String(Date.now())
    );
    void pullPoMasterlistSheet()
      .then(async () => {
        setLocalJobs(null);
        await invalidate();
      })
      .catch(() => {
        autoPullStarted.current = false;
      });
  }, [canSyncSheet, invalidate]);
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

  function replaceJob(updated: PoMasterlistJob) {
    setLocalJobs((prev) => {
      const base = prev ?? jobs;
      return base.map((job) => (job.id === updated.id ? updated : job));
    });
  }

  function startCellEdit(job: PoMasterlistJob, field: PoMasterlistEditableColumn) {
    if (!editableColumns.includes(field)) {
      toast.error("Your role cannot edit this field");
      return;
    }
    setEditingCell({ jobId: job.id, field });
    setCellDraft(editorSeedValue(field, job[field]));
  }

  function cancelCellEdit() {
    setEditingCell(null);
    setCellDraft("");
  }

  async function commitCellEdit(
    job: PoMasterlistJob,
    field: PoMasterlistEditableColumn,
    nextText = cellDraft
  ) {
    const patch = buildPoMasterlistCellPatch(field, nextText, job[field]);
    setEditingCell(null);
    setCellDraft("");
    if (!patch) return;
    const saveKey = `${job.id}:${field}`;
    setSavingCell(saveKey);
    try {
      const updated = await patchPoMasterlistJob(job.id, {
        [patch.field]: patch.value,
      });
      replaceJob(updated);
      toast.success("Saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSavingCell(null);
    }
  }

  function isEditing(jobId: string, field: PoMasterlistEditableColumn) {
    return editingCell?.jobId === jobId && editingCell.field === field;
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

  async function handleSyncFromSheet() {
    setSyncing(true);
    try {
      const result = await pullPoMasterlistSheet();
      sessionStorage.setItem(
        PO_MASTERLIST_LAST_PULL_STORAGE_KEY,
        String(Date.now())
      );
      toast.success(
        `Synced ${result.rowsRead} sheet rows (${result.inserted} new, ${result.updated} updated from the sheet).`
      );
      setLocalJobs(null);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="grid flex-1 min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="relative sm:col-span-2 xl:col-span-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={q}
              onChange={(event) => {
                resetListState();
                setQ(event.target.value);
              }}
              placeholder="Search P.O., client, title, invoice…"
              className="h-11 min-h-11 sm:h-11 sm:min-h-11 rounded-full pl-9"
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
            className="w-full min-w-0 sm:w-full"
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
            className="w-full min-w-0 sm:w-full"
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
            className="w-full min-w-0 sm:w-full"
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
            className="w-full min-w-0 sm:w-full"
            onChange={(next) => {
              resetListState();
              setSelectedPaymentStatuses(next);
            }}
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
        {canSyncSheet ? (
          <Button
            type="button"
            variant="outline"
            className={cn(dbHeaderButton, "w-full sm:w-auto")}
            onClick={() => void handleSyncFromSheet()}
            disabled={syncing}
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", syncing && "animate-spin")} aria-hidden />
            {syncing ? "Syncing…" : "Sync with Google Sheets"}
          </Button>
        ) : null}
        {canCreate ? (
          <Dialog open={createOpen} onOpenChange={(open) => {
            setCreateOpen(open);
            if (!open) setCreateForm({ ...EMPTY_CREATE_FORM });
          }}>
            <DialogTrigger asChild>
              <Button className={cn(dbHeaderButton, "w-full sm:w-auto")}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                New Job
              </Button>
            </DialogTrigger>
            <DialogContent className={dbDialogWideForm} style={dbDialogWideFormStyle}>
              <DialogHeader className={dbDialogWideFormHeader}>
                <DialogTitle>New Job</DialogTitle>
                <DialogDescription>
                  Fill the visible job columns. Required: P.O. NUMBER, PROJECT
                  TITLE, and CLIENT.
                </DialogDescription>
              </DialogHeader>
              <div className={dbDialogWideFormBody}>
                <div className="grid gap-x-5 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {PO_MASTERLIST_GRID_COLUMNS.map((column) => (
                    <FieldControl
                      key={column.key}
                      field={column.key}
                      idPrefix="new_job"
                      value={createForm[column.key]}
                      onChange={(next) =>
                        setCreateForm((form) => ({
                          ...form,
                          [column.key]: next,
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
      </div>
      {lastSyncedAt ? (
        <p className="text-xs text-muted-foreground">
          Last sheet sync {new Date(lastSyncedAt).toLocaleString()}.
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading jobs…</p>
      ) : isError ? (
        <p className="text-sm text-destructive">Failed to load jobs.</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No jobs match these filters.</p>
      ) : (
        <>
          <DbDesktopBlock>
            <div className={dbTableShell}>
              <table className="w-full table-fixed border-collapse text-center text-[13px] leading-snug">
                <thead className="bg-muted/50">
                  <tr>
                    {PO_MASTERLIST_GRID_COLUMNS.map((column) => (
                      <th
                        key={column.key}
                        className={cn(
                          "border-b px-2 py-1.5 font-medium",
                          PO_MASTERLIST_CELL_ALIGN_CLASS,
                          PO_MASTERLIST_HEADER_CLASS,
                          column.widthClass,
                          column.key === "po_number" && stickyPoHead
                        )}
                      >
                        {column.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((job) => (
                    <tr key={job.id} className="group border-b last:border-0">
                      {PO_MASTERLIST_GRID_COLUMNS.map((column) => {
                        const field = column.key;
                        const editable = editableColumns.includes(field);
                        const editing = isEditing(job.id, field);
                        const showEditor =
                          editing &&
                          shouldMountDashboardViewportTree(
                            "desktop",
                            viewportTier
                          );
                        return (
                          <td
                            key={field}
                            className={cn(
                              "px-2 py-1.5",
                              PO_MASTERLIST_CELL_ALIGN_CLASS,
                              column.widthClass,
                              !column.wrap && field !== "po_amount" && "whitespace-nowrap",
                              column.key === "po_number" && stickyPoCell,
                              (field === "project_status" ||
                                field === "payment_status") &&
                                dbStatusBadgeCell,
                              column.numeric && "tabular-nums",
                              editable && !editing && "cursor-text select-none"
                            )}
                            title={
                              editing
                                ? undefined
                                : editable
                                  ? "Double-click to edit"
                                  : "Your role cannot edit this field"
                            }
                            onDoubleClick={() => {
                              if (editing || savingCell) return;
                              startCellEdit(job, field);
                            }}
                          >
                            {showEditor ? (
                              <InlineCellEditor
                                field={field}
                                value={cellDraft}
                                onChange={setCellDraft}
                                onCommit={(next) =>
                                  void commitCellEdit(job, field, next)
                                }
                                onCancel={cancelCellEdit}
                              />
                            ) : (
                              renderGridCell(job, field)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </DbDesktopBlock>

          <DbMobileBlock>
            <div className="space-y-3">
              {rows.map((job) => (
                <article key={job.id} className={dbMobileListCard}>
                  {PO_MASTERLIST_GRID_COLUMNS.map((column) => {
                    const field = column.key;
                    const editable = editableColumns.includes(field);
                    const editing = isEditing(job.id, field);
                    const showEditor =
                      editing &&
                      shouldMountDashboardViewportTree("mobile", viewportTier);
                    return (
                      <div
                        key={field}
                        className={cn(
                          "min-w-0",
                          editable && !editing && "cursor-text"
                        )}
                        title={
                          editing
                            ? undefined
                            : editable
                              ? "Double-tap to edit"
                              : "Your role cannot edit this field"
                        }
                        onDoubleClick={() => {
                          if (editing || savingCell) return;
                          startCellEdit(job, field);
                        }}
                      >
                        {showEditor ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {column.header}
                            </p>
                            <InlineCellEditor
                              field={field}
                              value={cellDraft}
                              onChange={setCellDraft}
                              onCommit={(next) =>
                                void commitCellEdit(job, field, next)
                              }
                              onCancel={cancelCellEdit}
                            />
                          </div>
                        ) : field === "invoice_numbers" ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              {column.header}
                            </p>
                            <InvoiceSchedule value={job.invoice_numbers} />
                          </div>
                        ) : (
                          <DashboardMobileField
                            label={column.header}
                            value={renderGridCell(job, field)}
                            valueClassName={cn(
                              "text-right",
                              column.wrap && PO_MASTERLIST_WRAP_CELL_CLASS
                            )}
                          />
                        )}
                      </div>
                    );
                  })}
                </article>
              ))}
            </div>
          </DbMobileBlock>

          <DashboardTablePagination
            page={currentPage}
            pageCount={pageCount}
            total={total}
            pageSize={appliedPageSize}
            pageSizeOptions={PO_MASTERLIST_PAGE_SIZES}
            disabled={isFetching}
            onPageChange={(next) => {
              setLocalJobs(null);
              setPage(next);
            }}
            onPageSizeChange={(next) => {
              setLocalJobs(null);
              setPage(1);
              setPageSize(next);
            }}
          />
          {isFetching && !isLoading ? (
            <p className="text-xs text-muted-foreground">Updating…</p>
          ) : null}
        </>
      )}
    </div>
  );
}
