"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
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
  epFormActionButton,
  epFormActions,
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
import {
  type FundRequestReferenceMode,
  FUND_REQUEST_REFERENCE_MODE_LABELS,
} from "@/types/fund-request";

const PURPOSE_OPTIONS = [
  "Material Purchase",
  "Subcontractor Payment",
  "Project Funds",
  "Liquidation",
  "Others",
] as const;

const INITIAL_DETAIL_ROWS = 1;
const PROGRESS_BILLING_PREFIX = "Progress Billing";
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
type VendorOption = { id: string; name: string };

function createEmptyDetailRow(): DetailRow {
  return { description: "", amount: "" };
}

function isProgressBillingRow(row: DetailRow): boolean {
  return row.description.trim().startsWith(PROGRESS_BILLING_PREFIX);
}

function validateDetailRows(rows: DetailRow[]): string | null {
  if (rows.length === 0) {
    return "Add at least one item with a description and amount.";
  }

  const blankRowIndex = rows.findIndex(
    (row) => !row.description.trim() && !row.amount.trim()
  );
  if (blankRowIndex >= 0) {
    return rows.length === 1
      ? "Add at least one item with a description and amount."
      : `Item ${blankRowIndex + 1} is blank. Remove it or complete it.`;
  }

  const incompleteRowIndex = rows.findIndex((row) => {
    const hasDescription = Boolean(row.description.trim());
    const hasAmount = Boolean(row.amount.trim());
    return hasDescription !== hasAmount;
  });
  if (incompleteRowIndex >= 0) {
    return `Item ${incompleteRowIndex + 1} must have both a description and amount.`;
  }

  const invalidAmountIndex = rows.findIndex((row) => {
    const amount = Number(row.amount);
    return !Number.isFinite(amount) || amount <= 0;
  });
  if (invalidAmountIndex >= 0) {
    return `Item ${invalidAmountIndex + 1} must have an amount greater than zero.`;
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

function parseRequiredNumericOrNA(
  value: string,
  fieldLabel: string,
  options?: { min?: number; max?: number }
): number | null {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(`${fieldLabel} is required. Enter a number or N/A.`);
  }

  if (isNotApplicableValue(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldLabel} must be a valid number or N/A.`);
  }

  if (options?.min != null && parsed < options.min) {
    throw new Error(`${fieldLabel} must be at least ${options.min}, or N/A.`);
  }

  if (options?.max != null && parsed > options.max) {
    throw new Error(`${fieldLabel} must not be greater than ${options.max}, or N/A.`);
  }

  return parsed;
}

const FUND_REQUEST_APPROVAL_STREAM =
  "Requester → Operations Manager → Purchasing Officer → Upper Management";

function getSubmissionWorkflow(
  role: string | undefined,
  isPortal: boolean,
  currentUserId: string | null
) {
  const timestamp = new Date().toISOString();
  if (!isPortal && role === "operations_manager" && currentUserId) {
    return {
      status: "project_manager_approved",
      project_manager_approved_by: currentUserId,
      project_manager_approved_at: timestamp,
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
    };
  }

  if (!isPortal && role === "purchasing_officer" && currentUserId) {
    return {
      status: "purchasing_officer_approved",
      project_manager_approved_by: null,
      project_manager_approved_at: null,
      purchasing_officer_approved_by: currentUserId,
      purchasing_officer_approved_at: timestamp,
      management_approved_by: null,
      management_approved_at: null,
    };
  }

  return {
    status: "pending",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: null,
    purchasing_officer_approved_at: null,
    management_approved_by: null,
    management_approved_at: null,
  };
}

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
  const [projectTitle, setProjectTitle] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [vendorId, setVendorId] = useState("");
  const [vendorPONumber, setVendorPONumber] = useState("");
  const [poAmount, setPoAmount] = useState("");
  const [poAmountPercentage, setPoAmountPercentage] = useState("");
  const [currentProjectPercentage, setCurrentProjectPercentage] = useState("");
  const [details, setDetails] = useState<DetailRow[]>(() =>
    Array.from({ length: INITIAL_DETAIL_ROWS }, () => createEmptyDetailRow()),
  );
  const [dateNeeded, setDateNeeded] = useState("");
  const [remarks, setRemarks] = useState("");
  const [urgentReason, setUrgentReason] = useState("");
  const [supportingDoc, setSupportingDoc] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const workflow = getSubmissionWorkflow(user?.role, isPortal, user?.id ?? null);
  const purposeConfig = useMemo(
    () => getPurposeFieldConfig(purposeOption),
    [purposeOption]
  );
  const isInternalStockReference = referenceMode === "internal_stock";
  const showClientPOField = !isInternalStockReference;
  const showProjectReferenceFields = !isInternalStockReference;
  const showVendorPaymentSection =
    !isInternalStockReference && purposeOption === "Subcontractor Payment";

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
    supabase
      .from("vendors")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setVendors((data as VendorOption[]) ?? []));
  }, [supabase]);

  useEffect(() => {
    if (referenceMode === "internal_stock") {
      setProjectTitle("");
      setProjectLocation("");
      setPoNumber("");
      setCurrentProjectPercentage("");
      setVendorId("");
      setVendorPONumber("");
      setPoAmount("");
      setPoAmountPercentage("");
      return;
    }

    setProjectTitle((prev) => (isNotApplicableValue(prev) ? "" : prev));
    setProjectLocation((prev) => (isNotApplicableValue(prev) ? "" : prev));
  }, [referenceMode]);

  useEffect(() => {
    if (showVendorPaymentSection) return;
    setVendorId("");
    setVendorPONumber("");
    setPoAmount("");
    setPoAmountPercentage("");
    setCurrentProjectPercentage("");
  }, [showVendorPaymentSection]);

  const detailAmounts = details.map((d) => (d.amount ? Number(d.amount) : 0));
  const totalRequested = detailAmounts.reduce((a, b) => a + b, 0);
  const progressBillingPercent = !showVendorPaymentSection || !poAmountPercentage || isNotApplicableValue(poAmountPercentage)
    ? 0
    : Number(poAmountPercentage);
  const progressBillingBaseAmount = !showVendorPaymentSection || !poAmount || isNotApplicableValue(poAmount)
    ? 0
    : Number(poAmount);
  const hasProgressBilling =
    Number.isFinite(progressBillingPercent) &&
    progressBillingPercent > 0 &&
    Number.isFinite(progressBillingBaseAmount) &&
    progressBillingBaseAmount > 0;
  const progressBillingDescription = hasProgressBilling
    ? `${PROGRESS_BILLING_PREFIX} ${progressBillingPercent}%`
    : "";
  const progressBillingAmount = hasProgressBilling
    ? (progressBillingBaseAmount * progressBillingPercent) / 100
    : 0;

  useEffect(() => {
    setDetails((prev) => {
      const progressRowIndex = prev.findIndex(isProgressBillingRow);

      if (!hasProgressBilling) {
        if (progressRowIndex === -1) return prev;
        return prev.filter((_, index) => index !== progressRowIndex);
      }

      const nextProgressRow = {
        description: progressBillingDescription,
        amount: progressBillingAmount.toFixed(2),
      };

      if (progressRowIndex >= 0) {
        const current = prev[progressRowIndex];
        if (
          current.description === nextProgressRow.description &&
          current.amount === nextProgressRow.amount
        ) {
          return prev;
        }

        const next = [...prev];
        next[progressRowIndex] = nextProgressRow;
        return next;
      }

      const emptyIndex = prev.findIndex(
        (row) => !row.description.trim() && !row.amount.trim()
      );

      if (emptyIndex >= 0) {
        const next = [...prev];
        next[emptyIndex] = nextProgressRow;
        return next;
      }

      return [...prev, nextProgressRow];
    });
  }, [
    hasProgressBilling,
    progressBillingAmount,
    progressBillingDescription,
  ]);

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
    if (showProjectReferenceFields && !projectTitle.trim()) {
      toast.error("Project Title is required.");
      return;
    }
    if (showProjectReferenceFields && !projectLocation.trim()) {
      toast.error("Project Location is required.");
      return;
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
    if (showClientPOField && !trimmedPoNumber) {
      toast.error("P.O. Number is required in client-linked mode.");
      return;
    }
    let parsedPoAmount: number | null = null;
    let parsedPoAmountPercentage: number | null = null;
    let parsedCurrentProjectPercentage: number | null = null;
    const trimmedVendorPONumber = vendorPONumber.trim();
    if (showVendorPaymentSection && !vendorId) {
      toast.error("Select a vendor or subcontractor.");
      return;
    }
    if (showVendorPaymentSection && !trimmedVendorPONumber) {
      toast.error("Vendor P.O. Number is required for subcontractor payment.");
      return;
    }
    try {
      if (showVendorPaymentSection) {
        parsedPoAmount = parseRequiredNumericOrNA(poAmount, "Vendor P.O. Amount", { min: 0 });
        parsedPoAmountPercentage = parseRequiredNumericOrNA(
          poAmountPercentage,
          "Vendor Amount %",
          { min: 0, max: 100 }
        );
        parsedCurrentProjectPercentage = parseRequiredNumericOrNA(
          currentProjectPercentage,
          "Current Project %",
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
      const detailsPayload = details.map((d) => ({
        description: d.description.trim(),
        amount: Number(d.amount),
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

      const payload = {
        company_id: companyId,
        reference_mode: referenceMode,
        project_id: null,
        requested_by: employeeId,
        request_date: requestDate,
        purpose: purposeValue,
        po_number: showClientPOField
          ? (trimmedPoNumber.toUpperCase() === "N/A" ? "N/A" : trimmedPoNumber)
          : null,
        project_title: showProjectReferenceFields ? projectTitle.trim() : null,
        project_location: showProjectReferenceFields ? projectLocation.trim() : null,
        vendor_id: showVendorPaymentSection ? vendorId : null,
        vendor_po_number: showVendorPaymentSection ? trimmedVendorPONumber : null,
        po_amount: parsedPoAmount,
        po_amount_percentage: parsedPoAmountPercentage,
        current_project_percentage: parsedCurrentProjectPercentage,
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
                    <Label htmlFor="request_date">Date</Label>
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
                  <Label htmlFor="purpose">Purpose *</Label>
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
                  <Label htmlFor="reference_mode">Reference Basis *</Label>
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
                <details open>
                  <summary className="cursor-pointer lg:hidden text-sm font-semibold border-b pb-2 mb-3">
                    PROJECT REFERENCE DETAILS
                  </summary>
                  <h3 className="hidden lg:block text-sm font-semibold border-b pb-2 mb-3">
                    PROJECT REFERENCE DETAILS
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {!showProjectReferenceFields ? (
                      <p className="text-xs text-muted-foreground">
                        Office-Related Requests mode does not require client P.O. and project linkage.
                      </p>
                    ) : null}
                    {showClientPOField ? (
                      <div>
                        <Label htmlFor="po_number">P.O. Number *</Label>
                        <Input
                          id="po_number"
                          value={poNumber}
                          onChange={(e) => setPoNumber(e.target.value)}
                          placeholder="Enter P.O. number"
                          required
                        />
                      </div>
                    ) : null}
                    {showProjectReferenceFields ? (
                      <div>
                        <Label htmlFor="project_title">Project Title *</Label>
                        <Input
                          id="project_title"
                          value={projectTitle}
                          onChange={(e) => setProjectTitle(e.target.value)}
                          placeholder="Enter project title"
                          required
                        />
                      </div>
                    ) : null}
                    {showProjectReferenceFields ? (
                      <div>
                        <Label htmlFor="project_location">Project Location *</Label>
                        <Input
                          id="project_location"
                          value={projectLocation}
                          onChange={(e) => setProjectLocation(e.target.value)}
                          placeholder="Enter project location"
                          required
                        />
                      </div>
                    ) : null}
                    {showVendorPaymentSection ? (
                      <div>
                        <Label htmlFor="current_project_percentage">Current Project %</Label>
                        <Input
                          id="current_project_percentage"
                          type="text"
                          inputMode="decimal"
                          value={currentProjectPercentage}
                          onChange={(e) => setCurrentProjectPercentage(e.target.value)}
                          placeholder="Enter percentage or N/A"
                          required
                        />
                      </div>
                    ) : null}

                    {showVendorPaymentSection ? (
                      <Card>
                        <CardHeader className="pb-3">
                          <CardTitle>Vendor/Subcontractor P.O. Details</CardTitle>
                          <p className="text-xs text-muted-foreground">
                            Capture the vendor reference and Addbell vendor P.O. details for this
                            subcontractor payment request.
                          </p>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="sm:col-span-3">
                            <Label htmlFor="vendor_id">Vendor / Subcontractor *</Label>
                            <Select value={vendorId} onValueChange={setVendorId}>
                              <SelectTrigger id="vendor_id">
                                <SelectValue placeholder="Select vendor or subcontractor" />
                              </SelectTrigger>
                              <SelectContent>
                                {vendors.map((vendor) => (
                                  <SelectItem key={vendor.id} value={vendor.id}>
                                    {vendor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="vendor_po_number">Vendor P.O. Number *</Label>
                            <Input
                              id="vendor_po_number"
                              value={vendorPONumber}
                              onChange={(e) => setVendorPONumber(e.target.value)}
                              placeholder="Enter vendor P.O. number"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="po_amount">Vendor P.O. Amount (PHP)</Label>
                            <Input
                              id="po_amount"
                              type="text"
                              inputMode="decimal"
                              value={poAmount}
                              onChange={(e) => setPoAmount(e.target.value)}
                              placeholder="Enter amount or N/A"
                              required
                            />
                          </div>
                          <div>
                            <Label htmlFor="po_amount_percentage">Vendor Amount %</Label>
                            <Input
                              id="po_amount_percentage"
                              type="text"
                              inputMode="decimal"
                              value={poAmountPercentage}
                              onChange={(e) => setPoAmountPercentage(e.target.value)}
                              placeholder="Enter percentage or N/A"
                              required
                            />
                            <p className="mt-1 text-xs text-muted-foreground">
                              Used for progress billing when applicable.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ) : null}
                  </div>
                </details>
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
                          required
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
                    <Label htmlFor="urgent_reason">
                      Reason for Urgency{dateNeeded ? " *" : ""}
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
                <div className={isPortal ? epFormActions : "flex gap-3 pt-1"}>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className={isPortal ? epSubmitRequestButton : undefined}
                  >
                    {submitting ? "Submitting..." : "Submit fund request"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => router.push(base)}
                    className={isPortal ? epFormActionButton : undefined}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );

  if (isPortal) return formContent;
  return <DashboardLayout>{formContent}</DashboardLayout>;
}
