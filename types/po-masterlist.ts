/**
 * Client P.O. masterlist job — Google Sheet is the source of truth.
 * App saves still push to the sheet when the sheet row has not changed.
 */

export type PoMasterlistJob = {
  id: string;
  company_id: string | null;
  project_id: string | null;
  client_id: string | null;
  po_number: string;
  po_date: string | null;
  po_received_date: string | null;
  po_amount: number | null;
  project_title: string | null;
  client_name: string | null;
  location: string | null;
  payment_terms: string | null;
  cari: string | null;
  cari_expiry: string | null;
  project_status: string | null;
  payment_status: string | null;
  invoice_numbers: string | null;
  general_remarks: string | null;
  sheet_tab: string | null;
  sheet_row: number | null;
  sheet_synced_at: string | null;
  sheet_sync_error: string | null;
  sheet_sync_fingerprint: string | null;
  created_at: string;
  updated_at: string;
};

/** Fields that map 1:1 onto masterlist sheet columns A–N. */
export type PoMasterlistSheetRowSource = Pick<
  PoMasterlistJob,
  | "po_date"
  | "po_received_date"
  | "po_number"
  | "po_amount"
  | "project_title"
  | "client_name"
  | "location"
  | "payment_terms"
  | "cari"
  | "cari_expiry"
  | "project_status"
  | "payment_status"
  | "invoice_numbers"
  | "general_remarks"
>;

export type PoMasterlistSheetWritebackStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed";

export type PoMasterlistSheetWritebackQueueItem = {
  id: string;
  job_id: string;
  status: PoMasterlistSheetWritebackStatus;
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};
