"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useOptionalEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { toast } from "sonner";
import { format } from "date-fns";
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
const NO_PROJECT_VALUE = "__NO_PROJECT__";
type PurposeOption = (typeof PURPOSE_OPTIONS)[number];
type ReferenceMode = "client_linked" | "internal_stock";

type PurposeFieldConfig = {
  referenceCardTitle: string;
  referenceCardDescription: string;
  detailsSectionTitle: string;
  detailsSectionDescription: string;
  detailPlaceholderPrefix: string;
};

type DetailRow = { description: string; amount: string };
type ProjectOption = {
  id: string;
  code: string;
  name: string;
  site_address: string | null;
  contract_value: number | null;
  progress_percentage: number | null;
};
type PurchaseOrderOption = { id: string; po_number: string; project_id: string | null; total_amount: number | null };
type VendorOption = { id: string; name: string };

function createEmptyDetailRow(): DetailRow {
  return { description: "", amount: "" };
}

function isProgressBillingRow(row: DetailRow): boolean {
  return row.description.trim().startsWith(PROGRESS_BILLING_PREFIX);
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
      workflowLabel:
        "Add-bell Technical Services, Inc. — Requester/Operations Manager → Purchasing Officer → Upper Management",
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
      workflowLabel:
        "Add-bell Technical Services, Inc. — Requester/Purchasing Officer → Upper Management",
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
    workflowLabel:
      "Add-bell Technical Services, Inc. — Requester → Operations Manager → Purchasing Officer → Upper Management",
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
  const [projectSelection, setProjectSelection] = useState<string>("");
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
  const [urgentReason, setUrgentReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [purchaseOrderOptions, setPurchaseOrderOptions] = useState<PurchaseOrderOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const workflow = getSubmissionWorkflow(user?.role, isPortal, user?.id ?? null);
  const purposeConfig = useMemo(
    () => getPurposeFieldConfig(purposeOption),
    [purposeOption]
  );
  const isInternalStockReference = referenceMode === "internal_stock";
  const projectMustBeLinked =
    !isInternalStockReference &&
    (purposeOption === "Material Purchase" || purposeOption === "Subcontractor Payment");
  const showClientPOField = !isInternalStockReference;
  const showProjectReferenceFields = !isInternalStockReference;
  const showVendorPaymentSection =
    !isInternalStockReference && purposeOption === "Subcontractor Payment";
  const selectedProjectId =
    projectSelection && projectSelection !== NO_PROJECT_VALUE
      ? projectSelection
      : "";

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
    supabase
      .from("projects")
      .select("id, code, name, site_address, contract_value, progress_percentage")
      .order("name")
      .then(({ data }) => setProjects((data as ProjectOption[]) ?? []));
  }, [supabase]);

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

  const handleProjectSelect = (projectValue: string) => {
    setProjectSelection(projectValue);
    if (projectValue === NO_PROJECT_VALUE) {
      setProjectTitle(NOT_APPLICABLE);
      setProjectLocation(NOT_APPLICABLE);
      setCurrentProjectPercentage(NOT_APPLICABLE);
      return;
    }

    const proj = projects.find((p) => p.id === projectValue);
    if (proj) {
      setProjectTitle(proj.name);
      setProjectLocation(proj.site_address ?? "");
      setCurrentProjectPercentage(String(proj.progress_percentage ?? 0));
    }
  };

  useEffect(() => {
    let active = true;

    supabase
      .from("purchase_orders")
      .select("id, po_number, project_id, total_amount")
      .not("po_number", "is", null)
      .order("po_number")
      .then(({ data }) => {
        if (!active) return;
        const uniquePOs = Array.from(
          new Map(
            ((data as PurchaseOrderOption[] | null) ?? [])
              .filter((po) => po.po_number?.trim())
              .map((po) => [po.po_number.trim(), { ...po, po_number: po.po_number.trim() }])
          ).values()
        );
        setPurchaseOrderOptions(uniquePOs);
      });

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    supabase
      .from("vendors")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setVendors((data as VendorOption[]) ?? []));
  }, [supabase]);

  useEffect(() => {
    if (referenceMode !== "internal_stock") return;
    setProjectSelection(NO_PROJECT_VALUE);
    setProjectTitle(NOT_APPLICABLE);
    setProjectLocation(NOT_APPLICABLE);
    setPoNumber("");
    setCurrentProjectPercentage("");
    setVendorId("");
    setVendorPONumber("");
    setPoAmount("");
    setPoAmountPercentage("");
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
  const availablePurchaseOrders = useMemo(() => {
    if (!selectedProjectId) return purchaseOrderOptions;

    const matchingProjectPOs = purchaseOrderOptions.filter((po) => po.project_id === selectedProjectId);
    const otherPOs = purchaseOrderOptions.filter((po) => po.project_id !== selectedProjectId);
    return [...matchingProjectPOs, ...otherPOs];
  }, [purchaseOrderOptions, selectedProjectId]);
  const hasPurchaseOrderOptions = availablePurchaseOrders.length > 0;
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
    if (projectMustBeLinked && (!projectSelection || projectSelection === NO_PROJECT_VALUE)) {
      toast.error("Project is required for this purpose in client-linked mode.");
      return;
    }
    if (showProjectReferenceFields && !projectTitle.trim()) {
      toast.error("Project Title is required. Enter a value or N/A.");
      return;
    }
    if (showProjectReferenceFields && !projectLocation.trim()) {
      toast.error("Project Location is required. Enter a value or N/A.");
      return;
    }
    if (totalRequested <= 0) {
      toast.error("Add at least one detail line with an amount.");
      return;
    }
    if (!dateNeeded) {
      toast.error("Date needed is required.");
      return;
    }
    if (!urgentReason.trim()) {
      toast.error("Urgent reason is required. Enter a reason or N/A.");
      return;
    }
    const trimmedPoNumber = poNumber.trim();
    if (showClientPOField && !trimmedPoNumber) {
      toast.error("Client P.O. Number is required in client-linked mode.");
      return;
    }
    if (
      showClientPOField &&
      trimmedPoNumber &&
      !hasPurchaseOrderOptions &&
      trimmedPoNumber.toUpperCase() !== "N/A"
    ) {
      toast.error("Enter N/A when no purchase order number applies.");
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

    setSubmitting(true);
    try {
      const detailsPayload = details
        .filter((d) => d.description.trim() || d.amount)
        .map((d) => ({ description: d.description.trim() || "", amount: d.amount ? Number(d.amount) : 0 }));
      if (detailsPayload.length === 0) {
        toast.error("Add at least one detail with amount.");
        setSubmitting(false);
        return;
      }

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
        project_id: showProjectReferenceFields ? (selectedProjectId || null) : null,
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
        urgent_reason: urgentReason.trim(),
        status: workflow.status,
        project_manager_approved_by: workflow.project_manager_approved_by,
        project_manager_approved_at: workflow.project_manager_approved_at,
        purchasing_officer_approved_by: workflow.purchasing_officer_approved_by,
        purchasing_officer_approved_at: workflow.purchasing_officer_approved_at,
        management_approved_by: workflow.management_approved_by,
        management_approved_at: workflow.management_approved_at,
      };

      const { error } = await supabase.from("fund_requests").insert(payload as never);
      if (error) throw error;
      toast.success(
        workflow.status === "pending"
          ? "Fund request submitted."
          : workflow.status === "project_manager_approved"
            ? "Fund request submitted and sent directly to Purchasing Officer."
            : "Fund request submitted and sent directly to Upper Management."
      );
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
    <div className="flex flex-col min-h-0 max-h-[calc(100vh-6rem)] w-full max-w-6xl gap-4 overflow-hidden">
      <Link href={base} className="text-muted-foreground hover:text-foreground text-sm shrink-0">
        ← Back to Fund Requests
      </Link>
      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden border-primary/20 bg-card/95">
        <CardHeader className="pb-4 shrink-0">
          <CardTitle>New Fund Request</CardTitle>
          <p className="text-sm text-muted-foreground">{workflow.workflowLabel}</p>
        </CardHeader>
        <CardContent className="overflow-y-auto min-h-0 flex-1">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
              {/* Left column */}
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
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
                    <Input id="request_date" type="date" value={requestDate} onChange={(e) => setRequestDate(e.target.value)} required />
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
                      <SelectItem value="client_linked">Client-linked request</SelectItem>
                      <SelectItem value="internal_stock">
                        Internal stock / warehouse purchase
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Choose <span className="font-medium">Client-linked</span> when tied to a
                    client P.O. Choose <span className="font-medium">Internal stock</span> for
                    warehouse purchases with no client/project reference.
                  </p>
                </div>
                <details open>
                  <summary className="cursor-pointer lg:hidden text-sm font-semibold border-b pb-2 mb-3">
                    Project and P.O. References
                  </summary>
                  <h3 className="hidden lg:block text-sm font-semibold border-b pb-2 mb-3">
                    Project and P.O. References
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle>{purposeConfig.referenceCardTitle}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          {showProjectReferenceFields
                            ? purposeConfig.referenceCardDescription
                            : "Internal stock mode does not require client P.O. and project linkage."}
                        </p>
                      </CardHeader>
                      <CardContent className="grid grid-cols-1 gap-3">
                        {showProjectReferenceFields ? (
                          <div>
                            <Label htmlFor="project_select">
                              Project {projectMustBeLinked ? "*" : "(optional tie-in)"}
                            </Label>
                            <Select value={projectSelection} onValueChange={handleProjectSelect}>
                              <SelectTrigger id="project_select">
                                <SelectValue placeholder="Select a project or N/A" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={NO_PROJECT_VALUE}>N/A / No project</SelectItem>
                                {projects.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.code} — {p.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                        {showClientPOField ? (
                          <div>
                            <Label htmlFor="po_number">
                              Client P.O. Number *
                            </Label>
                            {hasPurchaseOrderOptions ? (
                              <>
                                <Select value={poNumber} onValueChange={setPoNumber}>
                                  <SelectTrigger id="po_number">
                                    <SelectValue placeholder="Select a client P.O. Number or N/A" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="N/A">N/A</SelectItem>
                                    {availablePurchaseOrders.map((po) => (
                                      <SelectItem key={po.id} value={po.po_number}>
                                        {po.po_number}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Select an existing client P.O. number, or choose{" "}
                                  <span className="font-medium">N/A</span> when it does not apply.
                                </p>
                              </>
                            ) : (
                              <>
                                <Input
                                  id="po_number"
                                  value={poNumber}
                                  onChange={(e) => setPoNumber(e.target.value)}
                                  placeholder="Type N/A if no client P.O. exists"
                                  required
                                />
                                <p className="mt-1 text-xs text-muted-foreground">
                                  No client purchase order numbers were found yet. Enter{" "}
                                  <span className="font-medium">N/A</span> when needed.
                                </p>
                              </>
                            )}
                          </div>
                        ) : null}
                        {showProjectReferenceFields ? (
                          <div>
                            <Label htmlFor="project_title">Project Title</Label>
                            <Input
                              id="project_title"
                              value={projectTitle}
                              onChange={(e) => setProjectTitle(e.target.value)}
                              placeholder="Enter project title or N/A"
                              required
                            />
                          </div>
                        ) : null}
                        {showProjectReferenceFields ? (
                          <div>
                            <Label htmlFor="project_location">Project Location</Label>
                            <Input
                              id="project_location"
                              value={projectLocation}
                              onChange={(e) => setProjectLocation(e.target.value)}
                              placeholder="e.g. Site name, city, or N/A"
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
                              readOnly={Boolean(selectedProjectId)}
                              disabled={Boolean(selectedProjectId)}
                              required
                            />
                            {selectedProjectId ? (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Auto-filled from the selected project&apos;s current progress.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>

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
              <div className="flex flex-col gap-4">
                <details open>
                  <summary className="cursor-pointer lg:hidden text-sm font-semibold border-b pb-2 mb-2">
                    {purposeConfig.detailsSectionTitle}
                  </summary>
                  <h3 className="hidden lg:block text-sm font-semibold border-b pb-2 mb-2">
                    {purposeConfig.detailsSectionTitle}
                  </h3>
                  <p className="mb-2 text-xs text-muted-foreground">
                    {purposeConfig.detailsSectionDescription}
                  </p>
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-[1fr_100px] gap-2 text-xs font-medium text-muted-foreground">
                      <span>Details</span>
                      <span className="text-right">Amount (PHP)</span>
                    </div>
                    {details.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1fr_100px] gap-2">
                        <Input
                          placeholder={`${purposeConfig.detailPlaceholderPrefix} ${i + 1}`}
                          value={row.description}
                          onChange={(e) => updateDetail(i, "description", e.target.value)}
                          className="min-w-0"
                        />
                        <Input type="number" step="0.01" min="0" placeholder="0" value={row.amount} onChange={(e) => updateDetail(i, "amount", e.target.value)} />
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
                    <Label htmlFor="date_needed">Date needed *</Label>
                    <Input id="date_needed" type="date" value={dateNeeded} onChange={(e) => setDateNeeded(e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="urgent_reason">*If urgent, state reason</Label>
                    <Textarea id="urgent_reason" value={urgentReason} onChange={(e) => setUrgentReason(e.target.value)} placeholder="Reason for urgency or N/A" rows={2} className="resize-none" required />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  *NOTE: Provide attachments (Quotation, Invoice, Purchase Order, etc.) to your supervisor or HR as needed.
                </p>
                <div className="flex gap-3 pt-1">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit fund request"}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => router.push(base)}>
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
