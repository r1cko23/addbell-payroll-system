"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/lib/hooks/useProfile";
import type { FundRequestRow } from "@/types/fund-request";
import {
  FUND_REQUEST_FIELD_LABELS,
  FUND_REQUEST_STATUS_LABELS,
  formatFundRequestPercentage,
  getFundRequestReferenceModeLabel,
  isSubcontractorPaymentPurpose,
} from "@/types/fund-request";
import { FundRequestField } from "@/components/fund-request/FundRequestField";
import {
  FundRequestProjectDetailsDisplay,
  shouldShowTopLevelFundRequestPo,
} from "@/components/fund-request/FundRequestProjectDetailsDisplay";
import { FundRequestDetailsSection } from "@/components/fund-request/FundRequestDetailsSection";
import {
  buildFundRequestApprovalUpdates,
  canActOnFundRequest,
  getFundRequestApprovalActionCopy,
  getFundRequestStatusBadgeClass,
} from "@/lib/fund-request-approval";
import {
  canPurchasingOfficerEditDetails,
  createEmptyFundRequestDetail,
  createEmptyFundRequestDeduction,
  saveFundRequestDetails,
  toEditableFundRequestDetailsForm,
  type EditableFundRequestDetail,
  type EditableFundRequestDeduction,
  type EditableFundRequestDetailsForm,
  type FundRequestDetailItem,
} from "@/lib/fund-request-details";
import { normalizeUserRole } from "@/lib/user-roles";
import { Label } from "@/components/ui/label";
import type { FundRequestDocumentSummary } from "@/types/fund-request";
import { FundRequestSupportingDocuments } from "@/components/fund-request/FundRequestSupportingDocuments";
import { FundRequestApprovalHistory } from "@/components/fund-request/FundRequestApprovalHistory";
import { FundRequestBankDetailsFields } from "@/components/fund-request/FundRequestBankDetailsFields";
import { FundRequestBankDetailsDisplay } from "@/components/fund-request/FundRequestBankDetailsDisplay";
import {
  emptyFundRequestBankDetails,
  hasFundRequestBankDetails,
  serializeSupplierBankDetails,
  validateFundRequestBankDetails,
  type FundRequestBankDetailsForm,
} from "@/lib/fund-request-bank-details";
import { resolveFundRequestRequesterInfo } from "@/lib/fund-request-requester";
import { fetchApproverNameMap } from "@/lib/load-approver-names";
import { isSchemaMissingTableOrRelationError } from "@/lib/postgrestSchema";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

const STATUS_LABELS = FUND_REQUEST_STATUS_LABELS;

type ProjectInfo = { name: string; code: string; site_address: string | null; contract_value: number | null };

