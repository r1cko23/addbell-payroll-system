"use client";

import { Suspense, useState, useRef, useCallback, useEffect, useMemo } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useProjectsForPO } from "@/lib/hooks/useProjects";
import { useSuppliersForPO } from "@/lib/hooks/useVendors";
import { useSessionLoader } from "@/lib/hooks/useSessionLoader";
import { useProfile } from "@/lib/hooks/useProfile";
import { bustCache } from "@/lib/cache-client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  DashboardTablePagination,
  DASHBOARD_TABLE_PAGE_SIZE,
  paginateItems,
} from "@/components/dashboard/DashboardTablePagination";
import { dbHeaderActions, dbHeaderButton, dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { PurchaseOrderPrint } from "@/components/PurchaseOrderPrint";
import {
  DEFAULT_COMPANY,
  DEFAULT_PAYMENT_TERMS,
  type PurchaseOrder,
  type PurchaseOrderVendor,
  type PurchaseOrderLineItem,
} from "@/types/purchase-order";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Printer, Plus, Trash2, FileDown, Save, Search, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { normalizePOData } from "@/utils/po-format";
import { primaryVendorEmail, primaryVendorPhone } from "@/lib/vendor-contacts";
import { normalizeUserRole, isPurchasingOrAdminRole } from "@/lib/user-roles";
import { MultiSelectCheckboxFilter } from "@/components/projects/MultiSelectCheckboxFilter";

const emptyVendor: PurchaseOrderVendor = { name: "", contactPerson: "", tin: "", address: "", phone: "", email: "" };
const emptyItem = (n: number): PurchaseOrderLineItem => ({ itemNo: n, description: "", qty: "", unitPrice: 0, totalAmount: 0 });

interface PORow {
  id: string;
  po_number: string;
  po_date: string;
  status: string;
  subtotal: number;
  total_amount: number;
  vendor_id: string;
  po_masterlist_job_id: string | null;
  project_title: string | null;
  parent_purchase_order_id: string | null;
  created_by: string | null;
  vendors: { name: string } | null;
  po_masterlist_jobs: {
    id: string;
    project_title: string | null;
    po_number: string | null;
    client_name: string | null;
    client_id: string | null;
  } | null;
  parent: { id: string; po_number: string } | null;
  created_at: string;
}

function poClientId(po: PORow): string | null {
  return po.po_masterlist_jobs?.client_id ?? null;
}

function poClientName(po: PORow): string {
  return po.po_masterlist_jobs?.client_name || "";
}

function poProjectKey(po: PORow): string {
  if (po.po_masterlist_job_id) return `job:${po.po_masterlist_job_id}`;
  const title = (
    po.po_masterlist_jobs?.project_title ||
    po.project_title ||
    ""
  ).trim();
  return title ? `title:${title.toLowerCase()}` : "";
}

function poProjectLabel(po: PORow): string {
  return (
    po.po_masterlist_jobs?.project_title ||
    po.project_title ||
    ""
  ).trim() || "—";
}

function poYear(po: PORow): number | null {
  const raw = String(po.po_date || "").slice(0, 4);
  const year = Number(raw);
  return Number.isFinite(year) && year >= 2000 && year <= 2100 ? year : null;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary", approved: "default", posted: "default", cancelled: "destructive",
};

export default function PurchaseOrderPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="p-8 text-center text-muted-foreground">Loading internal POs...</div>
        </DashboardLayout>
      }
    >
      <PurchaseOrderPageContent />
    </Suspense>
  );
}

