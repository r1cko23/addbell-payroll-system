"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/lib/hooks/useProfile";
import type { FundRequestRow } from "@/types/fund-request";
import { getFundRequestReferenceModeLabel, formatFundRequestPercentage } from "@/types/fund-request";
import type { FundRequestDocumentSummary } from "@/types/fund-request";
import { FundRequestSupportingDocuments } from "@/components/fund-request/FundRequestSupportingDocuments";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending (Operations Manager)",
  project_manager_approved: "Approved by Operations Manager (Purchasing Officer)",
  purchasing_officer_approved: "Approved by Purchasing Officer (Upper Management)",
  management_approved: "Approved by Upper Management",
  rejected: "Rejected",
};

type DetailItem = { description?: string; amount?: number };
type ProjectInfo = { name: string; code: string; site_address: string | null; contract_value: number | null };
type EditableDetailItem = { description: string; amount: string };

function createEmptyDetailItem(): EditableDetailItem {
  return { description: "", amount: "" };
}

export default function FundRequestApprovalDetailPage() {
  const params = useParams();
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>("");
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});
  const [editableDetails, setEditableDetails] = useState<EditableDetailItem[]>([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [documents, setDocuments] = useState<FundRequestDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = params?.id as string;
    if (!id) return;
    (async () => {
      const { data: req, error } = await supabase
        .from("fund_requests")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !req) {
        setRequest(null);
        setLoading(false);
        return;
      }
      const row = req as FundRequestRow;
      setRequest(row);
      setVendorName("");
      const nextDetails = ((row.details as DetailItem[] | null) ?? []).map((item) => ({
        description: item.description ?? "",
        amount:
          item.amount != null && Number.isFinite(Number(item.amount))
            ? String(item.amount)
            : "",
      }));
      setEditableDetails(
        nextDetails.length > 0
          ? nextDetails
          : [createEmptyDetailItem()]
      );

      const [empRes, profilesRes] = await Promise.all([
        supabase.from("employees").select("first_name, last_name, employee_code").eq("id", row.requested_by).single(),
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", [row.project_manager_approved_by, row.purchasing_officer_approved_by, row.management_approved_by, row.rejected_by].filter(Boolean) as string[]),
      ]);

      const e = empRes.data as { first_name?: string; last_name?: string; employee_code?: string } | null;
      setRequesterName(e ? [e.first_name, e.last_name].filter(Boolean).join(" ") : row.requested_by);

      const names: Record<string, string> = {};
      (profilesRes.data ?? []).forEach((p: { id: string; full_name: string | null }) => {
        names[p.id] = (p.full_name || p.id).trim() || "—";
      });
      setApproverNames(names);

      if (row.project_id) {
        const { data: proj } = await supabase.from("projects").select("name, code, site_address, contract_value").eq("id", row.project_id).single();
        if (proj) setProjectInfo(proj as ProjectInfo);
      }

      if (row.vendor_id) {
        const { data: vendor } = await supabase
          .from("vendors")
          .select("name")
          .eq("id", row.vendor_id)
          .single();
        setVendorName((vendor as { name?: string } | null)?.name ?? "");
      }

      const { data: docRows, error: docsError } = await supabase
        .from("fund_request_documents")
        .select("id, fund_request_id, employee_id, file_name, file_type, file_size, created_at")
        .eq("fund_request_id", row.id)
        .order("created_at", { ascending: true });
      if (docsError) {
        if (!isSchemaMissingTableOrRelationError(docsError)) {
          console.error("fund_request_documents load:", docsError);
        }
      } else {
        setDocuments((docRows as FundRequestDocumentSummary[]) ?? []);
      }

      setLoading(false);
    })();
  }, [params?.id, supabase]);

  const canEditPurchasingDetails =
    profile?.role === "purchasing_officer" &&
    request?.status === "project_manager_approved";

  const editableTotalRequested = editableDetails.reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  const handleDetailChange = (
    index: number,
    field: keyof EditableDetailItem,
    value: string
  ) => {
    setEditableDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleAddDetailRow = () => {
    setEditableDetails((prev) => [...prev, createEmptyDetailItem()]);
  };

  const handleRemoveDetailRow = (index: number) => {
    setEditableDetails((prev) => {
      if (prev.length === 1) {
        return [createEmptyDetailItem()];
      }
      return prev.filter((_, rowIndex) => rowIndex !== index);
    });
  };

  const handleSaveDetails = async () => {
    if (!request) return;

    const cleanedDetails = editableDetails
      .filter((item) => item.description.trim() || item.amount.trim())
      .map((item) => ({
        description: item.description.trim() || "—",
        amount: Number(item.amount || 0),
      }));

    if (cleanedDetails.length === 0) {
      toast.error("Add at least one line item before saving.");
      return;
    }

    if (cleanedDetails.some((item) => !Number.isFinite(item.amount) || item.amount < 0)) {
      toast.error("Amounts must be valid positive numbers.");
      return;
    }

    const nextTotal = cleanedDetails.reduce((sum, item) => sum + item.amount, 0);

    setSavingDetails(true);
    const { error } = await supabase
      .from("fund_requests")
      .update({
        details: cleanedDetails,
        total_requested_amount: nextTotal,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", request.id);
    setSavingDetails(false);

    if (error) {
      toast.error(error.message || "Failed to save line items.");
      return;
    }

    setRequest({
      ...request,
      details: cleanedDetails,
      total_requested_amount: nextTotal,
      updated_at: new Date().toISOString(),
    });
    setEditableDetails(
      cleanedDetails.map((item) => ({
        description: item.description,
        amount: String(item.amount),
      }))
    );
    toast.success("Line items updated.");
  };

  if (loading || profileLoading)
    return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  if (!request) {
    return (
      <div className="space-y-4">
        <Link
          href="/fund-request-approval"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Back to approval
        </Link>
        <p className="text-destructive">Fund request not found.</p>
      </div>
    );
  }

  const details = (request.details as DetailItem[] | null) ?? [];
  const referenceModeLabel = getFundRequestReferenceModeLabel(request.reference_mode);

  return (
    <div className={cn("w-full max-w-3xl", dbPageWrapper)}>
      <Link
        href="/fund-request-approval"
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← Back to Fund Request Approval
      </Link>
      <Card>
        <CardHeader>
          <CardTitle>Fund Request (approval view)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Request date:{" "}
            {format(new Date(request.request_date), "MMMM d, yyyy")} · Requested
            by {requesterName}
          </p>
          <Badge
            variant={
              request.status === "management_approved"
                ? "default"
                : request.status === "rejected"
                  ? "destructive"
                  : "secondary"
            }
            className="w-fit"
          >
            {STATUS_LABELS[request.status] ?? request.status}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Purpose
            </h4>
            <p className="mt-1">{request.purpose}</p>
          </div>
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Reference basis
            </h4>
            <p className="mt-1">{referenceModeLabel}</p>
          </div>

            {projectInfo && (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Linked Project — Budget Context</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Project:</span>
                    <p className="font-medium">{projectInfo.code} — {projectInfo.name}</p>
                  </div>
                  {projectInfo.site_address && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <p>{projectInfo.site_address}</p>
                    </div>
                  )}
                  {projectInfo.contract_value != null && (
                    <div>
                      <span className="text-muted-foreground">Contract Value:</span>
                      <p className="font-medium">₱{Number(projectInfo.contract_value).toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">This Request:</span>
                    <p className="font-medium">₱{Number(request.total_requested_amount).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">P.O. Number</h4>
                <p className="mt-1">{request.po_number ?? "—"}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Title</h4>
                <p className="mt-1">{request.project_title ?? "—"}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Project Location</h4>
                <p className="mt-1">{request.project_location ?? "—"}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcontractor</h4>
                <p className="mt-1">{vendorName || "—"}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subcontractor Progress Completion %</h4>
                <p className="mt-1">{formatFundRequestPercentage(request.subcontractor_progress_completion_percentage)}</p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Current Project Completion Percentage</h4>
                <p className="mt-1">{formatFundRequestPercentage(request.current_project_percentage)}</p>
              </div>
              {request.supplier_bank_details && (
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bank details of supplier</h4>
                  <p className="mt-1 whitespace-pre-wrap">{request.supplier_bank_details}</p>
                </div>
              )}
            </div>
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Details of Request</h4>
              {canEditPurchasingDetails ? (
                <div className="space-y-3 rounded-md border p-3">
                  <div className="space-y-2">
                    {editableDetails.map((item, index) => (
                      <div key={index} className="grid grid-cols-[1fr_160px_auto] gap-2">
                        <Input
                          value={item.description}
                          onChange={(e) =>
                            handleDetailChange(index, "description", e.target.value)
                          }
                          placeholder={`Item ${index + 1}`}
                        />
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.amount}
                          onChange={(e) =>
                            handleDetailChange(index, "amount", e.target.value)
                          }
                          placeholder="0.00"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => handleRemoveDetailRow(index)}
                          disabled={savingDetails}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddDetailRow}
                      disabled={savingDetails}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add item
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveDetails}
                      disabled={savingDetails}
                    >
                      {savingDetails ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save line items"
                      )}
                    </Button>
                  </div>
                  <p className="text-sm font-medium">
                    Updated Total Requested Amount: PHP{" "}
                    {editableTotalRequested.toLocaleString("en-PH", {
                      minimumFractionDigits: 2,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Purchasing can adjust line items here before forwarding to Upper Management, such as adding EWT or tax deductions.
                  </p>
                </div>
              ) : (
                <>
                  <table className="w-full text-sm border rounded-md">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left px-3 py-2">Details</th>
                        <th className="text-right px-3 py-2">Amount (PHP)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details.length === 0 ? (
                        <tr><td colSpan={2} className="px-3 py-4 text-muted-foreground text-center">No line items</td></tr>
                      ) : (
                        details.map((item, i) => (
                          <tr key={i} className="border-b last:border-0">
                            <td className="px-3 py-2">{item.description ?? "—"}</td>
                            <td className="px-3 py-2 text-right font-mono">{item.amount != null ? Number(item.amount).toLocaleString() : "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                  <p className="mt-2 font-medium">
                    Total Requested Amount: PHP {Number(request.total_requested_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {request.remarks && (
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Remarks</h4>
                  <p className="mt-1">{request.remarks}</p>
                </div>
              )}
              <div>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Date Needed</h4>
                <p className="mt-1">{request.date_needed ? format(new Date(request.date_needed), "MMM d, yyyy") : "—"}</p>
              </div>
              {request.urgent_reason && (
                <div className="sm:col-span-2">
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Reason for Urgency</h4>
                  <p className="mt-1">{request.urgent_reason}</p>
                </div>
              )}
            </div>
            <FundRequestSupportingDocuments documents={documents} />
            <div className="rounded-lg border bg-muted/20 p-4">
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Approval history</h4>
              <ul className="space-y-2 text-sm">
                {request.project_manager_approved_at && (
                  <li>
                    <span className="font-medium">Operations Manager:</span>{" "}
                    {approverNames[request.project_manager_approved_by ?? ""] ?? "—"} on{" "}
                    {format(new Date(request.project_manager_approved_at), "MMM d, yyyy")} at{" "}
                    {format(new Date(request.project_manager_approved_at), "h:mm a")}
                  </li>
                )}
                {request.purchasing_officer_approved_at && (
                  <li>
                    <span className="font-medium">Purchasing Officer:</span>{" "}
                    {approverNames[request.purchasing_officer_approved_by ?? ""] ?? "—"} on{" "}
                    {format(new Date(request.purchasing_officer_approved_at), "MMM d, yyyy")} at{" "}
                    {format(new Date(request.purchasing_officer_approved_at), "h:mm a")}
                  </li>
                )}
                {request.management_approved_at && (
                  <li>
                    <span className="font-medium">Upper Management:</span>{" "}
                    {approverNames[request.management_approved_by ?? ""] ?? "—"} on{" "}
                    {format(new Date(request.management_approved_at), "MMM d, yyyy")} at{" "}
                    {format(new Date(request.management_approved_at), "h:mm a")}
                  </li>
                )}
                {request.rejected_at && (
                  <li className="text-destructive">
                    <span className="font-medium">Rejected by:</span>{" "}
                    {approverNames[request.rejected_by ?? ""] ?? "—"} on{" "}
                    {format(new Date(request.rejected_at), "MMM d, yyyy")} at{" "}
                    {format(new Date(request.rejected_at), "h:mm a")}
                    {request.rejection_reason && ` — ${request.rejection_reason}`}
                  </li>
                )}
                {!request.project_manager_approved_at && !request.purchasing_officer_approved_at && !request.management_approved_at && !request.rejected_at && (
                  <li className="text-muted-foreground">No approvals yet.</li>
                )}
              </ul>
            </div>
            {request.status === "rejected" && request.rejection_reason && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <h4 className="text-xs font-medium text-destructive uppercase tracking-wide">Rejection reason</h4>
                <p className="mt-1 text-sm">{request.rejection_reason}</p>
              </div>
            )}
          </CardContent>
      </Card>
    </div>
  );
}