export function FundRequestApprovalDetail({
  fundRequestId,
  backHref = "/fund-request?tab=inbox",
  backLabel = "← Back to For Approval",
}: {
  fundRequestId: string;
  backHref?: string;
  backLabel?: string;
}) {
  const supabase = createClient();
  const { profile, loading: profileLoading } = useProfile();
  const [request, setRequest] = useState<FundRequestRow | null>(null);
  const [requesterName, setRequesterName] = useState<string>("");
  const [requesterUserId, setRequesterUserId] = useState<string | null>(null);
  const [requesterIsOperationsManager, setRequesterIsOperationsManager] =
    useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  const [vendorName, setVendorName] = useState<string>("");
  const [approverNames, setApproverNames] = useState<Record<string, string>>({});
  const [editableDetails, setEditableDetails] = useState<EditableFundRequestDetail[]>([
    createEmptyFundRequestDetail(),
  ]);
  const [editableDeductions, setEditableDeductions] = useState<
    EditableFundRequestDeduction[]
  >([]);
  const [savingDetails, setSavingDetails] = useState(false);
  const [documents, setDocuments] = useState<FundRequestDocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [supplierBankDetails, setSupplierBankDetails] =
    useState<FundRequestBankDetailsForm>(emptyFundRequestBankDetails());

  useEffect(() => {
    const id = fundRequestId;
    if (!id) return;
    (async () => {
      const { data: req, error } = await supabase
        .from("fund_requests")
        .select(
          "*, employees ( employee_id, first_name, last_name, full_name, user_id )"
        )
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
      const form = toEditableFundRequestDetailsForm(
        row.details as FundRequestDetailItem[] | null
      );
      setEditableDetails(form.items);
      setEditableDeductions(form.deductions);
      const approverIds = [
        row.project_manager_approved_by,
        row.purchasing_officer_approved_by,
        row.management_approved_by,
        row.rejected_by,
      ].filter(Boolean) as string[];

      const [requesterInfo, approverNameMap] = await Promise.all([
        resolveFundRequestRequesterInfo(supabase, row.requested_by),
        approverIds.length > 0
          ? fetchApproverNameMap(approverIds)
          : Promise.resolve({} as Record<string, string>),
      ]);

      const joinedEmployee = (
        row as FundRequestRow & {
          employees?: {
            employee_id: string;
            first_name: string | null;
            last_name: string | null;
            full_name: string | null;
          } | null;
        }
      ).employees;
      const joinedRequesterName = joinedEmployee
        ? [joinedEmployee.first_name, joinedEmployee.last_name]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          joinedEmployee.full_name?.trim() ||
          joinedEmployee.employee_id
        : "";

      setRequesterName(requesterInfo.name || joinedRequesterName || "Unknown requester");
      setRequesterUserId(requesterInfo.userId);
      setRequesterIsOperationsManager(requesterInfo.isOperationsManager);

      setApproverNames(approverNameMap);

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
  }, [fundRequestId, supabase]);

  const canAct = Boolean(
    request &&
      profile?.id &&
      canActOnFundRequest(profile.role, request.status)
  );
  const showPurchasingBankField =
    normalizeUserRole(profile?.role) === "purchasing_officer" &&
    request?.status === "project_manager_approved";
  const approvalActionCopy = getFundRequestApprovalActionCopy(
    profile?.role,
    request?.status
  );

  const handleApprove = async () => {
    if (!request || !profile?.id) return;

    try {
      if (canPurchasingOfficerEditDetails(profile.role, request.status)) {
        const cleaned = await saveFundRequestDetails(
          supabase,
          request.id,
          editableDetails,
          editableDeductions
        );
        setRequest({
          ...request,
          details: cleaned.details,
          total_requested_amount: cleaned.total,
        });
        const form = toEditableFundRequestDetailsForm(cleaned.details);
        setEditableDetails(form.items);
        setEditableDeductions(form.deductions);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save line items."
      );
      return;
    }

    if (showPurchasingBankField) {
      const bankValidationError = validateFundRequestBankDetails(supplierBankDetails);
      if (bankValidationError) {
        toast.error(bankValidationError);
        return;
      }
    }

    const updates = buildFundRequestApprovalUpdates(request.status, profile.id, {
      supplierBankDetails: showPurchasingBankField
        ? serializeSupplierBankDetails(supplierBankDetails)
        : null,
    });
    if (!updates) return;

    setActing(true);
    const { error } = await supabase
      .from("fund_requests")
      .update(updates as never)
      .eq("id", request.id);
    setActing(false);

    if (error) {
      toast.error("Failed to approve");
      return;
    }

    const nextStatus = updates.status as FundRequestRow["status"];
    toast.success(
      nextStatus === "management_approved"
        ? "Fund request fully approved."
        : "Approved. Moved to next step."
    );
    setRequest({
      ...request,
      ...updates,
      status: nextStatus,
    } as FundRequestRow);
  };

  const handleReject = async () => {
    if (!request || !profile?.id) return;
    if (!rejectReason.trim()) {
      toast.error("Please enter a rejection reason.");
      return;
    }

    setRejecting(true);
    const { error } = await supabase
      .from("fund_requests")
      .update({
        status: "rejected",
        rejected_by: profile.id,
        rejected_at: new Date().toISOString(),
        rejection_reason: rejectReason.trim(),
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", request.id);
    setRejecting(false);

    if (error) {
      toast.error("Failed to reject");
      return;
    }

    toast.success("Fund request rejected.");
    setRequest({
      ...request,
      status: "rejected",
      rejected_by: profile.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: rejectReason.trim(),
    });
    setShowRejectForm(false);
  };

  const canEditPurchasingDetails = canPurchasingOfficerEditDetails(
    profile?.role,
    request?.status
  );

  const handleSaveDetails = async (form: EditableFundRequestDetailsForm) => {
    if (!request) return;

    setSavingDetails(true);
    try {
      const cleaned = await saveFundRequestDetails(
        supabase,
        request.id,
        form.items,
        form.deductions
      );
      setRequest({
        ...request,
        details: cleaned.details,
        total_requested_amount: cleaned.total,
        updated_at: new Date().toISOString(),
      });
      const nextForm = toEditableFundRequestDetailsForm(cleaned.details);
      setEditableDetails(nextForm.items);
      setEditableDeductions(nextForm.deductions);
      toast.success("Line items updated.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save line items."
      );
    } finally {
      setSavingDetails(false);
    }
  };

  if (loading || profileLoading)
    return <div className="animate-pulse h-8 w-48 bg-slate-200 rounded" />;
  if (!request) {
    return (
      <div className="space-y-4">
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          {backLabel}
        </Link>
        <p className="text-destructive">Fund request not found.</p>
      </div>
    );
  }

  const details = (request.details as FundRequestDetailItem[] | null) ?? [];
  const referenceModeLabel = getFundRequestReferenceModeLabel(request.reference_mode);
  const showSubcontractorFields = isSubcontractorPaymentPurpose(request.purpose);

  return (
    <div className={cn(dbPageWrapper)}>
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        {backLabel}
      </Link>
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Fund request</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground">
              Requested by {requesterName} on{" "}
              {format(new Date(request.request_date), "MMMM d, yyyy")}
            </p>
            <Badge
              variant="outline"
              className={cn("w-fit", getFundRequestStatusBadgeClass(request.status))}
            >
              {STATUS_LABELS[request.status] ?? request.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <FundRequestField
            label={FUND_REQUEST_FIELD_LABELS.purpose}
            value={request.purpose}
          />
          <FundRequestField
            label={FUND_REQUEST_FIELD_LABELS.referenceBasis}
            value={referenceModeLabel}
          />

            {projectInfo && (
              <div className="rounded-lg border bg-blue-50 dark:bg-blue-950/20 p-4">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Linked Project — Budget Context</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Project:</span>
                    <p className="font-medium uppercase">{projectInfo.code} — {projectInfo.name}</p>
                  </div>
                  {projectInfo.site_address && (
                    <div>
                      <span className="text-muted-foreground">Location:</span>
                      <p className="uppercase">{projectInfo.site_address}</p>
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
              {shouldShowTopLevelFundRequestPo(request) ? (
                <FundRequestField
                  label={FUND_REQUEST_FIELD_LABELS.poNumber}
                  value={request.po_number ?? "—"}
                />
              ) : null}
              <FundRequestProjectDetailsDisplay request={request} />
              {showSubcontractorFields ? (
                <>
                  <FundRequestField
                    label={FUND_REQUEST_FIELD_LABELS.subcontractorName}
                    value={vendorName || "—"}
                  />
                  <FundRequestField
                    label={FUND_REQUEST_FIELD_LABELS.subcontractorProgress}
                    value={formatFundRequestPercentage(
                      request.subcontractor_progress_completion_percentage
                    )}
                  />
                </>
              ) : null}
            </div>
            <FundRequestDetailsSection
              details={details}
              totalRequestedAmount={request.total_requested_amount}
              editable={canEditPurchasingDetails}
              saving={savingDetails}
              editableDetails={editableDetails}
              editableDeductions={editableDeductions}
              onEditableDetailsChange={setEditableDetails}
              onEditableDeductionsChange={setEditableDeductions}
              onSave={handleSaveDetails}
            />
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
            {showPurchasingBankField ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <FundRequestBankDetailsFields
                  value={supplierBankDetails}
                  onChange={setSupplierBankDetails}
                  idPrefix="supplier-bank"
                />
              </div>
            ) : hasFundRequestBankDetails(request.supplier_bank_details) ? (
              <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
                <FundRequestBankDetailsDisplay
                  value={request.supplier_bank_details}
                />
              </div>
            ) : null}
            <FundRequestSupportingDocuments documents={documents} />
            <FundRequestApprovalHistory
              request={request}
              requesterName={requesterName}
              requesterUserId={requesterUserId}
              requesterIsOperationsManager={requesterIsOperationsManager}
              approverNames={approverNames}
            />
            {request.status === "rejected" && request.rejection_reason && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
                <FundRequestField
                  label="Rejection Reason"
                  value={request.rejection_reason}
                  className="[&_h4]:text-destructive"
                />
              </div>
            )}

            {canAct ? (
              <div
                className={cn(
                  "rounded-lg border p-4 space-y-4",
                  approvalActionCopy.urgent
                    ? "border-primary/50 bg-primary/10"
                    : "border-primary/20 bg-primary/5"
                )}
              >
                <div>
                  {approvalActionCopy.eyebrow ? (
                    <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                      {approvalActionCopy.eyebrow}
                    </p>
                  ) : null}
                  <h4
                    className={cn(
                      "font-semibold",
                      approvalActionCopy.urgent
                        ? "mt-1 text-lg uppercase tracking-wide text-destructive"
                        : "text-sm text-foreground"
                    )}
                  >
                    {approvalActionCopy.title}
                  </h4>
                  {approvalActionCopy.description ? (
                    <p
                      className={cn(
                        "mt-1 text-sm",
                        approvalActionCopy.urgent
                          ? "text-foreground/90"
                          : "text-muted-foreground"
                      )}
                    >
                      {approvalActionCopy.description}
                    </p>
                  ) : null}
                </div>

                {showRejectForm ? (
                  <div className="space-y-2">
                    <Label htmlFor="reject_reason">Rejection reason</Label>
                    <Input
                      id="reject_reason"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason"
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="destructive"
                        disabled={rejecting}
                        onClick={handleReject}
                      >
                        {rejecting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          "Confirm Reject"
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={rejecting}
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectReason("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button disabled={acting} onClick={handleApprove}>
                      {acting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={acting}
                      onClick={() => setShowRejectForm(true)}
                    >
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
      </Card>
    </div>
  );
}
