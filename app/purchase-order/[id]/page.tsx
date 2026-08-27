"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

interface PODetail {
  id: string;
  po_number: string;
  po_date: string;
  po_date_text: string | null;
  status: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  requisitioner: string | null;
  requested_by: string | null;
  prepared_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  approved_by_title: string | null;
  project_title: string | null;
  deliver_to: string | null;
  payment_terms: string[] | null;
  vendor_snapshot: Record<string, string> | null;
  company_snapshot: Record<string, string> | null;
  created_at: string;
  vendors: { name: string; contact_person: string | null; tin: string | null; address: string | null; phone: string | null; email: string | null } | null;
  projects: { name: string; code: string; site_address: string | null } | null;
}

interface POItem {
  id: string;
  line_no: number;
  description: string;
  quantity: number;
  qty_text: string | null;
  unit: string | null;
  unit_price: number;
  line_total: number;
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive"> = {
  draft: "secondary", approved: "default", posted: "default", cancelled: "destructive",
};

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const supabase = createClient();
  const { canRead, canUpdate, loading: permissionsLoading } = usePermissions();
  const [po, setPo] = useState<PODetail | null>(null);
  const [items, setItems] = useState<POItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const canReadPurchaseOrders = canRead("purchase_orders");
  const canManageStatus = canUpdate("purchase_orders");

  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    (async () => {
      const [poRes, itemsRes] = await Promise.all([
        supabase.from("purchase_orders").select("*, vendors ( name, contact_person, tin, address, phone, email ), projects ( name, code, site_address )").eq("id", id).single(),
        supabase.from("purchase_order_items").select("*").eq("purchase_order_id", id).order("line_no"),
      ]);
      if (!poRes.error && poRes.data) setPo(poRes.data as PODetail);
      if (!itemsRes.error && itemsRes.data) setItems(itemsRes.data as POItem[]);
      setLoading(false);
    })();
  }, [params?.id, supabase]);

  const handleStatusChange = async (newStatus: string) => {
    if (!canManageStatus) {
      toast.error("You only have view access to purchase orders.");
      return;
    }
    if (!po) return;
    setActing(true);
    const { error } = await supabase.from("purchase_orders").update({ status: newStatus, updated_at: new Date().toISOString() } as never).eq("id", po.id);
    if (error) { toast.error("Failed to update status."); } else {
      toast.success(`PO status updated to ${newStatus}.`);
      setPo((prev) => prev ? { ...prev, status: newStatus } : prev);
    }
    setActing(false);
  };

  if (permissionsLoading || loading) return <DashboardLayout><div className="animate-pulse h-8 w-48 bg-slate-200 rounded" /></DashboardLayout>;
  if (!canReadPurchaseOrders) return (
    <DashboardLayout>
      <div className="space-y-4">
        <Link href="/purchase-order" className="text-muted-foreground hover:text-foreground text-sm">← Back</Link>
        <p className="text-muted-foreground">You do not have access to view purchase orders.</p>
      </div>
    </DashboardLayout>
  );
  if (!po) return (
    <DashboardLayout>
      <div className="space-y-4">
        <Link href="/purchase-order" className="text-muted-foreground hover:text-foreground text-sm">← Back</Link>
        <p className="text-destructive">Purchase order not found.</p>
      </div>
    </DashboardLayout>
  );

  const vendorInfo = po.vendor_snapshot?.name ? po.vendor_snapshot : (po.vendors ? { name: po.vendors.name, contactPerson: po.vendors.contact_person ?? "", tin: po.vendors.tin ?? "", address: po.vendors.address ?? "", phone: po.vendors.phone ?? "", email: po.vendors.email ?? "" } : null);

  return (
    <DashboardLayout>
      <div className={cn("w-full max-w-4xl", dbPageWrapper)}>
        <Link href="/purchase-order" className="text-muted-foreground hover:text-foreground text-sm">← Back to Purchase Orders</Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">{po.po_number}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Created {format(new Date(po.created_at), "MMMM d, yyyy")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={STATUS_COLORS[po.status] ?? "secondary"} className="text-sm capitalize">{po.status}</Badge>
            {canManageStatus && po.status === "draft" && (
              <Button size="sm" onClick={() => handleStatusChange("approved")} disabled={acting}>
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
              </Button>
            )}
            {canManageStatus && po.status === "approved" && (
              <Button size="sm" onClick={() => handleStatusChange("posted")} disabled={acting}>
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post to Costs"}
              </Button>
            )}
            {canManageStatus && (po.status === "draft" || po.status === "approved") && (
              <Button size="sm" variant="destructive" onClick={() => handleStatusChange("cancelled")} disabled={acting}>
                Cancel PO
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Project & Delivery</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <span className="text-muted-foreground text-xs uppercase">Project</span>
                <p className="font-medium">{po.projects ? `${po.projects.code} — ${po.projects.name}` : po.project_title || "—"}</p>
                {po.projects?.site_address && <p className="text-muted-foreground">{po.projects.site_address}</p>}
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase">Deliver To</span>
                <p>{po.deliver_to || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase">PO Date</span>
                <p>{po.po_date_text || format(new Date(po.po_date), "MMM d, yyyy")}</p>
              </div>
              <div>
                <span className="text-muted-foreground text-xs uppercase">Requisitioner</span>
                <p>{po.requisitioner || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Vendor</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {vendorInfo ? (
                <>
                  <p className="font-medium">{vendorInfo.name}</p>
                  {vendorInfo.contactPerson && <p className="text-muted-foreground">Contact: {vendorInfo.contactPerson}</p>}
                  {vendorInfo.tin && <p className="text-muted-foreground">TIN: {vendorInfo.tin}</p>}
                  {vendorInfo.address && <p>{vendorInfo.address}</p>}
                  <div className="flex gap-4">
                    {vendorInfo.phone && <p>{vendorInfo.phone}</p>}
                    {vendorInfo.email && <p>{vendorInfo.email}</p>}
                  </div>
                </>
              ) : <p className="text-muted-foreground">No vendor info</p>}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Line Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-4 py-2 text-left font-medium w-12">#</th>
                  <th className="px-4 py-2 text-left font-medium">Description</th>
                  <th className="px-4 py-2 text-right font-medium w-24">Qty</th>
                  <th className="px-4 py-2 text-right font-medium w-32">Unit Price</th>
                  <th className="px-4 py-2 text-right font-medium w-32">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">No line items</td></tr>
                ) : items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="px-4 py-2">{item.line_no}</td>
                    <td className="px-4 py-2">{item.description}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{item.qty_text || item.quantity}</td>
                    <td className="px-4 py-2 text-right tabular-nums">₱{Number(item.unit_price).toLocaleString()}</td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">₱{Number(item.line_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-right font-medium">Subtotal</td>
                  <td className="px-4 py-2 text-right tabular-nums font-medium">₱{Number(po.subtotal).toLocaleString()}</td>
                </tr>
                {po.vat_amount > 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-2 text-right font-medium">VAT</td>
                    <td className="px-4 py-2 text-right tabular-nums">₱{Number(po.vat_amount).toLocaleString()}</td>
                  </tr>
                )}
                <tr className="font-bold">
                  <td colSpan={4} className="px-4 py-2 text-right">Total Amount</td>
                  <td className="px-4 py-2 text-right tabular-nums">₱{Number(po.total_amount).toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {(po.payment_terms && po.payment_terms.length > 0) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Payment Terms</CardTitle></CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {po.payment_terms.map((term, i) => <li key={i}>{term}</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-base">Signatories</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div><span className="text-muted-foreground text-xs uppercase">Requested By</span><p className="font-medium mt-1">{po.requested_by || po.requisitioner || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs uppercase">Prepared By</span><p className="font-medium mt-1">{po.prepared_by || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs uppercase">Reviewed By</span><p className="font-medium mt-1">{po.reviewed_by || "—"}</p></div>
              <div><span className="text-muted-foreground text-xs uppercase">Approved By</span><p className="font-medium mt-1">{po.approved_by || "—"}</p>{po.approved_by_title && <p className="text-muted-foreground text-xs">{po.approved_by_title}</p>}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
