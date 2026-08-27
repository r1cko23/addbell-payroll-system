"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";
import { ArrowLeft, Calendar, DollarSign, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dbHeaderButton, dbPageWrapper, dbStatusBadge } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  normalizePoNumberKey,
  isStrongPoNumberKey,
} from "@/lib/purchase-order-masterlist-link";
import type { PoMasterlistJob } from "@/types/po-masterlist";

type FundRequestBrief = {
  id: string;
  purpose: string;
  total_requested_amount: number;
  status: string;
  request_date: string;
  po_number: string | null;
};

type POBrief = {
  id: string;
  po_number: string;
  total_amount: number;
  status: string;
  po_date: string;
  vendors: { name: string } | null;
};

function formatLabel(s: string): string {
  return s.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getFundRequestBadgeVariant(
  status: string
): "default" | "secondary" | "destructive" {
  if (status === "management_approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
}

function money(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `₱${Number(value).toLocaleString()}`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const jobId = params.id as string;
  const supabase = createClient();
  const router = useRouter();
  const { isHR, loading: roleLoading } = useUserRole();
  const { canRead } = usePermissions();

  const [job, setJob] = useState<PoMasterlistJob | null>(null);
  const [fundRequests, setFundRequests] = useState<FundRequestBrief[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<POBrief[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roleLoading && isHR) {
      toast.error("Projects are not available for HR.");
      router.replace("/dashboard?type=workforce");
    }
  }, [roleLoading, isHR, router]);

  const fetchJobData = useCallback(async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      const { data: jobRow, error } = await supabase
        .from("po_masterlist_jobs")
        .select("*")
        .eq("id", jobId)
        .maybeSingle();

      if (error) throw error;
      if (!jobRow) {
        setJob(null);
        setFundRequests([]);
        setPurchaseOrders([]);
        return;
      }

      const masterlistJob = jobRow as PoMasterlistJob;
      setJob(masterlistJob);

      const poKey = normalizePoNumberKey(masterlistJob.po_number);
      const frPromise =
        isStrongPoNumberKey(poKey)
          ? supabase
              .from("fund_requests")
              .select(
                "id, purpose, total_requested_amount, status, request_date, po_number"
              )
              .ilike("po_number", `%${masterlistJob.po_number.replace(/^PO-?/i, "").slice(0, 20)}%`)
              .order("created_at", { ascending: false })
              .limit(100)
          : Promise.resolve({ data: [] as FundRequestBrief[], error: null });

      const [frRes, poRes] = await Promise.all([
        frPromise,
        supabase
          .from("purchase_orders")
          .select(
            "id, po_number, total_amount, status, po_date, vendors ( name )"
          )
          .eq("po_masterlist_job_id", jobId)
          .order("created_at", { ascending: false }),
      ]);

      const frRows = ((frRes.data ?? []) as FundRequestBrief[]).filter((row) => {
        const key = normalizePoNumberKey(row.po_number);
        return key && key === poKey;
      });

      setFundRequests(frRows);
      setPurchaseOrders((poRes.data as unknown as POBrief[]) ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load project job");
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [jobId, supabase]);

  useEffect(() => {
    void fetchJobData();
  }, [fetchJobData]);

  const totalFundRequestAmount = useMemo(
    () =>
      fundRequests
        .filter((row) => row.status !== "rejected")
        .reduce((sum, row) => sum + Number(row.total_requested_amount || 0), 0),
    [fundRequests]
  );

  if (loading || roleLoading) {
    return (
      <DashboardLayout>
        <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />
      </DashboardLayout>
    );
  }

  if (isHR || !canRead("projects")) {
    return (
      <DashboardLayout>
        <div className={cn("w-full", dbPageWrapper)}>
          <p className="text-sm text-muted-foreground">
            You do not have access to Projects.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (!job) {
    return (
      <DashboardLayout>
        <div className={cn("w-full", dbPageWrapper)}>
          <Link href="/projects">
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Project job not found
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("min-w-0 w-full space-y-6", dbPageWrapper)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Link href="/projects">
              <Button variant="ghost" className={dbHeaderButton}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold tracking-tight">
                {job.project_title || "Untitled job"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {[job.po_number, job.client_name].filter(Boolean).join(" · ") ||
                  "Masterlist job"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {job.project_status ? (
              <Badge variant="secondary" className={dbStatusBadge}>
                {job.project_status}
              </Badge>
            ) : null}
            {job.payment_status ? (
              <Badge variant="outline" className={dbStatusBadge}>
                {job.payment_status}
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <DollarSign className="h-4 w-4" />
                Client P.O. amount
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{money(job.po_amount)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fund requests (matched by P.O.)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {money(totalFundRequestAmount)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {fundRequests.length} request
                {fundRequests.length === 1 ? "" : "s"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Internal POs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{purchaseOrders.length}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Job details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Client P.O. number</Label>
                <p className="mt-1 font-mono font-medium">{job.po_number || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Client</Label>
                <p className="mt-1">{job.client_name || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  <MapPin className="mr-1 inline h-4 w-4" />
                  Location
                </Label>
                <p className="mt-1">{job.location || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  <Calendar className="mr-1 inline h-4 w-4" />
                  P.O. dates
                </Label>
                <p className="mt-1">
                  {[
                    job.po_date
                      ? `PO ${format(new Date(job.po_date), "MMM d, yyyy")}`
                      : null,
                    job.po_received_date
                      ? `Received ${format(
                          new Date(job.po_received_date),
                          "MMM d, yyyy"
                        )}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Payment terms</Label>
                <p className="mt-1">{job.payment_terms || "—"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Invoice numbers</Label>
                <p className="mt-1">{job.invoice_numbers || "—"}</p>
              </div>
              {job.general_remarks ? (
                <div className="md:col-span-2">
                  <Label className="text-muted-foreground">Remarks</Label>
                  <p className="mt-1 whitespace-pre-wrap">{job.general_remarks}</p>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fund requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {fundRequests.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No fund requests match this client P.O. number.
              </p>
            ) : (
              <>
                <DbMobileBlock className="space-y-2 p-4">
                  {fundRequests.map((request) => (
                    <Link
                      key={request.id}
                      href={`/fund-request/${request.id}`}
                      className="block rounded-lg border p-3 hover:bg-muted/40"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {request.purpose}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(request.request_date), "MMM d, yyyy")}
                          </p>
                        </div>
                        <Badge
                          variant={getFundRequestBadgeVariant(request.status)}
                          className={dbStatusBadge}
                        >
                          {formatLabel(request.status)}
                        </Badge>
                      </div>
                      <p className="mt-2 font-medium tabular-nums">
                        {money(request.total_requested_amount)}
                      </p>
                    </Link>
                  ))}
                </DbMobileBlock>
                <DbDesktopBlock>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Purpose</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fundRequests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(request.request_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/fund-request/${request.id}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {request.purpose}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {money(request.total_requested_amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getFundRequestBadgeVariant(request.status)}
                              className={dbStatusBadge}
                            >
                              {formatLabel(request.status)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </DbDesktopBlock>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Internal purchase orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {purchaseOrders.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No internal POs linked to this masterlist job.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell>
                        <Link
                          href={`/purchase-order/${po.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {po.po_number}
                        </Link>
                      </TableCell>
                      <TableCell>{po.vendors?.name || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {money(po.total_amount)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={dbStatusBadge}>
                          {formatLabel(po.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
