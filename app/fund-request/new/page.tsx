"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSubcontractorOptions } from "@/lib/hooks/useVendors";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useOptionalEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { toast } from "sonner";
import { format } from "date-fns";
import { X } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
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
import {
  EmployeeSearchSelect,
  type EmployeeOption,
} from "@/components/EmployeeSearchSelect";
import { resolveLinkedEmployee } from "@/lib/resolveLinkedEmployee";
import {
  epFormCard,
  epFileInput,
  epSubmitRequestButton,
} from "@/lib/employee-portal-ui";
import {
  requestFormCopy,
  requestSupportingDocLabel,
} from "@/lib/employee-portal-request-copy";
import {
  fileToBase64,
  isAllowedRequestDocument,
  MAX_REQUEST_DOCUMENT_SIZE,
  resolveRequestDocumentMimeType,
} from "@/lib/request-supporting-document";
import { cn } from "@/lib/utils";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  type FundRequestReferenceMode,
  FUND_REQUEST_REFERENCE_MODE_LABELS,
  isSubcontractorPaymentPurpose,
} from "@/types/fund-request";
import {
  allowsMultipleFundRequestProjects,
  createEmptyFundRequestProjectRow,
  normalizeFundRequestProjectRows,
  serializeFundRequestProjectDetails,
  validateFundRequestProjectRows,
  type FundRequestProjectDetailRow,
} from "@/lib/fund-request-project-details";
import { FundRequestProjectDetailsFields } from "@/components/fund-request/FundRequestProjectDetailsFields";
import {
  getFundRequestSubmissionWorkflow,
  resolveFundRequestRequesterRouting,
} from "@/lib/fund-request-routing";

const PURPOSE_OPTIONS = [
  "Material Purchase",
  "Subcontractor Payment",
  "Project Funds",
  "Liquidation",
  "Others",
] as const;

const INITIAL_DETAIL_ROWS = 1;
const NOT_APPLICABLE = "N/A";
type PurposeOption = (typeof PURPOSE_OPTIONS)[number];
type ReferenceMode = FundRequestReferenceMode;

type PurposeFieldConfig = {
  referenceCardTitle: string;
  referenceCardDescription: string;
  detailsSectionTitle: string;
  detailsSectionDescription: string;
  detailPlaceholderPrefix: string;
};

type DetailRow = { description: string; amount: string };

function createEmptyDetailRow(): DetailRow {
  return { description: "", amount: "" };
}

function validateDetailRows(rows: DetailRow[]): string | null {
  const hasDescription = rows.some((row) => row.description.trim());
  if (!hasDescription) {
    return "Add at least one item with a description.";
  }

  const amountOnlyRowIndex = rows.findIndex(
    (row) => !row.description.trim() && row.amount.trim()
  );
  if (amountOnlyRowIndex >= 0) {
    return `Item ${amountOnlyRowIndex + 1} must have a description.`;
  }

  const blankRowIndex = rows.findIndex(
    (row) => !row.description.trim() && !row.amount.trim()
  );
  if (blankRowIndex >= 0) {
    return rows.length === 1
      ? "Add at least one item with a description."
      : `Item ${blankRowIndex + 1} is blank. Remove it or complete it.`;
  }

  const invalidAmountIndex = rows.findIndex((row) => {
    if (!row.amount.trim()) return false;
    const amount = Number(row.amount);
    return !Number.isFinite(amount) || amount < 0;
  });
  if (invalidAmountIndex >= 0) {
    return `Item ${invalidAmountIndex + 1} has an invalid amount.`;
  }

  return null;
}

function isNotApplicableValue(value: string): boolean {
  return value.trim().toUpperCase() === NOT_APPLICABLE;
}

