"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import { normalizePOData } from "@/utils/po-format";
import { usePermissions } from "@/lib/hooks/usePermissions";

const emptyVendor: PurchaseOrderVendor = { name: "", contactPerson: "", tin: "", address: "", phone: "", email: "" };
const emptyItem = (n: number): PurchaseOrderLineItem => ({ itemNo: n, description: "", qty: "", unitPrice: 0, totalAmount: 0 });

const STORAGE_KEY_PREFIX = "po_sequence";

function deriveProjectCode(title: string): string {
  const skip = new Set(["a", "an", "the", "and", "at", "in", "of", "for", "&"]);
  return title.trim().split(/\s+/).filter((w) => w.length > 0 && !skip.has(w.toLowerCase())).map((w) => w[0]).join("").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function deriveVendorCode(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "";
  if (first.length <= 6) return first.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return first.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function generatePONumber(projectCode: string, vendorCode: string): string {
  const year = new Date().getFullYear();
  const key = `${STORAGE_KEY_PREFIX}_${projectCode}_${vendorCode}_${year}`;
  let seq = 1;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(key);
      if (stored) seq = Math.max(1, parseInt(stored, 10) + 1);
      localStorage.setItem(key, String(seq));
    } catch { /* ignore */ }
  }
  return `${(projectCode || "PROJ").slice(0, 6)}-${(vendorCode || "VEND").slice(0, 6)}-${year}-${String(seq).padStart(4, "0")}`;
}

interface VendorRecord { id: string; name: string; contact_person: string | null; tin: string | null; address: string | null; phone: string | null; email: string | null }
interface ProjectRecord { id: string; name: string; code: string; site_address: string | null }
interface PORow {
  id: string; po_number: string; po_date: string; status: string; subtotal: number; total_amount: number;
  vendor_id: string; project_id: string | null; project_title: string | null;
  vendors: { name: string } | null;
  projects: { name: string; code: string } | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary", approved: "default", posted: "default", cancelled: "destructive",
};

