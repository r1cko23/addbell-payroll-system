"use client";

import { useState, useRef, useCallback, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Printer, Plus, Trash2, FileDown, Hash } from "lucide-react";
import { toast } from "sonner";
import { generatePurchaseOrderPDF } from "@/utils/purchase-order-pdf";

const emptyVendor: PurchaseOrderVendor = {
  name: "",
  tin: "",
  address: "",
  phone: "",
  email: "",
};

const emptyItem = (n: number): PurchaseOrderLineItem => ({
  itemNo: n,
  description: "",
  qty: "",
  unitPrice: 0,
  totalAmount: 0,
});

const STORAGE_KEY_PREFIX = "po_sequence";

/** Auto-derive project code from title: first letters of words, max 6 chars */
function deriveProjectCode(title: string): string {
  const skip = new Set(["a", "an", "the", "and", "at", "in", "of", "for", "&"]);
  return title
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && !skip.has(w.toLowerCase()))
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

/** Auto-derive vendor code from name: first token (e.g. AIRT) or first 6 chars */
function deriveVendorCode(name: string): string {
  const first = name.trim().split(/\s+/)[0] || "";
  if (first.length <= 6) return first.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return first.slice(0, 6).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Generate PO: [ProjectCode]-[VendorCode]-[Year]-[Seq] using localStorage sequence */
function generatePONumber(projectCode: string, vendorCode: string): string {
  const year = new Date().getFullYear();
  const key = `${STORAGE_KEY_PREFIX}_${projectCode}_${vendorCode}_${year}`;
  let seq = 1;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(key);
      if (stored) seq = Math.max(1, parseInt(stored, 10) + 1);
      localStorage.setItem(key, String(seq));
    } catch {
      // ignore
    }
  }
  const pc = (projectCode || "PROJ").toUpperCase().slice(0, 6);
  const vc = (vendorCode || "VEND").toUpperCase().slice(0, 6);
  return `${pc}-${vc}-${year}-${String(seq).padStart(4, "0")}`;
}

interface VendorRecord {
  id: string;
  name: string;
  tin: string;
  address: string;
  phone: string;
  email: string;
}

interface ProjectRecord {
  id: string;
  project_name: string;
  project_location: string | null;
  deliver_to: string | null;
}

