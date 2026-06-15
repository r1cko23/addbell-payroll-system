export type FundRequestReferenceMode = "client_linked" | "internal_stock";

export const FUND_REQUEST_REFERENCE_MODE_LABELS: Record<FundRequestReferenceMode, string> = {
  client_linked: "Client-Linked Requests",
  internal_stock: "Office-Related Requests",
};

export function getFundRequestReferenceModeLabel(
  mode: FundRequestReferenceMode | null | undefined
): string {
  if (mode === "internal_stock") {
    return FUND_REQUEST_REFERENCE_MODE_LABELS.internal_stock;
  }
  return FUND_REQUEST_REFERENCE_MODE_LABELS.client_linked;
}

export function formatFundRequestPercentage(
  value: number | string | null | undefined
): string {
  if (value == null || value === "") return "—";
  const normalized = String(value).trim().replace(/%$/, "");
  if (!normalized) return "—";
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) return "—";
  return `${numeric}%`;
}

export const FUND_REQUEST_FIELD_LABELS = {
  poNumber: "P.O. Number",
  projectTitle: "Project Title",
  projectLocation: "Project Location",
  subcontractorName: "Subcontractor Name",
  subcontractorProgress: "Subcontractor Current Progress Percentage",
  projectCompletion: "Current Project Completion Percentage",
  supplierBankDetails: "Bank Details",
  referenceBasis: "Reference Basis",
  purpose: "Purpose",
  remarks: "Remarks",
  dateNeeded: "Date Needed",
  urgentReason: "Reason for Urgency",
  totalRequested: "Total Requested Amount",
} as const;

export const FUND_REQUEST_STATUS_LABELS: Record<string, string> = {
  pending: "Pending (Operations Manager)",
  project_manager_approved: "Pending (Purchasing Officer)",
  purchasing_officer_approved: "Pending (Upper Management)",
  management_approved: "Approved by Upper Management",
  rejected: "Rejected",
};

export type FundRequestDocumentSummary = {
  id: string;
  fund_request_id: string;
  employee_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
};

export type FundRequestRow = {
  id: string;
  company_id: string;
  project_id: string | null;
  requested_by: string;
  request_date: string;
  purpose: string;
  reference_mode: FundRequestReferenceMode | null;
  po_number: string | null;
  vendor_id: string | null;
  vendor_po_number: string | null;
  project_title: string | null;
  project_location: string | null;
  po_amount: number | null;
  po_amount_percentage: number | null;
  current_project_percentage: number | null;
  subcontractor_progress_completion_percentage: number | null;
  details: unknown;
  total_requested_amount: number;
  date_needed: string | null;
  remarks: string | null;
  urgent_reason: string | null;
  status: string;
  project_manager_approved_by: string | null;
  project_manager_approved_at: string | null;
  purchasing_officer_approved_by: string | null;
  purchasing_officer_approved_at: string | null;
  management_approved_by: string | null;
  management_approved_at: string | null;
  supplier_bank_details: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};