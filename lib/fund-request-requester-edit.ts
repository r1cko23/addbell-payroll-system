import type { FundRequestRow } from "@/types/fund-request";
import { canRequesterEditFundRequest, isFundRequestRejected } from "@/lib/fund-request-approval";
import {
  createEmptyFundRequestProjectRow,
  parseFundRequestProjectDetails,
  type FundRequestProjectDetailRow,
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
    | "purchasing_officer_approved_by"
    | "management_approved_by"
  >,
  requesterEmployeeId: string | null | undefined,
  options?: { requesterUserId?: string | null }
): boolean {
  return (
    Boolean(requesterEmployeeId) &&
    request.requested_by === requesterEmployeeId &&
    canRequesterEditFundRequest(request, options)
  );
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
