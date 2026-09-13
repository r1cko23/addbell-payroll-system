"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { useSuppliersForPO } from "@/lib/hooks/useVendors";
import { useActiveClients } from "@/lib/hooks/useClients";
import {
  formatPoYearMonth,
  nextInternalPoNumber,
} from "@/lib/internal-po-number";
import {
  formatPoDateText,
  issuedAtFromPoDateText,
} from "@/lib/purchase-order-date";
import { purchaseOrderPrintFileName, purchaseOrderPrintHtmlTitle } from "@/lib/purchase-order-print-filename";
import {
  MANUAL_PAYMENT_TERMS_VALUE,
  PURCHASE_ORDER_PAYMENT_TERM_OPTIONS,
  paymentTermsFromSelectValue,
  paymentTermsToSelectValue,
} from "@/lib/purchase-order-payment-terms";
import { PoMasterlistJobPicker } from "@/components/purchase-order/PoMasterlistJobPicker";
import { PoDateInput } from "@/components/purchase-order/PoDateInput";
import { VendorFormDialog } from "@/components/vendor-directory/VendorFormDialog";
import type { VendorRecord } from "@/components/vendor-directory/vendor-directory-config";
import {
  FOR_COMPLETION_OF_DETAILS,
  buildInternalPoMasterlistLink,
  catalogProjectIdForInternalPo,
  fillInternalPurchaseOrderFromMasterlistJob,
  internalPoLinkLabel,
  internalPoSaveError,
  purchaseOrderVendorLabel,
} from "@/lib/purchase-order-job-fill";
import type { PoMasterlistJob } from "@/types/po-masterlist";
import { useSessionLoader } from "@/lib/hooks/useSessionLoader";
import { useProfile } from "@/lib/hooks/useProfile";
import { bustCache } from "@/lib/cache-client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
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
import { Printer, Plus, Trash2, FileDown, Hash, Save, Search, ArrowLeft, List } from "lucide-react";
import { toast } from "sonner";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { normalizePOData } from "@/utils/po-format";
import { primaryVendorEmail, primaryVendorPhone } from "@/lib/vendor-contacts";

const emptyVendor: PurchaseOrderVendor = { name: "", contactPerson: "", tin: "", address: "", phone: "", email: "" };
const emptyItem = (n: number): PurchaseOrderLineItem => ({ itemNo: n, description: "", qty: "", unitPrice: 0, totalAmount: 0 });

interface PORow {
  id: string; po_number: string; po_date: string; status: string; subtotal: number; total_amount: number;
  vendor_id: string | null; project_id: string | null; project_title: string | null;
  vendors: { name: string } | null;
  vendor_snapshot: { name?: string | null } | null;
  projects: { name: string; code: string } | null;
  masterlist_link_status: "linked" | "needs_review" | null;
  masterlist_link_note: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary", approved: "default", posted: "default", cancelled: "destructive",
};