function getPurposeFieldConfig(purpose: string): PurposeFieldConfig {
  switch (purpose as PurposeOption) {
    case "Material Purchase":
      return {
        referenceCardTitle: "Client / Project Reference",
        referenceCardDescription:
          "Include client P.O. and project reference when applicable.",
        detailsSectionTitle: "Material details",
        detailsSectionDescription: "List items, quantities, or charges.",
        detailPlaceholderPrefix: "Material item",
      };
    case "Subcontractor Payment":
      return {
        referenceCardTitle: "Client / Project Reference",
        referenceCardDescription:
          "Client P.O., project reference, and vendor billing details.",
        detailsSectionTitle: "Subcontractor billing",
        detailsSectionDescription: "Milestones, scope, or invoice lines.",
        detailPlaceholderPrefix: "Billing item",
      };
    case "Project Funds":
      return {
        referenceCardTitle: "Project Reference",
        referenceCardDescription: "Project reference. Client P.O. optional.",
        detailsSectionTitle: "Fund breakdown",
        detailsSectionDescription: "Where funds will be used.",
        detailPlaceholderPrefix: "Fund item",
      };
    case "Liquidation":
      return {
        referenceCardTitle: "Liquidation Reference",
        referenceCardDescription: "Project or work reference.",
        detailsSectionTitle: "Liquidation details",
        detailsSectionDescription: "Expense breakdown to liquidate.",
        detailPlaceholderPrefix: "Liquidation item",
      };
    case "Others":
      return {
        referenceCardTitle: "Request Reference",
        referenceCardDescription: "Reference for this request.",
        detailsSectionTitle: "Request details",
        detailsSectionDescription: "Itemized costs.",
        detailPlaceholderPrefix: "Request item",
      };
    default:
      return {
        referenceCardTitle: "Reference Details",
        referenceCardDescription: "Select a purpose to show the right fields.",
        detailsSectionTitle: "Details",
        detailsSectionDescription: "Items and amounts.",
        detailPlaceholderPrefix: "Item",
      };
  }
}