function PurchaseOrderPageContent() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canRead, loading: permissionsLoading } = usePermissions();
  const [view, setView] = useState<"list" | "create">("list");
  const normalizedRole = normalizeUserRole(profile?.role);
  const canReadPurchaseOrders = canRead("purchase_orders");
  const canCreatePurchaseOrders =
    canCreate("purchase_orders") && isPurchasingOrAdminRole(normalizedRole);
  const isOperationsManager = normalizedRole === "operations_manager";

  // ----- LIST STATE (single catalog for anyone with read access) -----
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);
  const [yearFilter, setYearFilter] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const userId = profile?.id ?? null;
  const poListCacheKey =
    userId && canReadPurchaseOrders && !permissionsLoading
      ? `purchase-orders:${userId}:catalog-v8`
      : null;

  const loadPOList = useCallback(async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(
        "id, po_number, po_date, status, subtotal, total_amount, vendor_id, po_masterlist_job_id, project_title, parent_purchase_order_id, created_by, created_at, vendors ( name ), po_masterlist_jobs:po_masterlist_job_id ( id, project_title, po_number, client_name, client_id ), parent:parent_purchase_order_id ( id, po_number )"
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data as unknown as PORow[]) ?? [];
  }, [supabase]);

  const {
    data: poListData,
    loading: poListLoading,
    refresh: refreshPOList,
  } = useSessionLoader(poListCacheKey, loadPOList, {
    enabled: !!poListCacheKey,
    staleTime: 15_000,
  });
  const poList = poListData ?? [];
  const listLoading = profileLoading || permissionsLoading || poListLoading;

  useEffect(() => {
    if (!canCreatePurchaseOrders && view === "create") {
      setView("list");
    }
  }, [canCreatePurchaseOrders, view]);

  const filterOptions = useMemo(() => {
    const clients = new Map<string, string>();
    const projects = new Map<string, string>();
    const years = new Set<number>();
    for (const po of poList) {
      const clientId = poClientId(po);
      const clientName = poClientName(po);
      if (clientId && clientName) clients.set(clientId, clientName);
      else if (clientName) clients.set(`name:${clientName.toLowerCase()}`, clientName);

      const projectKey = poProjectKey(po);
      if (projectKey) projects.set(projectKey, poProjectLabel(po));

      const year = poYear(po);
      if (year != null) years.add(year);
    }
    return {
      clients: [...clients.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      projects: [...projects.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      years: [...years]
        .sort((a, b) => b - a)
        .map((year) => ({ value: String(year), label: String(year) })),
    };
  }, [poList]);

  const filteredPOs = useMemo(
    () =>
      poList.filter((po) => {
        if (statusFilter !== "all" && po.status !== statusFilter) return false;
        if (clientFilter.length > 0) {
          const id = poClientId(po);
          const name = poClientName(po);
          const nameKey = name ? `name:${name.toLowerCase()}` : "";
          const match =
            (id && clientFilter.includes(id)) ||
            (nameKey && clientFilter.includes(nameKey));
          if (!match) return false;
        }
        if (projectFilter.length > 0) {
          const key = poProjectKey(po);
          if (!key || !projectFilter.includes(key)) return false;
        }
        if (yearFilter.length > 0) {
          const year = poYear(po);
          if (year == null || !yearFilter.includes(String(year))) return false;
        }
        if (searchTerm) {
          const term = searchTerm.toLowerCase();
          const match =
            (po.po_number || "").toLowerCase().includes(term) ||
            (po.vendors?.name || "").toLowerCase().includes(term) ||
            poProjectLabel(po).toLowerCase().includes(term) ||
            poClientName(po).toLowerCase().includes(term) ||
            (po.parent?.po_number || "").toLowerCase().includes(term);
          if (!match) return false;
        }
        return true;
      }),
    [poList, searchTerm, statusFilter, clientFilter, projectFilter, yearFilter]
  );

  const { pageItems: pagedPOs, pageCount, safePage } = useMemo(
    () => paginateItems(filteredPOs, page, DASHBOARD_TABLE_PAGE_SIZE),
    [filteredPOs, page]
  );

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, clientFilter, projectFilter, yearFilter]);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  // ----- CREATE FORM STATE -----
  const printRef = useRef<HTMLDivElement>(null);
  const poReferenceEnabled = view === "create" && canCreatePurchaseOrders;
  const { data: vendors = [] } = useSuppliersForPO({ enabled: poReferenceEnabled });
  const { data: projects = [] } = useProjectsForPO({ enabled: poReferenceEnabled });
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [payeeTypeFilter, setPayeeTypeFilter] = useState<"all" | "supplier" | "subcontractor">("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [parentPurchaseOrderId, setParentPurchaseOrderId] = useState<string>("");
  const [poNumber, setPoNumber] = useState("");
  const [date, setDate] = useState(() => format(new Date(), "MMM. d, yyyy"));
  const [vendor, setVendor] = useState<PurchaseOrderVendor>(emptyVendor);
  const [requisitioner, setRequisitioner] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [items, setItems] = useState<PurchaseOrderLineItem[]>([emptyItem(1)]);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [requestedBy, setRequestedBy] = useState("");
  const [preparedBy, setPreparedBy] = useState("JOSEFINA E. CONTE");
  const [reviewedBy, setReviewedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("DIOSDADO B. LEONARDO");
  const [approvedByTitle, setApprovedByTitle] = useState("President");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSavingPO, setIsSavingPO] = useState(false);

  const updateItem = useCallback((index: number, updates: Partial<PurchaseOrderLineItem>) => {
    setItems((prev) => {
      const next = [...prev];
      const item = { ...next[index], ...updates };
      if (updates.qty !== undefined || updates.unitPrice !== undefined) {
        item.totalAmount = (parseFloat(String(item.qty)) || 0) * (item.unitPrice || 0);
      }
      next[index] = item;
      return next;
    });
  }, []);

  const addItem = useCallback(() => { setItems((prev) => [...prev, emptyItem(prev.length + 1)]); }, []);
  const removeItem = useCallback((index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, itemNo: i + 1 })));
  }, [items.length]);

  const handleSelectVendor = useCallback((id: string) => {
    setSelectedVendorId(id);
    setSelectedProjectId("");
    setParentPurchaseOrderId("");
    setProjectTitle("");
    const v = vendors.find((x) => x.id === id);
    if (v) {
      setVendor({
        name: v.name,
        contactPerson: v.contact_person ?? "",
        tin: v.tin ?? "",
        address: v.address ?? "",
        phone: primaryVendorPhone(v.phones, v.phone),
        email: primaryVendorEmail(v.emails, v.email),
      });
    }
  }, [vendors]);

  const payeeOptions = useMemo(() => {
    if (payeeTypeFilter === "all") return vendors;
    return vendors.filter((v) => v.type === payeeTypeFilter);
  }, [vendors, payeeTypeFilter]);

  const selectedPayee = useMemo(
    () => vendors.find((v) => v.id === selectedVendorId) ?? null,
    [vendors, selectedVendorId]
  );

  /** Masterlist jobs already used for this vendor, or all jobs if none yet. */
  const projectsForSelectedPayee = useMemo(() => {
    if (!selectedVendorId) return [];
    const jobIds = new Set(
      poList
        .filter((po) => po.vendor_id === selectedVendorId && po.po_masterlist_job_id)
        .map((po) => po.po_masterlist_job_id as string)
    );
    if (jobIds.size === 0) return projects;
    return projects.filter((p) => jobIds.has(p.id));
  }, [poList, projects, selectedVendorId]);

  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    setParentPurchaseOrderId("");
    const p = projects.find((x) => x.id === id);
    if (p) {
      setProjectTitle(p.name);
      setDeliverTo((prev) => (prev.trim() ? prev : p.site_address || ""));
    }
  }, [projects]);

  const mainPOsForProject = useMemo(
    () =>
      poList.filter(
        (po) =>
          po.po_masterlist_job_id === selectedProjectId &&
          !po.parent_purchase_order_id &&
          po.status !== "cancelled"
      ),
    [poList, selectedProjectId]
  );

  const handleSelectParentPo = useCallback(
    (id: string) => {
      setParentPurchaseOrderId(id === "none" ? "" : id);
      if (id === "none") return;
      const parent = poList.find((po) => po.id === id);
      if (!parent) return;
      if (
        parent.po_masterlist_job_id &&
        parent.po_masterlist_job_id !== selectedProjectId
      ) {
        setSelectedProjectId(parent.po_masterlist_job_id);
        const p = projects.find((x) => x.id === parent.po_masterlist_job_id);
        if (p) {
          setProjectTitle(p.name);
          setDeliverTo((prev) => (prev.trim() ? prev : p.site_address || ""));
        } else if (parent.project_title) {
          setProjectTitle(parent.project_title);
        }
      }
    },
    [poList, projects, selectedProjectId]
  );

  const poData: PurchaseOrder = {
    poNumber, date, vendor, requisitioner, company: DEFAULT_COMPANY, projectTitle, deliverTo,
    items: items.map((it, i) => ({ ...it, itemNo: i + 1, totalAmount: (parseFloat(String(it.qty)) || 0) * (it.unitPrice || 0) })),
    paymentTerms, requestedBy: requestedBy.trim() || requisitioner, preparedBy, reviewedBy, approvedBy, approvedByTitle,
    printTimestamp: new Date().toISOString(),
  };

  const handleSaveAndPost = useCallback(async () => {
    if (!canCreatePurchaseOrders) {
      toast.error("You only have view access to internal POs.");
      return;
    }
    if (!selectedProjectId) { toast.error("Select a project before saving PO."); return; }
    if (!selectedVendorId) { toast.error("Select a vendor or subcontractor before saving PO."); return; }
    if (!poNumber.trim()) { toast.error("Enter a PO number."); return; }
    if (parentPurchaseOrderId) {
      const parent = poList.find((po) => po.id === parentPurchaseOrderId);
      if (!parent) {
        toast.error("Selected main PO was not found. Refresh and try again.");
        return;
      }
      if (
        parent.po_masterlist_job_id &&
        parent.po_masterlist_job_id !== selectedProjectId
      ) {
        toast.error("Sub-PO must stay under the same project as the main PO.");
        return;
      }
      if (parent.parent_purchase_order_id) {
        toast.error("Tag under a main PO only — not under another sub-PO.");
        return;
      }
    }

    setIsSavingPO(true);
    try {
      let companyId: string | null = null;
      const { data: co } = await supabase.from("companies").select("id").limit(1).single();
      companyId = co?.id ?? null;

      const normalized = normalizePOData({ ...poData, printTimestamp: new Date().toISOString() });
      const itemsPayload = normalized.items.map((it) => ({
        description: it.description, qty_text: it.qty, quantity: parseFloat(String(it.qty)) || 0,
        unit_price: it.unitPrice, line_total: it.totalAmount,
      }));

      const subtotal = itemsPayload.reduce((s, it) => s + it.line_total, 0);

      const selectedJob = projects.find((p) => p.id === selectedProjectId);
      const { data: poRow, error: poError } = await supabase.from("purchase_orders").insert({
        company_id: companyId,
        po_masterlist_job_id: selectedProjectId,
        vendor_id: selectedVendorId,
        parent_purchase_order_id: parentPurchaseOrderId || null,
        created_by: userId,
        po_number: normalized.poNumber, po_date: new Date().toISOString().slice(0, 10), po_date_text: normalized.date,
        status: "draft", requisitioner: normalized.requisitioner, requested_by: normalized.requestedBy || normalized.requisitioner,
        prepared_by: normalized.preparedBy, reviewed_by: normalized.reviewedBy || "",
        approved_by: normalized.approvedBy, approved_by_title: normalized.approvedByTitle,
        project_title: normalized.projectTitle || selectedJob?.name || null, deliver_to: normalized.deliverTo,
        vendor_snapshot: normalized.vendor, company_snapshot: normalized.company,
        payment_terms: normalized.paymentTerms, print_timestamp: normalized.printTimestamp,
        subtotal, vat_amount: 0, total_amount: subtotal,
      } as never).select("id").single();

      if (poError) throw poError;

      if (poRow) {
        const lineInserts = itemsPayload.map((it, i) => ({
          purchase_order_id: poRow.id, line_no: i + 1,
          description: it.description, qty_text: it.qty_text, quantity: it.quantity,
          unit_price: it.unit_price, line_total: it.line_total,
        }));
        await supabase.from("purchase_order_items").insert(lineInserts as never[]);
      }

      toast.success("Internal PO saved.");
      setView("list");
      await bustCache();
      await refreshPOList({ force: true });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err && typeof (err as { message: string }).message === "string"
            ? (err as { message: string }).message
            : "Failed to save PO.";
      toast.error(msg);
    } finally {
      setIsSavingPO(false);
    }
  }, [canCreatePurchaseOrders, poData, poNumber, selectedProjectId, selectedVendorId, parentPurchaseOrderId, poList, userId, supabase, refreshPOList]);

  const handlePrint = useCallback(() => {
    if (!printRef.current) { toast.error("Print content not ready."); return; }
    const printContent = printRef.current.innerHTML;
    if (!printContent || printContent.trim().length < 100) { toast.error("Print content not loaded."); return; }
    const displayNumber = poNumber.trim() || "DRAFT";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setIsPrinting(true);
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.body.removeChild(iframe); setIsPrinting(false); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><base href="${origin}/" /><title>PO - ${displayNumber}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>*{box-sizing:border-box}body{font-family:'Plus Jakarta Sans',sans-serif;margin:0;padding:0;font-size:11px;color:#1e293b}img{max-width:240px;height:auto}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}@page{size:A4;margin:12mm}@media print{body{margin:0;padding:0}.po-print-root{max-width:186mm!important;width:100%!important;padding:0 8mm!important}.po-table-header th{background:#e8e8e8!important}}</style>
      </head><body>${printContent}</body></html>`);
    doc.close();
    const printWin = iframe.contentWindow;
    if (!printWin) { document.body.removeChild(iframe); setIsPrinting(false); return; }
    const images = doc.querySelectorAll("img");
    Promise.all(Array.from(images).map((img) => img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); setTimeout(r, 500); }))).then(() => {
      setTimeout(() => { printWin.focus(); printWin.print(); const cleanup = () => { if (iframe.parentNode) document.body.removeChild(iframe); setIsPrinting(false); }; printWin.onafterprint = cleanup; setTimeout(cleanup, 3000); }, 200);
    });
  }, [poNumber]);

  // Keep PDF output identical to the on-screen Print template by reusing the same
  // HTML-based print iframe (user can choose “Save as PDF” in the print dialog).
  const handleDownloadPDF = useCallback(() => {
    if (!poNumber.trim()) {
      toast.error("Enter a PO number first");
      return;
    }
    toast.success("Opening print dialog. Choose “Save as PDF” to match the print format.");
    handlePrint();
  }, [handlePrint, poNumber]);

  // ========== LIST VIEW ==========
  const listSubtitle = canCreatePurchaseOrders
    ? "Vendor/subcon POs created by purchasing. Filter by client, project, or year."
    : isOperationsManager
      ? "View vendor/subcon POs created by purchasing for your projects."
      : "View vendor/subcon POs created by purchasing.";

  const emptyListMessage =
    searchTerm ||
    statusFilter !== "all" ||
    clientFilter.length > 0 ||
    projectFilter.length > 0 ||
    yearFilter.length > 0
      ? "No POs match your filters."
      : "No internal POs yet.";

  const listTable = (
    <div className="space-y-4">
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search PO#, vendor, client, project, parent PO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <MultiSelectCheckboxFilter
              label="Clients"
              allLabel="All clients"
              options={filterOptions.clients}
              selected={clientFilter}
              onChange={setClientFilter}
              searchable
              searchPlaceholder="Search clients…"
              className="w-full sm:w-[180px]"
            />
            <MultiSelectCheckboxFilter
              label="Projects"
              allLabel="All projects"
              options={filterOptions.projects}
              selected={projectFilter}
              onChange={setProjectFilter}
              searchable
              searchPlaceholder="Search projects…"
              className="w-full sm:w-[200px]"
            />
            <MultiSelectCheckboxFilter
              label="Years"
              allLabel="All years"
              options={filterOptions.years}
              selected={yearFilter}
              onChange={setYearFilter}
              className="w-full sm:w-[140px]"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {listLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filteredPOs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">{emptyListMessage}</div>
        ) : (
          <>
            <DbMobileBlock className="p-4 pt-0">
              <div className="space-y-2">
                {pagedPOs.map((po) => (
                  <div
                    key={po.id}
                    className="rounded-lg border border-border/80 bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-xs text-muted-foreground">{po.po_number}</p>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                            {po.parent_purchase_order_id ? "Sub-PO" : "Main"}
                          </Badge>
                        </div>
                        <p className="text-sm font-medium text-foreground">
                          {format(new Date(po.po_date), "MMM d, yyyy")}
                        </p>
                      </div>
                      <Badge variant={STATUS_COLORS[po.status] ?? "secondary"} className="shrink-0 text-xs capitalize">
                        {po.status}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      <DashboardMobileField
                        label="Client"
                        value={poClientName(po) || "—"}
                      />
                      <DashboardMobileField
                        label="Project"
                        value={poProjectLabel(po)}
                      />
                      <DashboardMobileField label="Vendor" value={po.vendors?.name ?? "—"} />
                      {po.parent?.po_number ? (
                        <DashboardMobileField label="Under PO" value={po.parent.po_number} />
                      ) : null}
                      <DashboardMobileField
                        label="Amount"
                        value={`₱${Number(po.total_amount).toLocaleString()}`}
                      />
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <Link href={`/purchase-order/${po.id}`}>
                        <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </DbMobileBlock>
            <DbDesktopBlock>
              <div className="w-full max-w-full overflow-x-hidden">
                <table className="w-full table-fixed text-left text-sm">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="w-[14%] px-3 py-3 font-medium">PO Number</th>
                      <th className="w-[7%] px-3 py-3 font-medium">Type</th>
                      <th className="w-[10%] px-3 py-3 font-medium">Date</th>
                      <th className="w-[14%] px-3 py-3 font-medium">Client</th>
                      <th className="w-[16%] px-3 py-3 font-medium">Project</th>
                      <th className="w-[14%] px-3 py-3 font-medium">Vendor</th>
                      <th className="w-[9%] px-3 py-3 font-medium text-right">Amount</th>
                      <th className="w-[8%] px-3 py-3 font-medium">Status</th>
                      <th className="sticky right-0 z-20 w-[8%] bg-muted/50 px-3 py-3 font-medium text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedPOs.map((po) => (
                      <tr key={po.id} className="group border-b last:border-0 hover:bg-muted/30">
                        <td
                          className={cn(
                            "truncate px-3 py-3 font-mono text-sm",
                            po.parent_purchase_order_id && "pl-5"
                          )}
                          title={po.po_number}
                        >
                          {po.po_number}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wide whitespace-nowrap">
                            {po.parent_purchase_order_id ? "Sub-PO" : "Main"}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          {format(new Date(po.po_date), "MMM d, yyyy")}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={poClientName(po) || undefined}
                        >
                          {poClientName(po) || "—"}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={poProjectLabel(po)}
                        >
                          {poProjectLabel(po)}
                        </td>
                        <td
                          className="truncate px-3 py-3"
                          title={po.vendors?.name ?? undefined}
                        >
                          {po.vendors?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums">
                          ₱{Number(po.total_amount).toLocaleString()}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={STATUS_COLORS[po.status] ?? "secondary"} className="text-xs capitalize whitespace-nowrap">{po.status}</Badge>
                        </td>
                        <td className="sticky right-0 z-10 bg-background px-3 py-3 text-right shadow-[-6px_0_8px_-6px_rgba(15,23,42,0.18)] group-hover:bg-muted/30">
                          <Link href={`/purchase-order/${po.id}`} className="text-sm font-medium text-primary hover:underline">
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DbDesktopBlock>
            <div className="px-4 pb-4">
              <DashboardTablePagination
                page={safePage}
                pageCount={pageCount}
                total={filteredPOs.length}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
    </div>
  );

  const listView = (
    <div className={cn("min-w-0 w-full", dbPageWrapper)}>
      <DashboardPageHeader
        title="Internal POs"
        description={listSubtitle}
        actions={
          canCreatePurchaseOrders ? (
            <div className={dbHeaderActions}>
              <Button onClick={() => setView("create")} className={dbHeaderButton}>
                <Plus className="h-4 w-4 mr-2" />
                New Internal PO
              </Button>
            </div>
          ) : undefined
        }
      />

      {listTable}
    </div>
  );

  // ========== CREATE VIEW (existing form) ==========
  const createView = (
    <div className={cn("min-w-0 w-full", dbPageWrapper)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Internal PO</h1>
            <PageSubtitle className="mt-0.5">
              Purchasing and admin. Pick a vendor or subcontractor first, then a project already linked to them. Enter the PO number manually.
            </PageSubtitle>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="default" size="lg" onClick={handleSaveAndPost} disabled={isSavingPO}>
            {isSavingPO ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving...</> : <><Save className="mr-2 h-4 w-4" />Save PO</>}
          </Button>
          <Button variant="outline" size="lg" onClick={handleDownloadPDF} disabled={isPrinting}>
            {isPrinting ? (
              <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> PDF...</>
            ) : (
              <><FileDown className="mr-2 h-4 w-4" />PDF</>
            )}
          </Button>
          <Button onClick={handlePrint} size="lg" disabled={isPrinting}>
            {isPrinting ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Print...</> : <><Printer className="mr-2 h-4 w-4" />Print</>}
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Quick fill</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Payee type</Label>
              <Select
                value={payeeTypeFilter}
                onValueChange={(value) => {
                  const next =
                    value === "supplier" || value === "subcontractor" ? value : "all";
                  setPayeeTypeFilter(next);
                  if (
                    selectedVendorId &&
                    next !== "all" &&
                    selectedPayee &&
                    selectedPayee.type !== next
                  ) {
                    setSelectedVendorId("");
                    setSelectedProjectId("");
                    setParentPurchaseOrderId("");
                    setProjectTitle("");
                    setVendor(emptyVendor);
                  }
                }}
              >
                <SelectTrigger className="h-10 w-full max-w-xl">
                  <SelectValue placeholder="Vendor or subcontractor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Vendors &amp; subcontractors</SelectItem>
                  <SelectItem value="supplier">Vendors only</SelectItem>
                  <SelectItem value="subcontractor">Subcontractors only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>
                Vendor or subcontractor <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedVendorId} onValueChange={handleSelectVendor}>
                <SelectTrigger className="h-10 w-full max-w-xl">
                  <SelectValue placeholder="Select vendor or subcontractor..." />
                </SelectTrigger>
                <SelectContent>
                  {payeeOptions.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      No active {payeeTypeFilter === "subcontractor" ? "subcontractors" : payeeTypeFilter === "supplier" ? "vendors" : "payees"} found
                    </SelectItem>
                  ) : (
                    payeeOptions.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.type === "subcontractor" ? "Subcon" : "Vendor"} — {v.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>
                Project under this payee <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedProjectId}
                onValueChange={handleSelectProject}
                disabled={!selectedVendorId}
              >
                <SelectTrigger className="h-10 w-full max-w-xl">
                  <SelectValue
                    placeholder={
                      selectedVendorId
                        ? "Select project linked to this vendor/subcon..."
                        : "Select a vendor or subcontractor first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {projectsForSelectedPayee.length === 0 ? (
                    <SelectItem value="__none" disabled>
                      {selectedVendorId
                        ? "No existing projects under this vendor/subcon yet"
                        : "Select a vendor or subcontractor first"}
                    </SelectItem>
                  ) : (
                    projectsForSelectedPayee.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Pick a client job from Operations → Projects (masterlist). Jobs
                already used with this payee are listed first when available.
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Tag under existing main PO (sub-PO / extra works)</Label>
              <Select
                value={parentPurchaseOrderId || "none"}
                onValueChange={handleSelectParentPo}
                disabled={!selectedProjectId}
              >
                <SelectTrigger className="h-10 w-full max-w-xl">
                  <SelectValue placeholder={selectedProjectId ? "None — create as main PO" : "Select a project first"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None — create as main PO</SelectItem>
                  {mainPOsForProject.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number}
                      {po.vendors?.name ? ` — ${po.vendors.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="poNumber">
                PO Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="poNumber"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Enter PO number (not auto-generated)"
                className="h-10 font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Enter the official PO number manually. Generation is disabled.
              </p>
            </div>
            <div className="space-y-2"><Label htmlFor="date">Date</Label><Input id="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="projectTitle">Project Title</Label><Input id="projectTitle" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="requisitioner">Requisitioner</Label><Input id="requisitioner" value={requisitioner} onChange={(e) => setRequisitioner(e.target.value)} className="h-10" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="deliverTo">Deliver To</Label><Input id="deliverTo" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} className="h-10" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {selectedPayee?.type === "subcontractor"
                ? "Subcontractor Information"
                : selectedPayee?.type === "supplier"
                  ? "Vendor Information"
                  : "Vendor / Subcontractor Information"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>
                {selectedPayee?.type === "subcontractor" ? "Subcontractor Name" : "Vendor Name"}
              </Label>
              <Input value={vendor.name} onChange={(e) => setVendor((v) => ({ ...v, name: e.target.value }))} className="h-10" />
            </div>
            <div className="space-y-2"><Label>Contact Person</Label><Input value={vendor.contactPerson} onChange={(e) => setVendor((v) => ({ ...v, contactPerson: e.target.value }))} className="h-10" /></div>
            <div className="space-y-2"><Label>TIN</Label><Input value={vendor.tin} onChange={(e) => setVendor((v) => ({ ...v, tin: e.target.value }))} className="h-10" /></div>
            <div className="space-y-2 sm:col-span-2"><Label>Address</Label><Textarea value={vendor.address} onChange={(e) => setVendor((v) => ({ ...v, address: e.target.value }))} rows={3} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={vendor.phone} onChange={(e) => setVendor((v) => ({ ...v, phone: e.target.value }))} className="h-10" /></div>
            <div className="space-y-2"><Label>Email</Label><Input value={vendor.email} onChange={(e) => setVendor((v) => ({ ...v, email: e.target.value }))} className="h-10" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle>Line Items</CardTitle></div>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-2 h-4 w-4" />Add Item</Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {items.map((item, index) => (
              <div key={index} className="grid gap-4 rounded-lg border bg-muted/30 p-4 sm:grid-cols-12">
                <div className="flex items-center gap-2 sm:col-span-1 sm:flex-col sm:items-start">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                  <Button variant="ghost" size="icon" onClick={() => removeItem(index)} disabled={items.length <= 1} className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <div className="space-y-2 sm:col-span-5"><Label>Description</Label><Textarea value={item.description} onChange={(e) => updateItem(index, { description: e.target.value })} rows={4} /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Qty</Label><Input value={item.qty} onChange={(e) => updateItem(index, { qty: e.target.value })} className="h-10" /></div>
                <div className="space-y-2 sm:col-span-2"><Label>Unit Price</Label><Input type="number" min={0} step={0.01} value={item.unitPrice || ""} onChange={(e) => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })} className="h-10" /></div>
                <div className="space-y-2 sm:col-span-2 flex flex-col justify-end"><Label>Total</Label><p className="text-base font-semibold">₱{((parseFloat(String(item.qty)) || 0) * (item.unitPrice || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p></div>
              </div>
            ))}
            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Grand Total</p>
                <p className="text-xl font-bold">₱{items.reduce((sum, it) => sum + (parseFloat(String(it.qty)) || 0) * (it.unitPrice || 0), 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Signatories</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2"><Label>Requested By</Label><Input value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label>Prepared By</Label><Input value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label>Reviewed By</Label><Input value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label>Approved By</Label><Input value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)} className="h-10" /><Input value={approvedByTitle} onChange={(e) => setApprovedByTitle(e.target.value)} placeholder="Title" className="h-9 text-sm" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payment Terms</CardTitle></CardHeader>
          <CardContent>
            <Textarea value={paymentTerms.join("\n")} onChange={(e) => setPaymentTerms(e.target.value.split("\n"))} rows={5} className="font-mono text-sm" />
          </CardContent>
        </Card>
      </div>

      <div ref={printRef} className="sr-only absolute left-[-9999px] top-0" aria-hidden="true">
        <PurchaseOrderPrint data={normalizePOData(poData)} />
      </div>
    </div>
  );

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Loading internal POs...</div>
      </DashboardLayout>
    );
  }

  if (!canReadPurchaseOrders) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          You do not have access to view internal POs.
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout>{view === "list" ? listView : createView}</DashboardLayout>;
}
