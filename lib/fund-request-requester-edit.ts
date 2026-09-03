import type { FundRequestRow } from "@/types/fund-request";
import {
  canRequesterEditFundRequest,
  canRequesterUpdateFundRequestPoNumber,
} from "@/lib/fund-request-approval";
import {
  createEmptyFundRequestProjectRow,
  parseFundRequestProjectDetails,
  serializeFundRequestProjectDetails,
  type FundRequestProjectDetailRow,
  type StoredFundRequestProjectDetails,
} from "@/lib/fund-request-project-details";
import type { FundRequestDetailItem } from "@/lib/fund-request-details";

export function canRequesterManageFundRequest(
  request: Pick<
    FundRequestRow,
    | "requested_by"
    | "status"
    | "rejected_at"
    | "purchasing_officer_approved_at"
    | "rejection_undo_snapshot"
    | "project_manager_approved_by"
    | "project_manager_approved_at"
    | "purchasing_officer_approved_by"
    | "management_approved_by"
  >,
  requesterEmployeeId: string | null | undefined,
  options?: {
    requesterUserId?: string | null;
    requesterIsOperationsManager?: boolean;
  }
): boolean {
  return (
    Boolean(requesterEmployeeId) &&
    request.requested_by === requesterEmployeeId &&
    canRequesterEditFundRequest(request, options)
  );
}

/** Own request + not rejected — PO# may be corrected once it is live on Projects. */
export function canRequesterCorrectFundRequestPoNumber(
  request: Pick<
    FundRequestRow,
    | "requested_by"
    | "status"
    | "rejected_at"
    | "purchasing_officer_approved_at"
    | "rejection_undo_snapshot"
  >,
  requesterEmployeeId: string | null | undefined
): boolean {
  return (
    Boolean(requesterEmployeeId) &&
    request.requested_by === requesterEmployeeId &&
    canRequesterUpdateFundRequestPoNumber(request)
  );
}

/**
 * Update top-level po_number and project_details PO fields.
 * Replaces blank / previous top-level PO on each project row (NTP → real PO).
 */
export function buildFundRequestPoNumberColumnUpdates(
  request: Pick<
    FundRequestRow,
    | "po_number"
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_amount"
  >,
  nextPoNumberRaw: string
): {
  po_number: string | null;
  project_details: StoredFundRequestProjectDetails | null;
} {
  const nextPo = nextPoNumberRaw.trim();
  const previousPo = (request.po_number || "").trim();
  const projects = parseFundRequestProjectDetails(request);
  const raw = request.project_details as StoredFundRequestProjectDetails | null;
  const progressBilling =
    raw && typeof raw === "object" && raw.v === 1 ? raw.progress_billing : undefined;

  if (projects.length === 0) {
    return {
      po_number: nextPo || null,
      project_details: serializeFundRequestProjectDetails([], progressBilling),
    };
  }

  const updatedProjects = projects.map((project, index) => {
    const current = (project.po_number || "").trim();
    const shouldReplace =
      index === 0 ||
      !current ||
      (previousPo && current.toUpperCase() === previousPo.toUpperCase());
    return {
      ...project,
      po_number: shouldReplace ? nextPo || null : project.po_number,
    };
  });

  return {
    po_number: nextPo || null,
    project_details: serializeFundRequestProjectDetails(
      updatedProjects,
      progressBilling
    ),
  };
}

export function fundRequestProjectsToFormRows(
  request: Pick<
    FundRequestRow,
    | "project_details"
    | "project_title"
    | "project_location"
    | "current_project_percentage"
    | "po_number"
    | "po_amount"
  >
): FundRequestProjectDetailRow[] {
  const projects = parseFundRequestProjectDetails(request);
  if (projects.length === 0) {
    return [createEmptyFundRequestProjectRow()];
  }

  return projects.map((project) => ({
    poNumber: project.po_number ?? "",
    title: project.title,
    location: project.location,
    poAmount: project.po_amount != null ? String(project.po_amount) : "",
    completionPercentage:
      project.completion_percentage != null
        ? String(project.completion_percentage)
        : "",
  }));
}

export function fundRequestPurposeToForm(purpose: string): {
  purposeOption: string;
  purposeOther: string;
} {
  const trimmed = purpose.trim();
  const knownPurposes = new Set([
    "Material Purchase",
    "Subcontractor Payment",
    "Project Funds",
    "Liquidation",
    "Others",
  ]);

  if (knownPurposes.has(trimmed) && trimmed !== "Others") {
    return { purposeOption: trimmed, purposeOther: "" };
  }

  if (trimmed === "Others") {
    return { purposeOption: "Others", purposeOther: "" };
  }

  return { purposeOption: "Others", purposeOther: trimmed };
}

export function fundRequestDetailsToFormRows(
  details: FundRequestDetailItem[] | null | undefined
): Array<{ description: string; amount: string }> {
  const items = details ?? [];
  if (items.length === 0) {
    return [{ description: "", amount: "" }];
  }

  return items.map((item) => ({
    description: item.description ?? "",
    amount: item.amount != null ? String(item.amount) : "",
  }));
}