export default function PurchaseOrderPage() {
  const supabase = createClient();
  const { canCreate, canRead, loading: permissionsLoading } = usePermissions();
  const [view, setView] = useState<"list" | "create">("list");
  const canReadPurchaseOrders = canRead("purchase_orders");
  const canCreatePurchaseOrders = canCreate("purchase_orders");

  // ----- LIST STATE -----
  const [poList, setPoList] = useState<PORow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchPOList = useCallback(async () => {
    setListLoading(true);
    const { data, error } = await supabase
      .from("purchase_orders")
      .select("id, po_number, po_date, status, subtotal, total_amount, vendor_id, project_id, project_title, created_at, vendors ( name ), projects ( name, code )")
      .order("created_at", { ascending: false });
    if (!error) setPoList((data as unknown as PORow[]) ?? []);
    setListLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (permissionsLoading || !canReadPurchaseOrders) return;
    fetchPOList();
  }, [canReadPurchaseOrders, fetchPOList, permissionsLoading]);

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
        || (po.vendors?.name || "").toLowerCase().includes(term)
        || (po.projects?.name || po.project_title || "").toLowerCase().includes(term);
      if (!match) return false;
    }
    return true;
  });

  // ----- CREATE FORM STATE -----
  const printRef = useRef<HTMLDivElement>(null);
  const [vendors, setVendors] = useState<VendorRecord[]>([]);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
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

  useEffect(() => {
    if (view !== "create" || !canCreatePurchaseOrders) return;
    (async () => {
      const [vRes, pRes] = await Promise.all([
        supabase.from("vendors").select("id, name, contact_person, tin, address, phone, email").eq("is_active", true).order("name"),
        supabase.from("projects").select("id, name, code, site_address").order("name"),
      ]);
      if (!vRes.error) setVendors((vRes.data as VendorRecord[]) || []);
      if (!pRes.error) setProjects((pRes.data as ProjectRecord[]) || []);
    })();
  }, [supabase, view]);

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
    const v = vendors.find((x) => x.id === id);
    if (v) setVendor({ name: v.name, contactPerson: v.contact_person ?? "", tin: v.tin ?? "", address: v.address ?? "", phone: v.phone ?? "", email: v.email ?? "" });
  }, [vendors]);

  const handleSelectProject = useCallback((id: string) => {
    setSelectedProjectId(id);
    const p = projects.find((x) => x.id === id);
    if (p) {
      setProjectTitle(p.name);
      setDeliverTo((prev) => prev.trim() ? prev : (p.site_address || ""));
    }
  }, [projects]);

  const projectCode = deriveProjectCode(projectTitle);
  const vendorCode = deriveVendorCode(vendor.name);

  const handleGeneratePONumber = useCallback(() => {
    const generated = generatePONumber(projectCode || "PROJ", vendorCode || "VEND");
    setPoNumber(generated);
    toast.success(`Generated: ${generated}`);
  }, [projectCode, vendorCode]);

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
    if (!selectedProjectId) { toast.error("Select a project before saving PO."); return; }
    if (!selectedVendorId) { toast.error("Select a vendor before saving PO."); return; }
    if (!poNumber.trim()) { toast.error("Generate a PO number first."); return; }

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
      const { data: poRow, error: poError } = await supabase.from("purchase_orders").insert({
        company_id: companyId, project_id: selectedProjectId, vendor_id: selectedVendorId,
        po_number: normalized.poNumber, po_date: new Date().toISOString().slice(0, 10), po_date_text: normalized.date,
        status: "draft", requisitioner: normalized.requisitioner, requested_by: normalized.requestedBy || normalized.requisitioner,
        prepared_by: normalized.preparedBy, reviewed_by: normalized.reviewedBy || "",
        approved_by: normalized.approvedBy, approved_by_title: normalized.approvedByTitle,
        project_title: normalized.projectTitle, deliver_to: normalized.deliverTo,
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

      toast.success("Purchase order saved.");
      setView("list");
      fetchPOList();
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
  }, [canCreatePurchaseOrders, poData, poNumber, selectedProjectId, selectedVendorId, supabase, fetchPOList]);

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
      toast.error("Generate a PO number first");
      return;
    }
    toast.success("Opening print dialog. Choose “Save as PDF” to match the print format.");
    handlePrint();
  }, [handlePrint, poNumber]);

  // ========== LIST VIEW ==========
  const listView = (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
          <PageSubtitle className="mt-1">
            {canCreatePurchaseOrders ? "Create, view, and manage purchase orders." : "View purchase orders."}
          </PageSubtitle>
        </div>
        {canCreatePurchaseOrders ? (
          <Button onClick={() => setView("create")}><Plus className="h-4 w-4 mr-2" />New PO</Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search PO#, vendor, project..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : filteredPOs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {searchTerm || statusFilter !== "all" ? "No POs match your filters." : "No purchase orders yet."}
            </div>
          ) : (
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
                      <td className="px-4 py-3 max-w-[180px] truncate">{po.vendors?.name ?? "—"}</td>
                      <td className="px-4 py-3 max-w-[180px] truncate">{po.projects?.name || po.project_title || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">₱{Number(po.total_amount).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_COLORS[po.status] ?? "secondary"} className="text-xs capitalize">{po.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/purchase-order/${po.id}`} className="text-primary font-medium hover:underline text-sm">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // ========== CREATE VIEW (existing form) ==========
  const createView = (
    <div className="min-w-0 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setView("list")}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">New Purchase Order</h1>
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
              <Label>Quick fill from existing</Label>
              <div className="flex flex-wrap gap-3">
                <Select value={selectedProjectId} onValueChange={handleSelectProject}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select project..." /></SelectTrigger>
                  <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={selectedVendorId} onValueChange={handleSelectVendor}>
                  <SelectTrigger className="w-[220px]"><SelectValue placeholder="Select vendor..." /></SelectTrigger>
                  <SelectContent>{vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="poNumber">PO Number</Label>
                <Input id="poNumber" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="e.g. PROJ-VEND-2026-0001" className="h-10 font-mono" />
              </div>
              <Button type="button" variant="outline" onClick={handleGeneratePONumber} className="shrink-0"><Hash className="mr-2 h-4 w-4" />Generate</Button>
            </div>
            <div className="space-y-2"><Label htmlFor="date">Date</Label><Input id="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="projectTitle">Project Title</Label><Input id="projectTitle" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} className="h-10" /></div>
            <div className="space-y-2"><Label htmlFor="requisitioner">Requisitioner</Label><Input id="requisitioner" value={requisitioner} onChange={(e) => setRequisitioner(e.target.value)} className="h-10" /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="deliverTo">Deliver To</Label><Input id="deliverTo" value={deliverTo} onChange={(e) => setDeliverTo(e.target.value)} className="h-10" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vendor Information</CardTitle></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label>Vendor Name</Label><Input value={vendor.name} onChange={(e) => setVendor((v) => ({ ...v, name: e.target.value }))} className="h-10" /></div>
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