export default function PurchaseOrderPage() {
  const supabase = createClient();
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
  const [items, setItems] = useState<PurchaseOrderLineItem[]>([
    emptyItem(1),
  ]);
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [preparedBy, setPreparedBy] = useState("JOSEFINA E. CONTE");
  const [approvedBy, setApprovedBy] = useState("DIOSDADO B. LEONARDO");
  const [approvedByTitle, setApprovedByTitle] = useState("President");

  const updateItem = useCallback(
    (index: number, updates: Partial<PurchaseOrderLineItem>) => {
      setItems((prev) => {
        const next = [...prev];
        const item = { ...next[index], ...updates };
        if (updates.qty !== undefined || updates.unitPrice !== undefined) {
          const qtyNum = parseFloat(String(item.qty)) || 0;
          item.totalAmount = qtyNum * (item.unitPrice || 0);
        }
        next[index] = item;
        return next;
      });
    },
    []
  );

  const addItem = useCallback(() => {
    setItems((prev) => [...prev, emptyItem(prev.length + 1)]);
  }, []);

  const removeItem = useCallback((index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((it, i) => ({ ...it, itemNo: i + 1 }));
    });
  }, [items.length]);

  useEffect(() => {
    (async () => {
      const [vRes, pRes] = await Promise.all([
        supabase.from("vendors").select("id, name, tin, address, phone, email").eq("is_active", true).order("name"),
        supabase.from("projects").select("id, project_name, project_location, deliver_to").eq("is_active", true).order("project_name"),
      ]);
      if (!vRes.error) setVendors(vRes.data || []);
      if (!pRes.error) setProjects(pRes.data || []);
    })();
  }, [supabase]);

  // When project selected, prefer vendors linked to that project for the dropdown
  const [projectVendorIds, setProjectVendorIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectVendorIds(new Set());
      return;
    }
    (async () => {
      const { data } = await supabase
        .from("project_vendors")
        .select("vendor_id")
        .eq("project_id", selectedProjectId);
      setProjectVendorIds(new Set((data || []).map((r) => r.vendor_id)));
    })();
  }, [selectedProjectId, supabase]);

  const vendorList = projectVendorIds.size > 0
    ? [...vendors].sort((a, b) => {
        const aIn = projectVendorIds.has(a.id);
        const bIn = projectVendorIds.has(b.id);
        if (aIn && !bIn) return -1;
        if (!aIn && bIn) return 1;
        return a.name.localeCompare(b.name);
      })
    : vendors;

  const handleSelectVendor = useCallback(
    (id: string) => {
      setSelectedVendorId(id);
      const v = vendors.find((x) => x.id === id);
      if (v) {
        setVendor({ name: v.name, tin: v.tin, address: v.address, phone: v.phone, email: v.email });
      }
    },
    [vendors]
  );

  const handleSelectProject = useCallback(
    (id: string) => {
      setSelectedProjectId(id);
      const p = projects.find((x) => x.id === id);
      if (p) {
        setProjectTitle(p.project_name);
        setDeliverTo(p.deliver_to || p.project_location || "");
      }
    },
    [projects]
  );

  // Codes auto-derived from project title and vendor name
  const projectCode = deriveProjectCode(projectTitle);
  const vendorCode = deriveVendorCode(vendor.name);

  const handleGeneratePONumber = useCallback(() => {
    const pc = projectCode || "PROJ";
    const vc = vendorCode || "VEND";
    const generated = generatePONumber(pc, vc);
    setPoNumber(generated);
    toast.success(`Generated: ${generated}`);
  }, [projectCode, vendorCode]);

  const poData: PurchaseOrder = {
    poNumber,
    date,
    vendor,
    requisitioner,
    company: DEFAULT_COMPANY,
    projectTitle,
    deliverTo,
    items: items.map((it, i) => ({
      ...it,
      itemNo: i + 1,
      totalAmount:
        (parseFloat(String(it.qty)) || 0) * (it.unitPrice || 0),
    })),
    paymentTerms,
    preparedBy,
    approvedBy,
    approvedByTitle,
  };

  const [isPrinting, setIsPrinting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handlePrint = useCallback(() => {
    if (!poNumber.trim()) {
      toast.error("Generate a PO number first");
      return;
    }
    if (!printRef.current) return;
    const printContent = printRef.current.innerHTML;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print.");
      return;
    }
    setIsPrinting(true);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <base href="${origin}/" />
          <title>Purchase Order - ${poNumber}</title>
          <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />
          <style>
            * { box-sizing: border-box; }
            body { font-family: 'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 0; font-size: 11px; color: #1e293b; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            img { max-width: 300px; height: auto; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            @media print { body { padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
          </style>
        </head>
        <body>${printContent}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
      setIsPrinting(false);
    }, 300);
  }, [poNumber]);

  const handleDownloadPDF = useCallback(async () => {
    if (!poNumber.trim()) {
      toast.error("Generate a PO number first");
      return;
    }
    setIsDownloading(true);
    try {
      const doc = await generatePurchaseOrderPDF(poData);
      doc.save(`Purchase-Order-${poNumber.replace(/\s/g, "-")}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setIsDownloading(false);
    }
  }, [poData, poNumber]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with logo */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src="/addbell-po-logo.png"
              alt="Addbell Technical Services"
              className="h-12 w-auto object-contain"
            />
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Purchase Order Generator
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Create uniform POs with Addbell branding
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              size="lg"
              onClick={handleDownloadPDF}
              disabled={isDownloading}
            >
              {isDownloading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Generating...
                </span>
              ) : (
                <>
                  <FileDown className="mr-2 h-4 w-4" />
                  Download PDF
                </>
              )}
            </Button>
            <Button onClick={handlePrint} size="lg" disabled={isPrinting}>
              {isPrinting ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Opening...
                </span>
              ) : (
                <>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>PO & Project</CardTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Order identification and delivery location
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-foreground">Quick fill from existing</Label>
                <div className="flex flex-wrap gap-3">
                  <Select
                    value={selectedProjectId}
                    onValueChange={handleSelectProject}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select project..." />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.project_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedVendorId}
                    onValueChange={handleSelectVendor}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select vendor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorList.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {projectVendorIds.has(v.id) ? `${v.name} (project vendor)` : v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2 flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="poNumber" className="text-foreground">
                    PO Number
                  </Label>
                  <Input
                    id="poNumber"
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="PUFB-AIRT-2026-0001"
                    className="h-10 font-mono"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePONumber}
                  className="shrink-0"
                >
                  <Hash className="mr-2 h-4 w-4" />
                  Generate PO Number
                </Button>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-foreground">
                  Date
                </Label>
                <Input
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="Jan. 29, 2026"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="projectTitle" className="text-foreground">
                  Project Title
                </Label>
                <Input
                  id="projectTitle"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  placeholder="Pickup Coffee Filipino Building"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="deliverTo" className="text-foreground">
                  Deliver To
                </Label>
                <Input
                  id="deliverTo"
                  value={deliverTo}
                  onChange={(e) => setDeliverTo(e.target.value)}
                  placeholder="Pickup Coffee In Line Store - One Ayala Makati City"
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Vendor Information</CardTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Supplier and requisitioner details
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vendorName" className="text-foreground">
                  Vendor Name
                </Label>
                <Input
                  id="vendorName"
                  value={vendor.name}
                  onChange={(e) =>
                    setVendor((v) => ({ ...v, name: e.target.value }))
                  }
                  placeholder="AIRT ENGINEERING SERVICES"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorTin" className="text-foreground">
                  TIN
                </Label>
                <Input
                  id="vendorTin"
                  value={vendor.tin}
                  onChange={(e) =>
                    setVendor((v) => ({ ...v, tin: e.target.value }))
                  }
                  placeholder="293 128 460 000000"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requisitioner" className="text-foreground">
                  Requisitioner
                </Label>
                <Input
                  id="requisitioner"
                  value={requisitioner}
                  onChange={(e) => setRequisitioner(e.target.value)}
                  placeholder="JOSEFINA E. CONTE"
                  className="h-10"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vendorAddress" className="text-foreground">
                  Address
                </Label>
                <Textarea
                  id="vendorAddress"
                  value={vendor.address}
                  onChange={(e) =>
                    setVendor((v) => ({ ...v, address: e.target.value }))
                  }
                  placeholder="BLK 6 LOT 26 LONDON ST. VILLA OLYMPIA 1 BRGY. MAHARLIKA SAN PEDRO, LAGUNA"
                  rows={3}
                  className="min-h-[80px] resize-y"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorPhone" className="text-foreground">
                  Phone
                </Label>
                <Input
                  id="vendorPhone"
                  value={vendor.phone}
                  onChange={(e) =>
                    setVendor((v) => ({ ...v, phone: e.target.value }))
                  }
                  placeholder="Mobile: 09063223449"
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vendorEmail" className="text-foreground">
                  Email
                </Label>
                <Input
                  id="vendorEmail"
                  value={vendor.email}
                  onChange={(e) =>
                    setVendor((v) => ({ ...v, email: e.target.value }))
                  }
                  placeholder="airt.engineeringservices@gmail.com"
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>Line Items</CardTitle>
                <p className="text-sm text-muted-foreground font-normal mt-1">
                  Materials and/or services with quantities and prices
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-4 rounded-lg border border-border bg-muted/30 p-4 sm:grid-cols-12 sm:gap-4"
                >
                  <div className="flex items-center gap-2 sm:col-span-1 sm:flex-col sm:items-start">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-sm font-semibold text-primary">
                      {index + 1}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                      disabled={items.length <= 1}
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 sm:col-span-5">
                    <Label className="text-foreground">Description</Label>
                    <Textarea
                      value={item.description}
                      onChange={(e) =>
                        updateItem(index, { description: e.target.value })
                      }
                      placeholder="Civil and Architectural Works (SUPPLY OF LABOR & MATERIALS + CONSUMABLES)..."
                      rows={4}
                      className="min-h-[100px] resize-y"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-foreground">Qty</Label>
                    <Input
                      value={item.qty}
                      onChange={(e) =>
                        updateItem(index, { qty: e.target.value })
                      }
                      placeholder="1 LOT"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label className="text-foreground">Unit Price (Php)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={item.unitPrice || ""}
                      onChange={(e) =>
                        updateItem(index, {
                          unitPrice: parseFloat(e.target.value) || 0,
                        })
                      }
                      placeholder="0.00"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2 flex flex-col justify-end">
                    <Label className="text-foreground">Total</Label>
                    <p className="text-base font-semibold">
                      Php{" "}
                      {(
                        (parseFloat(String(item.qty)) || 0) *
                        (item.unitPrice || 0)
                      ).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </div>
              ))}
              <div className="flex justify-end border-t border-border pt-4">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Grand Total</p>
                  <p className="text-xl font-bold">
                    Php{" "}
                    {items
                      .reduce(
                        (sum, it) =>
                          sum +
                          (parseFloat(String(it.qty)) || 0) * (it.unitPrice || 0),
                        0
                      )
                      .toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signatories</CardTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                Prepared by and approved by
              </p>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="preparedBy" className="text-foreground">
                  Prepared By
                </Label>
                <Input
                  id="preparedBy"
                  value={preparedBy}
                  onChange={(e) => setPreparedBy(e.target.value)}
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">Purchasing</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedBy" className="text-foreground">
                  Approved By
                </Label>
                <Input
                  id="approvedBy"
                  value={approvedBy}
                  onChange={(e) => setApprovedBy(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="approvedByTitle" className="text-foreground">
                  Title
                </Label>
                <Input
                  id="approvedByTitle"
                  value={approvedByTitle}
                  onChange={(e) => setApprovedByTitle(e.target.value)}
                  placeholder="President"
                  className="h-10"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment Terms</CardTitle>
              <p className="text-sm text-muted-foreground font-normal mt-1">
                One term per line
              </p>
            </CardHeader>
            <CardContent>
              <Textarea
                value={paymentTerms.join("\n")}
                onChange={(e) =>
                  setPaymentTerms(
                    e.target.value.split("\n").filter((l) => l.trim())
                  )
                }
                rows={5}
                placeholder="30% Down Payment
30% Progress Billing (after 7 days)
10% Retention (after COC)"
                className="min-h-[120px] resize-y font-mono text-sm"
              />
            </CardContent>
          </Card>
        </div>

        {/* Printable PO - rendered off-screen for print window */}
        <div
          ref={printRef}
          className="sr-only absolute left-[-9999px] top-0"
          aria-hidden="true"
        >
          <PurchaseOrderPrint data={poData} />
        </div>
      </div>
    </DashboardLayout>
  );
}
