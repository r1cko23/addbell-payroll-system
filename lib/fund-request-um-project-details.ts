import { normalizeUserRole } from "@/lib/user-roles";
import {
  normalizeFundRequestProjectRows,
  serializeFundRequestProjectDetails,
  validateFundRequestProjectRows,
  type FundRequestProjectDetailRow,
  type StoredFundRequestProjectDetails,
} from "@/lib/fund-request-project-details";

/**
 * UM (and admin acting as final reviewer) may edit project reference fields
 * while the request sits in the upper-management queue.
 */
export function canUpperManagementEditProjectDetails(
  role: string | null | undefined,
  status: string | null | undefined
): boolean {
  if (status !== "purchasing_officer_approved") return false;
  const normalized = normalizeUserRole(role);
  return normalized === "upper_management" || normalized === "admin";
}

export function buildFundRequestUmProjectDetailsUpdates(
  rows: FundRequestProjectDetailRow[],
  existingProjectDetails: unknown
): Record<string, unknown> | null {
  const validationError = validateFundRequestProjectRows(rows, {
    required: true,
    requirePoPerProject: true,
  });
  if (validationError) return null;

  const projects = normalizeFundRequestProjectRows(rows, {
    includePoNumber: true,
  });
  if (projects.length === 0) return null;

  const existing = existingProjectDetails as StoredFundRequestProjectDetails | null;
  const progressBilling =
    existing &&
    typeof existing === "object" &&
    existing.v === 1 &&
    existing.progress_billing
      ? existing.progress_billing
      : undefined;

  const primary = projects[0];

  return {
    po_number: primary.po_number,
    project_title: primary.title,
    project_location: primary.location,
    po_amount: primary.po_amount,
    current_project_percentage: primary.completion_percentage,
    project_details: serializeFundRequestProjectDetails(
      projects,
      progressBilling
    ),
  };
}
