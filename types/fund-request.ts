// Type definition for fund_requests table
// This is used instead of Database types since fund_requests table may not be in the generated types yet
export type FundRequestRow = {
  id: string;
  requested_by: string;
  request_date: string;
  purpose: string;
  po_number: string | null;
  project_title: string | null;
  project_location: string | null;
  po_amount: number | null;
  current_project_percentage: number | null;
  details: any;
  total_requested_amount: number;
  date_needed: string;
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