export default function PurchaseOrderPage() {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const { canCreate, canRead, loading: permissionsLoading } = usePermissions();
  const [view, setView] = useState<"list" | "create">("list");
  const canReadPurchaseOrders = canRead("purchase_orders");
  const canCreatePurchaseOrders = canCreate("purchase_orders");
  const canCreateVendors = canCreate("vendors");

  // ----- LIST STATE -----
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const userId = profile?.id ?? null;
  const poListCacheKey =
    userId && canReadPurchaseOrders && !permissionsLoading
      ? `purchase-orders:${userId}`
      : null;

  const loadPOList = useCallback(async () => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, po_date, status, subtotal, total_amount, vendor_id, project_id, project_title, masterlist_link_status, masterlist_link_note, created_at, vendor_snapshot, vendors ( name ), projects ( name, code )")
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
  });
  const poList = poListData ?? [];
  const listLoading = profileLoading || permissionsLoading || poListLoading;

  useEffect(() => {
    if (!canCreatePurchaseOrders && view === "create") {
      setView("list");
    }
  }, [canCreatePurchaseOrders, view]);

  const filteredPOs = poList.filter((po) => {
    if (statusFilter !== "all" && po.status !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const match = (po.po_number || "").toLowerCase().includes(term)
        || (purchaseOrderVendorLabel(po).toLowerCase().includes(term))
        || (po.projects?.name || po.project_title || "").toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  // ----- CREATE FORM STATE -----
  const printRef = useRef<HTMLDivElement>(null);
  const vendorCardRef = useRef<HTMLDivElement>(null);
  const paymentTermsInputRef = useRef<HTMLTextAreaElement>(null);
  const poReferenceEnabled = view === "create" && canCreatePurchaseOrders;
  const { data: vendors = [], refetch: refetchVendors } = useSuppliersForPO({
    enabled: poReferenceEnabled,
  });
  const [addVendorOpen, setAddVendorOpen] = useState(false);
  const { data: clients = [] } = useActiveClients({ enabled: poReferenceEnabled });
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedJob, setSelectedJob] = useState<PoMasterlistJob | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClientPoCode, setSelectedClientPoCode] = useState("");
  const [poNumber, setPoNumber] = useState("");
  const [isGeneratingPoNumber, setIsGeneratingPoNumber] = useState(false);
  const [date, setDate] = useState(() => formatPoDateText(new Date()));
  const [vendor, setVendor] = useState<PurchaseOrderVendor>(emptyVendor);
  const [requisitioner, setRequisitioner] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [deliverTo, setDeliverTo] = useState("");
  const [items, setItems] = useState<PurchaseOrderLineItem[]>([emptyItem(1)]);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [paymentTermsManual, setPaymentTermsManual] = useState(false);
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

  const applyVendorRecord = useCallback((
    record: {
      id: string;
      name: string;
      contact_person?: string | null;
      tin?: string | null;
      address?: string | null;
      phones?: string[] | null;
      phone?: string | null;
      emails?: string[] | null;
      email?: string | null;
    }
  ) => {
    setSelectedVendorId(record.id);
    setVendor({
      name: record.name,
      contactPerson: record.contact_person ?? "",
      tin: record.tin ?? "",
      address: record.address ?? "",
      phone: primaryVendorPhone(record.phones, record.phone),
      email: primaryVendorEmail(record.emails, record.email),
    });
  }, []);

  const handleSelectVendor = useCallback((id: string) => {
    const v = vendors.find((x) => x.id === id);
    if (v) applyVendorRecord(v);
  }, [applyVendorRecord, vendors]);

  const handleAddVendor = useCallback(() => {
    if (!canCreateVendors) {
      toast.error("You do not have permission to add vendors.");
      return;
    }
    setAddVendorOpen(true);
  }, [canCreateVendors]);

  const handleVendorCreated = useCallback(async (record: VendorRecord) => {
    applyVendorRecord(record);
    await refetchVendors();
    vendorCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [applyVendorRecord, refetchVendors]);

  const handleSelectClient = useCallback((id: string) => {
    setSelectedClientId(id);
    const client = clients.find((row) => row.id === id);
    setSelectedClientPoCode(client?.client_code?.trim() ?? "");
  }, [clients]);

  const handleSelectJob = useCallback((job: PoMasterlistJob | null) => {
    if (!job) {
      setSelectedJob(null);
      setSelectedClientId("");
      setSelectedClientPoCode("");
      return;
    }
    const fill = fillInternalPurchaseOrderFromMasterlistJob(job);
    setSelectedJob(job);
    setSelectedClientId(
      job.client_id && clients.some((row) => row.id === job.client_id)
        ? job.client_id
        : ""
    );
    setSelectedClientPoCode("");
    setProjectTitle(fill.projectTitle);
    setDeliverTo(fill.deliverTo);
    if (fill.paymentTerms) {
      setPaymentTerms(fill.paymentTerms);
      setPaymentTermsManual(
        paymentTermsToSelectValue(fill.paymentTerms) === MANUAL_PAYMENT_TERMS_VALUE
      );
    }
    if (job.client_id) {
      const known = clients.find((row) => row.id === job.client_id);
      if (known?.client_code?.trim()) {
        setSelectedClientPoCode(known.client_code.trim());
        return;
      }
      void supabase
        .from("clients")
        .select("client_code")
        .eq("id", job.client_id)
        .maybeSingle()
        .then(({ data }) => {
          setSelectedClientPoCode(data?.client_code?.trim() ?? "");
        });
    }
  }, [clients, supabase]);

  const handleGeneratePONumber = useCallback(async () => {
    const clientPoCode = selectedClientPoCode.trim();
    if (!clientPoCode) {
      toast.error("Select a client with a PO code first.");
      return;
    }
    setIsGeneratingPoNumber(true);
    try {
      const issuedAt = issuedAtFromPoDateText(date);
      const yearMonth = formatPoYearMonth(issuedAt);
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("po_number")
        .ilike("po_number", `ADDPO-${yearMonth}-%`);
      if (error) throw error;
      const generated = nextInternalPoNumber({
        issuedAt,
        clientPoCode,
        existingPoNumbers: (data ?? []).map((row) => row.po_number),
      });
      setPoNumber(generated);
      toast.success(`Generated: ${generated}`);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to generate PO number.";
      toast.error(message);
    } finally {
      setIsGeneratingPoNumber(false);
    }
  }, [date, selectedClientPoCode, supabase]);

  const poData: PurchaseOrder = {
    poNumber, date, vendor, requisitioner, company: DEFAULT_COMPANY, projectTitle, deliverTo,
    items: items.map((it, i) => ({ ...it, itemNo: i + 1, totalAmount: (parseFloat(String(it.qty)) || 0) * (it.unitPrice || 0) })),
    paymentTerms, requestedBy: requestedBy.trim() || requisitioner, preparedBy, reviewedBy, approvedBy, approvedByTitle,
    printTimestamp: new Date().toISOString(),
  };

  const handleSaveAndPost = useCallback(async () => {
    if (!canCreatePurchaseOrders) {
      toast.error("You only have view access to purchase orders.");
      return;
    }
    const saveError = internalPoSaveError({
      vendorId: selectedVendorId,
      vendorName: vendor.name,
      poNumber,
      projectTitle,
      selectedJob,
    });
    if (saveError) {
      toast.error(saveError);
      return;
    }

    setIsSavingPO(true);
    try {
      let catalogProjectId: string | null = null;
      if (selectedJob) {
        let catalogIdByPoCode: string | null = null;
        if (!selectedJob.project_id && selectedJob.po_number.trim()) {
          const { data: catalogMatch } = await supabase
            .from("projects")
            .select("id")
            .eq("code", selectedJob.po_number.trim())
            .maybeSingle();
          catalogIdByPoCode = catalogMatch?.id ?? null;
        }
        catalogProjectId = catalogProjectIdForInternalPo(
          selectedJob,
          catalogIdByPoCode
        );
        if (!catalogProjectId) {
          toast.error(
            "This job isn't linked to a catalog project yet. Open Projects, save the job once, then retry."
          );
          return;
        }
      }
      const masterlistLink = buildInternalPoMasterlistLink(selectedJob);

      let companyId: string | null = null;
      const { data: co } = await supabase.from("companies").select("id").limit(1).single();
      companyId = co?.id ?? null;

      const normalized = normalizePOData({ ...poData, printTimestamp: new Date().toISOString() });
      const itemsPayload = normalized.items.map((it) => ({
        description: it.description, qty_text: it.qty, quantity: parseFloat(String(it.qty)) || 0,
        unit_price: it.unitPrice, line_total: it.totalAmount,
      }));

      const subtotal = itemsPayload.reduce((s, it) => s + it.line_total, 0);
      const { data: poRow, error: poError } = await supabase.from("purchase_orders").insert({
        company_id: companyId, project_id: catalogProjectId, vendor_id: selectedVendorId,
        po_number: normalized.poNumber, po_date: new Date().toISOString().slice(0, 10), po_date_text: normalized.date,
        status: "draft", requisitioner: normalized.requisitioner, requested_by: normalized.requestedBy || normalized.requisitioner,
        prepared_by: normalized.preparedBy, reviewed_by: normalized.reviewedBy || "",
        approved_by: normalized.approvedBy, approved_by_title: normalized.approvedByTitle,
        project_title: normalized.projectTitle, deliver_to: normalized.deliverTo,
        vendor_snapshot: normalized.vendor, company_snapshot: normalized.company,
        payment_terms: normalized.paymentTerms, print_timestamp: normalized.printTimestamp,
        subtotal, vat_amount: 0, total_amount: subtotal,
        ...masterlistLink,
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

      toast.success(
        selectedJob
          ? "Purchase order saved."
          : `Purchase order saved as ${FOR_COMPLETION_OF_DETAILS}.`
      );
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
  }, [canCreatePurchaseOrders, poData, poNumber, selectedJob, selectedVendorId, vendor.name, projectTitle, supabase, refreshPOList]);

  const handlePrint = useCallback(() => {
    if (!printRef.current) { toast.error("Print content not ready."); return; }
    const printContent = printRef.current.innerHTML;
    if (!printContent || printContent.trim().length < 100) { toast.error("Print content not loaded."); return; }
    const printNameInput = { poNumber, vendorName: vendor.name };
    const fileName = purchaseOrderPrintFileName(printNameInput);
    const previousTitle = document.title;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    setIsPrinting(true);
    document.title = fileName;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) { document.title = previousTitle; document.body.removeChild(iframe); setIsPrinting(false); return; }
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><base href="${origin}/" /><title>${purchaseOrderPrintHtmlTitle(printNameInput)}</title>
      <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style>*{box-sizing:border-box}body{font-family:'Plus Jakarta Sans',sans-serif;margin:0;padding:0;font-size:11px;color:#1e293b}img{max-width:240px;height:auto}table{width:100%;border-collapse:collapse;font-size:9px;table-layout:fixed}@page{size:A4;margin:12mm}@media print{body{margin:0;padding:0}.po-print-root{max-width:186mm!important;width:100%!important;padding:0 8mm!important}.po-table-header th{background:#e8e8e8!important}}</style>
      </head><body>${printContent}</body></html>`);
    doc.close();
    const printWin = iframe.contentWindow;
    if (!printWin) { document.title = previousTitle; document.body.removeChild(iframe); setIsPrinting(false); return; }
    const images = doc.querySelectorAll("img");
    Promise.all(Array.from(images).map((img) => img.complete ? Promise.resolve() : new Promise<void>((r) => { img.onload = () => r(); img.onerror = () => r(); setTimeout(r, 500); }))).then(() => {
      setTimeout(() => { printWin.focus(); printWin.print(); const cleanup = () => { document.title = previousTitle; if (iframe.parentNode) document.body.removeChild(iframe); setIsPrinting(false); }; printWin.onafterprint = cleanup; setTimeout(cleanup, 3000); }, 200);
    });
  }, [poNumber, vendor.name]);

  // Keep PDF output identical to the on-screen Print template by reusing the same
  // HTML-based print iframe (user can choose “Save as PDF” in the print dialog).
  const handleDownloadPDF = useCallback(() => {
    if (!poNumber.trim()) {
      toast.error("Generate a PO number first");
      return;
    }
    toast.success("Opening print dialog. Choose “Save as PDF” to match the print format.");
    handlePrint();
  }, [handlePrint, poNumber]);

  const openCreateView = useCallback(() => {
    setSelectedVendorId("");
    setSelectedJob(null);
    setSelectedClientId("");
    setSelectedClientPoCode("");
    setPoNumber("");
    setIsGeneratingPoNumber(false);
    setDate(formatPoDateText(new Date()));
    setVendor(emptyVendor);
    setRequisitioner("");
    setProjectTitle("");
    setDeliverTo("");
    setItems([emptyItem(1)]);
    setPaymentTerms(DEFAULT_PAYMENT_TERMS);
    setPaymentTermsManual(false);
    setRequestedBy("");
    setPreparedBy("JOSEFINA E. CONTE");
    setReviewedBy("");
    setApprovedBy("DIOSDADO B. LEONARDO");
    setApprovedByTitle("President");
    setAddVendorOpen(false);
    setView("create");
  }, []);

  // ========== LIST VIEW ==========
  const listView = (
    <div className={cn("min-w-0 w-full", dbPageWrapper)}>
      <DashboardPageHeader
        title="Purchase orders"
        description={
          canCreatePurchaseOrders
            ? "Create, view, and manage purchase orders."
            : "View purchase orders."
        }
        actions={
          canCreatePurchaseOrders ? (
            <div className={dbHeaderActions}>
              <Button onClick={openCreateView} className={dbHeaderButton}>
                <Plus className="h-4 w-4 mr-2" />
                New PO
              </Button>
            </div>
          ) : undefined
        }
      />
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search PO#, vendor, project..."
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
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredPOs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? "No POs match your filters." : "No purchase orders yet."}
            </div>
          ) : (
            <>
              <DbMobileBlock className="p-4 pt-0">
                <div className="space-y-2">
                  {filteredPOs.map((po) => (
                    <div
                      key={po.id}
                      className="rounded-lg border border-border/80 bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-xs text-muted-foreground">{po.po_number}</p>
                          <p className="text-sm font-medium text-foreground">
                            {format(new Date(po.po_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1">
                          <Badge variant={STATUS_COLORS[po.status] ?? "secondary"} className="shrink-0 text-xs capitalize">
                            {po.status}
                          </Badge>
                          {internalPoLinkLabel({
                            masterlist_link_status: po.masterlist_link_status,
                            masterlist_link_note: po.masterlist_link_note,
                          }) === FOR_COMPLETION_OF_DETAILS ? (
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {FOR_COMPLETION_OF_DETAILS}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="mt-2 space-y-1">
                        <DashboardMobileField label="Vendor" value={purchaseOrderVendorLabel(po)} />
                        <DashboardMobileField
                          label="Project"
                          value={po.projects?.name || po.project_title || "—"}
                        />
                        <DashboardMobileField
                          label="Amount"
                          value={`₱${Number(po.total_amount).toLocaleString()}`}
                        />
                      </div>
                      <Link href={`/purchase-order/${po.id}`} className="mt-3 block">
                        <Button variant="outline" className={cn(dbHeaderButton, "w-full")}>
                          View
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              </DbMobileBlock>
              <DbDesktopBlock>
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 font-medium">PO Number</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Vendor</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium text-right">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map((po) => (
                    <tr key={po.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-sm">{po.po_number}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{format(new Date(po.po_date), "MMM d, yyyy")}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate">{purchaseOrderVendorLabel(po)}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate">{po.projects?.name || po.project_title || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">₱{Number(po.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant={STATUS_COLORS[po.status] ?? "secondary"} className="text-xs capitalize">{po.status}</Badge>
                          {internalPoLinkLabel({
                            masterlist_link_status: po.masterlist_link_status,
                            masterlist_link_note: po.masterlist_link_note,
                          }) === FOR_COMPLETION_OF_DETAILS ? (
                            <Badge variant="outline" className="text-xs">
                              {FOR_COMPLETION_OF_DETAILS}
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/purchase-order/${po.id}`} className="text-primary font-medium hover:underline text-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
              </DbDesktopBlock>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ========== CREATE VIEW (existing form) ==========
  const createView = (
    <div className={cn("min-w-0 w-full", dbPageWrapper)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New purchase order</h1>
            <PageSubtitle className="mt-0.5">Create a PO with Addbell branding.</PageSubtitle>
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
          <CardHeader><CardTitle>PO & Project</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Link project</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
                <PoMasterlistJobPicker
                  selectedJob={selectedJob}
                  onSelect={handleSelectJob}
                  enabled={poReferenceEnabled}
                />
                <Select value={selectedClientId} onValueChange={handleSelectClient}>
                  <SelectTrigger className="w-full sm:w-[240px]"><SelectValue placeholder="Select client..." /></SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.client_code
                          ? `${client.client_code} · ${client.name}`
                          : client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex w-full flex-col items-start gap-1.5 sm:w-[220px]">
                  <Select value={selectedVendorId} onValueChange={handleSelectVendor}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                    <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                  </Select>
                  {canCreateVendors ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-800 underline-offset-2 hover:underline"
                      onClick={handleAddVendor}
                    >
                      Enter vendor manually
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {selectedJob
                  ? "This internal PO will be linked to the selected project."
                  : `If there is no client P.O. yet, saving tags this PO "${FOR_COMPLETION_OF_DETAILS}" so it can be linked when the project exists.`}
              </p>
            </div>
            <div className="space-y-2 sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="poNumber">PO Number</Label>
                <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. ADDPO-2609-0101" className="h-10 font-mono" />
              </div>
              <Button type="button" variant="outline" onClick={handleGeneratePONumber} disabled={isGeneratingPoNumber} className="shrink-0">
                <Hash className="mr-2 h-4 w-4" />{isGeneratingPoNumber ? "Generating..." : "Generate"}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground sm:col-span-2 -mt-2">
              Generate uses ADDPO-YYMM, the client PO code, then a sequence that continues for that month (01, 02, …).
            </p>
            <div className="space-y-2"><Label htmlFor="date">Date</Label><PoDateInput id="date" value={date} onChange={setDate} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="projectTitle">Project Title</Label><Input id="projectTitle" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="requisitioner">Requisitioner</Label><Input id="requisitioner" value={requisitioner} onChange={(e) => setRequisitioner(e.target.value)} className="h-10" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="deliverTo">Deliver To</Label><Input id="deliverTo" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} className="h-10" /></div>
          </CardContent>
        </Card>

        <Card ref={vendorCardRef}>
          <CardHeader><CardTitle>Vendor Information</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {selectedVendorId ? (
              <>
                <div>
                  <span className="text-muted-foreground text-xs">Vendor name</span>
                  <p className="font-medium">{vendor.name || "—"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground text-xs">Contact person</span>
                    <p>{vendor.contactPerson || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">TIN</span>
                    <p>{vendor.tin || "—"}</p>
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Address</span>
                  <p className="whitespace-pre-wrap">{vendor.address || "—"}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground text-xs">Phone</span>
                    <p>{vendor.phone || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Email</span>
                    <p>{vendor.email || "—"}</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                Select a vendor or use Enter vendor manually to add one. These details are copied from the vendor record.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div><CardTitle>Line Items</CardTitle></div>
            <Button variant="outline" size="sm" onClick={addItem}><Plus className="mr-2 h-4 w-4" />Add item</Button>
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
                <p className="text-sm text-muted-foreground">Grand total</p>
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
          <CardContent className="space-y-3">
            <div className="flex flex-col items-start gap-1.5">
              <Select
                key={paymentTermsManual ? "manual" : "preset"}
                value={
                  paymentTermsManual
                    ? undefined
                    : paymentTermsToSelectValue(paymentTerms) || undefined
                }
                onValueChange={(value) => {
                  setPaymentTermsManual(false);
                  setPaymentTerms(paymentTermsFromSelectValue(value, []));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select payment terms..." />
                </SelectTrigger>
                <SelectContent>
                  {PURCHASE_ORDER_PAYMENT_TERM_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option} className="whitespace-normal">
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                className="text-xs font-medium text-sky-800 underline-offset-2 hover:underline"
                onClick={() => {
                  setPaymentTermsManual(true);
                  if (paymentTermsToSelectValue(paymentTerms) !== MANUAL_PAYMENT_TERMS_VALUE) {
                    setPaymentTerms([]);
                  }
                  window.setTimeout(() => paymentTermsInputRef.current?.focus(), 50);
                }}
              >
                Enter payment terms manually
              </button>
            </div>
            {paymentTermsManual ? (
              <Textarea
                ref={paymentTermsInputRef}
                value={paymentTerms.join("\n")}
                onChange={(e) => setPaymentTerms(e.target.value.split("\n"))}
                rows={4}
                placeholder="Type payment terms…"
                className="font-mono text-sm"
              />
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div ref={printRef} className="sr-only absolute left-[-9999px] top-0" aria-hidden="true">
        <PurchaseOrderPrint data={normalizePOData(poData)} />
      </div>

      <VendorFormDialog
        vendorType="supplier"
        open={addVendorOpen}
        onOpenChange={setAddVendorOpen}
        onSaved={handleVendorCreated}
      />
    </div>
  );

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">Loading purchase orders...</div>
      </DashboardLayout>
    );
  }

  if (!canReadPurchaseOrders) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center text-muted-foreground">
          You do not have access to view purchase orders.
        </div>
      </DashboardLayout>
    );
  }

  return <DashboardLayout>{view === "list" ? listView : createView}</DashboardLayout>;
}