function parseRequiredPercentage(
  value: string,
  fieldLabel: string,
  options?: { min?: number; max?: number }
): number {
  const trimmed = value.trim().replace(/%$/, "").trim();

  if (!trimmed) {
    throw new Error(`${fieldLabel} is required.`);
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a valid number.`);
  }

  const min = options?.min ?? 0;
  const max = options?.max ?? 100;
  if (parsed < min || parsed > max) {
    throw new Error(`${fieldLabel} must be between ${min} and ${max}.`);
  }

  return parsed;
}

const FUND_REQUEST_APPROVAL_STREAM =
  "Requester → Operations Manager (if assigned) → Purchasing Officer → Upper Management";

export default function NewFundRequestPage() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const session = useOptionalEmployeeSession();
  const supabase = createClient();
  const [linkedEmployeeId, setLinkedEmployeeId] = useState<string | null>(null);
  const [resolvingLinkedEmployee, setResolvingLinkedEmployee] = useState(false);
  const [requesterEmployees, setRequesterEmployees] = useState<EmployeeOption[]>(
    []
  );
  const [selectedRequesterEmployeeId, setSelectedRequesterEmployeeId] =
    useState<string>("");
  const employeeId =
    session?.employee?.id ??
    linkedEmployeeId ??
    selectedRequesterEmployeeId ??
    null;
  const isPortal = (pathname?.startsWith("/app") || pathname?.startsWith("/employee-portal")) ?? false;
  const base = pathname?.startsWith("/employee-portal") ? "/employee-portal/fund-request" : isPortal ? "/app/fund-request" : "/fund-request";

  const [requesterName, setRequesterName] = useState<string>("");
  const [requestDate, setRequestDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [purposeOption, setPurposeOption] = useState<string>("");
  const [purposeOther, setPurposeOther] = useState("");
  const [referenceMode, setReferenceMode] = useState<ReferenceMode>("client_linked");
  const [poNumber, setPoNumber] = useState("");
  const [projectRows, setProjectRows] = useState<FundRequestProjectDetailRow[]>([
    createEmptyFundRequestProjectRow(),
  ]);
  const [vendorId, setVendorId] = useState("");
  const [subcontractorProgressCompletion, setSubcontractorProgressCompletion] = useState("");
  const [details, setDetails] = useState<DetailRow[]>(() =>
    Array.from({ length: INITIAL_DETAIL_ROWS }, () => createEmptyDetailRow()),
  );
  const [dateNeeded, setDateNeeded] = useState("");
  const [remarks, setRemarks] = useState("");
  const [urgentReason, setUrgentReason] = useState("");
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { data: subcontractors = [] } = useSubcontractorOptions();
  const purposeConfig = useMemo(
    () => getPurposeFieldConfig(purposeOption),
    [purposeOption]
  );
  const isInternalStockReference = referenceMode === "internal_stock";
  const showClientPOField = !isInternalStockReference;
  const showProjectReferenceFields = !isInternalStockReference;
  const showVendorPaymentSection =
    !isInternalStockReference && isSubcontractorPaymentPurpose(purposeOption);
  const allowMultipleProjects = allowsMultipleFundRequestProjects(purposeOption);
  const poPerProject = showClientPOField;

  useEffect(() => {
    if (session?.employee?.full_name) {
      setRequesterName(session.employee.full_name);
      return;
    }
    if (user?.full_name) {
      setRequesterName(user.full_name);
    }
  }, [session?.employee?.full_name, user?.full_name]);

  useEffect(() => {
    if (session?.employee?.id || !user?.id || isPortal) return;
    let active = true;
    setResolvingLinkedEmployee(true);
    resolveLinkedEmployee(supabase, {
      userId: user.id,
      email: user.email,
      fullName: user.full_name,
    }).then((data) => {
      if (!active) return;
      setLinkedEmployeeId(data?.id ?? null);
      const fullName =
        [data?.first_name, data?.last_name].filter(Boolean).join(" ") ||
        data?.full_name ||
        "";
      if (fullName) {
        setRequesterName(fullName);
      }
      setResolvingLinkedEmployee(false);
    });
    return () => {
      active = false;
    };
  }, [isPortal, session?.employee?.id, supabase, user?.email, user?.full_name, user?.id]);

  useEffect(() => {
    if (isPortal || session?.employee?.id || linkedEmployeeId) return;

    supabase
      .from("employees")
      .select("id, employee_id, full_name, first_name, last_name")
      .order("last_name", { ascending: true, nullsFirst: false })
      .order("first_name", { ascending: true, nullsFirst: false })
      .then(({ data }) => setRequesterEmployees((data as EmployeeOption[]) ?? []));
  }, [isPortal, linkedEmployeeId, session?.employee?.id, supabase]);

  useEffect(() => {
    if (!selectedRequesterEmployeeId) return;
    const selectedEmployee = requesterEmployees.find(
      (employee) => employee.id === selectedRequesterEmployeeId
    );
    if (!selectedEmployee) return;

    const nextRequesterName =
      selectedEmployee.full_name ||
      [selectedEmployee.first_name, selectedEmployee.last_name]
        .filter(Boolean)
        .join(" ");

    if (nextRequesterName) {
      setRequesterName(nextRequesterName);
    }
  }, [requesterEmployees, selectedRequesterEmployeeId]);

  useEffect(() => {
    if (referenceMode === "internal_stock") {
      setProjectRows([createEmptyFundRequestProjectRow()]);
      setPoNumber("");
      setVendorId("");
      setSubcontractorProgressCompletion("");
      return;
    }

    setProjectRows((prev) =>
      prev.map((row) => ({
        poNumber: row.poNumber,
        title: isNotApplicableValue(row.title) ? "" : row.title,
        location: isNotApplicableValue(row.location) ? "" : row.location,
        poAmount: row.poAmount,
        completionPercentage: row.completionPercentage,
      }))
    );
  }, [referenceMode]);

  useEffect(() => {
    if (!allowMultipleProjects) {
      setProjectRows((prev) => (prev.length > 0 ? [prev[0]] : [createEmptyFundRequestProjectRow()]));
    }
  }, [allowMultipleProjects]);

  useEffect(() => {
    if (!poPerProject) return;
    setProjectRows((prev) => {
      const row = prev[0] ?? createEmptyFundRequestProjectRow();
      if (row.poNumber.trim() || !poNumber.trim()) {
        return prev.length > 0 ? [row] : [createEmptyFundRequestProjectRow()];
      }
      return [{ ...row, poNumber }];
    });
    setPoNumber("");
  }, [poPerProject]);

  useEffect(() => {
    if (showVendorPaymentSection) return;
    setVendorId("");
    setSubcontractorProgressCompletion("");
  }, [showVendorPaymentSection]);

  const detailAmounts = details.map((d) => (d.amount ? Number(d.amount) : 0));
  const totalRequested = detailAmounts.reduce((a, b) => a + b, 0);

  const updateDetail = (index: number, field: "description" | "amount", value: string) => {
    setDetails((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addDetailRow = () => {
    setDetails((prev) => [...prev, createEmptyDetailRow()]);
  };

  const removeDetailRow = (index: number) => {
    setDetails((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) {
      toast.error("Select your employee record before submitting.");
      return;
    }
    const purposeValue = purposeOption === "Others" ? purposeOther.trim() : purposeOption;
    if (!purposeValue) {
      toast.error(purposeOption === "Others" ? "Please enter the purpose (Others)." : "Please select a purpose.");
      return;
    }
    if (showProjectReferenceFields) {
      const projectValidationError = validateFundRequestProjectRows(projectRows, {
        required: true,
        requirePoPerProject: poPerProject,
      });
      if (projectValidationError) {
        toast.error(projectValidationError);
        return;
      }
    }
    const detailValidationError = validateDetailRows(details);
    if (detailValidationError) {
      toast.error(detailValidationError);
      return;
    }
    if (dateNeeded && !urgentReason.trim()) {
      toast.error("Reason for urgency is required when a date is specified.");
      return;
    }
    const trimmedPoNumber = poNumber.trim();
    if (showClientPOField && !poPerProject && !trimmedPoNumber) {
      toast.error("P.O. Number is required in client-linked mode.");
      return;
    }
    let parsedSubcontractorProgressCompletion: number | null = null;
    if (showVendorPaymentSection && !vendorId) {
      toast.error("Select a subcontractor.");
      return;
    }
    try {
      if (showVendorPaymentSection) {
        parsedSubcontractorProgressCompletion = parseRequiredPercentage(
          subcontractorProgressCompletion,
          "Subcontractor Current Progress Percentage",
          { min: 0, max: 100 }
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid numeric fields.");
      return;
    }
    if (supportingDoc) {
      if (!isAllowedRequestDocument(supportingDoc)) {
        toast.error("Only PDF, DOC, or DOCX files are allowed.");
        return;
      }
      if (supportingDoc.size > MAX_REQUEST_DOCUMENT_SIZE) {
        toast.error("File too large. Max size is 5MB.");
        return;
      }
    }

    setSubmitting(true);
    try {
      const detailsPayload = details
        .filter((d) => d.description.trim())
        .map((d) => ({
          description: d.description.trim(),
          amount: d.amount.trim() ? Number(d.amount) : 0,
        }));

      if (!session?.employee?.id && !linkedEmployeeId && selectedRequesterEmployeeId && user?.id) {
        await supabase
          .from("employees")
          .update({ user_id: user.id })
          .eq("id", selectedRequesterEmployeeId)
          .is("user_id", null);
        setLinkedEmployeeId(selectedRequesterEmployeeId);
      }

      let companyId: string | null = null;
      const { data: emp } = await supabase.from("employees").select("company_id").eq("id", employeeId).single();
      companyId = emp?.company_id ?? null;
      if (!companyId) {
        const { data: companies } = await supabase.from("companies").select("id").limit(1).single();
        companyId = companies?.id ?? null;
      }

      const normalizedProjects = showProjectReferenceFields
        ? normalizeFundRequestProjectRows(projectRows, {
            includePoNumber: poPerProject,
          })
        : [];
      const primaryProject = normalizedProjects[0] ?? null;
      const primaryPoNumber = poPerProject
        ? primaryProject?.po_number ?? null
        : showClientPOField
          ? trimmedPoNumber.toUpperCase() === "N/A"
            ? "N/A"
            : trimmedPoNumber
          : null;

      const requesterRouting = await resolveFundRequestRequesterRouting(
        supabase,
        employeeId
      );
      const workflow = getFundRequestSubmissionWorkflow({
        submitterRole: user?.role,
        isPortal,
        submitterUserId: user?.id ?? null,
        requiresOperationsManagerApproval:
          requesterRouting.requiresOperationsManagerApproval,
      });

      const payload = {
        company_id: companyId,
        reference_mode: referenceMode,
        project_id: null,
        requested_by: employeeId,
        request_date: requestDate,
        purpose: purposeValue,
        po_number: primaryPoNumber,
        project_title: primaryProject?.title ?? null,
        project_location: primaryProject?.location ?? null,
        vendor_id: showVendorPaymentSection ? vendorId : null,
        vendor_po_number: null,
        po_amount: primaryProject?.po_amount ?? null,
        po_amount_percentage: null,
        current_project_percentage: primaryProject?.completion_percentage ?? null,
        project_details: serializeFundRequestProjectDetails(normalizedProjects),
        subcontractor_progress_completion_percentage: parsedSubcontractorProgressCompletion,
        details: detailsPayload,
        total_requested_amount: totalRequested,
        date_needed: dateNeeded || null,
        remarks: remarks.trim() || null,
        urgent_reason: urgentReason.trim() || null,
        status: workflow.status,
        project_manager_approved_by: workflow.project_manager_approved_by,
        project_manager_approved_at: workflow.project_manager_approved_at,
        purchasing_officer_approved_by: workflow.purchasing_officer_approved_by,
        purchasing_officer_approved_at: workflow.purchasing_officer_approved_at,
        management_approved_by: workflow.management_approved_by,
        management_approved_at: workflow.management_approved_at,
      };

      let documentPayload:
        | {
            file_name: string;
            file_type: string;
            file_size: number;
            file_base64: string;
          }
        | null = null;
      if (supportingDoc) {
        documentPayload = {
          file_name: supportingDoc.name,
          file_type: resolveRequestDocumentMimeType(supportingDoc),
          file_size: supportingDoc.size,
          file_base64: await fileToBase64(supportingDoc),
        };
      }

      const createResponse = await fetch("/api/fund-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          is_portal_submission: isPortal,
          document: documentPayload,
        }),
      });
      const createResult = await createResponse.json();

      if (!createResponse.ok || !createResult?.id) {
        throw new Error(createResult?.error || "Failed to submit.");
      }

      const successMessage =
        workflow.status === "pending"
          ? "Fund request submitted."
          : workflow.status === "project_manager_approved"
            ? "Fund request submitted and sent directly to Purchasing Officer."
            : "Fund request submitted and sent directly to Upper Management.";

      if (createResult?.warning) {
        toast.warning(createResult.warning, { description: successMessage });
      } else {
        toast.success(successMessage);
      }
      setSupportingDoc(null);
      setDocError(null);
      router.push(base);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit.");
    } finally {
      setSubmitting(false);
    }
  };

  const loading = (userLoading || resolvingLinkedEmployee) && !session?.employee?.id;
  if (loading) return <DashboardLayout><div className="h-8 w-48 animate-pulse rounded bg-muted" /></DashboardLayout>;

  const formContent = (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <Link href={base} className="text-muted-foreground hover:text-foreground text-sm shrink-0">
        ← Back to Fund Requests
      </Link>
      <Card className={cn(epFormCard, "w-full flex flex-col border-primary/20 bg-card/95")}>
        <CardHeader className="pb-4 shrink-0">
          <CardTitle>New Fund Request</CardTitle>
          <div>
            <p className="text-sm text-muted-foreground whitespace-nowrap overflow-x-auto">
              <span className="font-medium text-foreground">Approval Stream:</span>{" "}
              {FUND_REQUEST_APPROVAL_STREAM}
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-6">
              {/* Left column */}
              <div className="flex min-w-0 flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Requested by</Label>
                    {employeeId ? (
                      <div className="flex h-10 w-full items-center rounded-md border border-input bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
                        {requesterName || "Loading..."}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <EmployeeSearchSelect
                          employees={requesterEmployees}
                          value={selectedRequesterEmployeeId}
                          onValueChange={(value) =>
                            setSelectedRequesterEmployeeId(value === "all" ? "" : value)
                          }
                          showAllOption={false}
                          placeholder="Search your employee name or ID..."
                        />
                        <p className="text-xs text-amber-700">
                          This dashboard account is not linked yet. Select your employee
                          record once to continue.
                        </p>
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="request_date" required>
                      Date
                    </Label>
                    <Input
                      id="request_date"
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="purpose" required>
                    Purpose
                  </Label>
                  <Select value={purposeOption} onValueChange={setPurposeOption} required>
                    <SelectTrigger id="purpose">
                      <SelectValue placeholder="Select purpose" />
                    </SelectTrigger>
                    <SelectContent>
                      {PURPOSE_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {purposeOption === "Others" && (
                    <Input className="mt-2" value={purposeOther} onChange={(e) => setPurposeOther(e.target.value)} placeholder="Specify purpose" />
                  )}
                </div>
                <div>
                  <Label htmlFor="reference_mode" required>
                    Reference Basis
                  </Label>
                  <Select
                    value={referenceMode}
                    onValueChange={(value) => setReferenceMode(value as ReferenceMode)}
                  >
                    <SelectTrigger id="reference_mode">
                      <SelectValue placeholder="Select reference basis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client_linked">
                        {FUND_REQUEST_REFERENCE_MODE_LABELS.client_linked}
                      </SelectItem>
                      <SelectItem value="internal_stock">
                        {FUND_REQUEST_REFERENCE_MODE_LABELS.internal_stock}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose{" "}
                    <span className="font-medium">Client-Linked Requests</span> when tied to a
                    client Purchase Order. Choose{" "}
                    <span className="font-medium">Office-Related Requests</span> if no client or
                    project reference.
                  </p>
                </div>
                {showProjectReferenceFields ? (
                <details open>
                  <summary className="cursor-pointer lg:hidden text-sm font-semibold border-b pb-2 mb-3">
                    PROJECT REFERENCE DETAILS
                  </summary>
                  <h3 className="hidden lg:block text-sm font-semibold border-b pb-2 mb-3">
                    PROJECT REFERENCE DETAILS
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {showClientPOField && !poPerProject ? (
                      <div>
                        <Label htmlFor="po_number" required>
                          P.O. Number
                        </Label>
                        <Input
                          id="po_number"
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          placeholder="Enter P.O. number"
                          required
                        />
                      </div>
                    ) : null}
                    <FundRequestProjectDetailsFields
                      rows={projectRows}
                      allowMultiple={allowMultipleProjects}
                      poPerProject={poPerProject}
                      onChange={setProjectRows}
                    />

                    {showVendorPaymentSection ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle>SUBCONTRACTOR DETAILS</CardTitle>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-3">
                            <Label htmlFor="vendor_id" required>
                              Subcontractor Name
                            </Label>
                            <Select value={vendorId} onValueChange={setVendorId}>
                              <SelectTrigger id="vendor_id">
                                <SelectValue placeholder="Select subcontractor" />
                              </SelectTrigger>
                              <SelectContent>
                                {subcontractors.map((subcontractor) => (
                                  <SelectItem key={subcontractor.id} value={subcontractor.id}>
                                    {subcontractor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-3">
                            <Label htmlFor="subcontractor_progress_completion" required>
                              Subcontractor Current Progress Percentage
                            </Label>
                            <Input
                              id="subcontractor_progress_completion"
                              type="text"
                              inputMode="decimal"
                              value={subcontractorProgressCompletion}
                              onChange={(e) => setSubcontractorProgressCompletion(e.target.value)}
                              placeholder="Enter percentage"
                              required
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              Indicate the actual percentage of work completed by the subcontractor
                              as of the request date.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                </details>
                ) : null}
              </div>

              {/* Right column */}
              <div className="flex min-w-0 flex-col gap-4">
                <details open>
                  <summary className="cursor-pointer lg:hidden text-sm font-semibold border-b pb-2 mb-2">
                    REQUEST DETAILS
                  </summary>
                  <h3 className="hidden lg:block text-sm font-semibold border-b pb-2 mb-2">
                    REQUEST DETAILS
                  </h3>
                  <div className="space-y-1.5">
                    {details.map((row, i) => (
                      <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_100px_2rem]">
                        <Input
                          placeholder={`${purposeConfig.detailPlaceholderPrefix} ${i + 1}`}
                          value={row.description}
                          onChange={(e) => updateDetail(i, "description", e.target.value)}
                          className="min-w-0"
                          required
                        />
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={row.amount}
                          onChange={(e) => updateDetail(i, "amount", e.target.value)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeDetailRow(i)}
                          disabled={details.length <= 1}
                          className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove item ${i + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Button type="button" variant="outline" onClick={addDetailRow}>
                      Add item
                    </Button>
                  </div>
                  <p className="text-sm font-medium mt-2">
                    Total: PHP {totalRequested.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                  </p>
                </details>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label htmlFor="remarks">Remarks</Label>
                    <Textarea
                      id="remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter remarks"
                      rows={1}
                      className="min-h-10 resize-none"
                    />
                  </div>
                  <div>
                    <Label htmlFor="date_needed">Date Needed</Label>
                    <Input
                      id="date_needed"
                      type="date"
                      value={dateNeeded}
                      onChange={(e) => setDateNeeded(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      Specify a date only for urgent requests. Otherwise, this will follow the
                      fund release in accordance with SOP.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="urgent_reason" required={Boolean(dateNeeded)}>
                      Reason for Urgency
                    </Label>
                    <Textarea
                      id="urgent_reason"
                      value={urgentReason}
                      onChange={(e) => setUrgentReason(e.target.value)}
                      placeholder="Enter reason for urgency"
                      rows={1}
                      className="min-h-10 resize-none"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="fund-request-doc">{requestSupportingDocLabel}</Label>
                  <input
                    id="fund-request-doc"
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) {
                        setSupportingDoc(null);
                        setDocError(null);
                        return;
                      }
                      if (!isAllowedRequestDocument(file)) {
                        setDocError("Only PDF, DOC, or DOCX files are allowed.");
                        setSupportingDoc(null);
                        return;
                      }
                      if (file.size > MAX_REQUEST_DOCUMENT_SIZE) {
                        setDocError("File too large. Max size is 5MB.");
                        setSupportingDoc(null);
                        return;
                      }
                      setDocError(null);
                      setSupportingDoc(file);
                    }}
                    className={epFileInput}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    {requestFormCopy.fundRequest.supportingDocHint}
                  </p>
                  {supportingDoc && !docError ? (
                    <p className="mt-2 text-sm text-emerald-700">
                      Attached: {supportingDoc.name} (
                      {(supportingDoc.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                  ) : null}
                  {docError ? (
                    <p className="mt-1 text-sm font-medium text-destructive">{docError}</p>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 border-t pt-4 sm:flex-row sm:items-center sm:gap-3">
              <Button
                type="submit"
                disabled={submitting}
                className={cn(epSubmitRequestButton, "sm:flex-1")}
                size="sm"
              >
                {submitting ? (
                  <>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className="animate-spin"
                    />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRight" size={IconSizes.sm} />
                    Submit Request
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  if (isPortal) return formContent;
  return <DashboardLayout>{formContent}</DashboardLayout>;
}
