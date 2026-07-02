import { createClient } from "@supabase/supabase-js";
import {
  canRequesterEditFundRequest,
  isFundRequestRejected,
} from "@/lib/fund-request-approval";

export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing Supabase service-role configuration");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Edit, delete, and add documents while the next approver has not acted yet. */
export async function assertRequesterCanManageFundRequest(
  admin: ReturnType<typeof getAdminClient>,
  authUserId: string | null,
  requestId: string,
  requesterEmployeeId: string
) {
  const { data: existing, error: loadError } = await admin
    .from("fund_requests")
    .select("id, requested_by, status, rejected_at, purchasing_officer_approved_at, rejection_undo_snapshot")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError) {
    return { error: loadError.message, status: 500 as const };
  }
  if (!existing || existing.requested_by !== requesterEmployeeId) {
    return { error: "Request not found", status: 404 as const };
  }
  if (isFundRequestRejected(existing)) {
    return {
      error: "This request was rejected and can no longer be changed.",
      status: 403 as const,
    };
  }
  if (!canRequesterEditFundRequest(existing)) {
    return {
      error:
        "This request can no longer be changed because it was approved by the next approver.",
      status: 403 as const,
    };
  }

  const { data: employee, error: employeeError } = await admin
    .from("employees")
    .select("id, user_id, is_active")
    .eq("id", requesterEmployeeId)
    .maybeSingle();

  if (employeeError) {
    return { error: employeeError.message, status: 500 as const };
  }
  if (!employee?.is_active) {
    return { error: "Request not found", status: 404 as const };
  }

  // Dashboard users authenticate via Supabase; employee portal uses localStorage only.
  if (authUserId && employee.user_id !== authUserId) {
    return { error: "You can only change your own fund requests.", status: 403 as const };
  }

  return { existing };
}

/** Upper Management / admin payment check upload on final approval or after. */
export async function assertApproverCanUploadPaymentCheck(
  admin: ReturnType<typeof getAdminClient>,
  authUserId: string | null,
  requestId: string,
  role: string | null | undefined
) {
  if (!authUserId) {
    return { error: "Not authenticated", status: 401 as const };
  }

  const normalizedRole = (role || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (normalizedRole !== "upper_management" && normalizedRole !== "admin") {
    return { error: "Not authorized to upload payment checks", status: 403 as const };
  }

  const { data: existing, error: loadError } = await admin
    .from("fund_requests")
    .select("id, requested_by, status")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError) {
    return { error: loadError.message, status: 500 as const };
  }
  if (!existing) {
    return { error: "Request not found", status: 404 as const };
  }
  if (
    existing.status !== "purchasing_officer_approved" &&
    existing.status !== "management_approved"
  ) {
    return {
      error: "Payment checks can only be added while awaiting or after final approval.",
      status: 403 as const,
    };
  }

  return { existing };
}

const FUND_REQUEST_DOCUMENT_VIEWER_ROLES = new Set([
  "hr",
  "admin",
  "upper_management",
  "project_manager",
  "operations_manager",
  "purchasing_officer",
  "approver",
  "viewer",
]);

/** Read fund request documents from dashboard auth or employee portal context. */
export async function assertCanViewFundRequestDocument(
  admin: ReturnType<typeof getAdminClient>,
  authUserId: string | null,
  documentId: string,
  requestedBy?: string | null
) {
  const { data: document, error: loadError } = await admin
    .from("fund_request_documents")
    .select(
      "id, fund_request_id, employee_id, file_name, file_type, file_size, storage_path, file_base64, document_type"
    )
    .eq("id", documentId)
    .maybeSingle();

  if (loadError) {
    return { error: loadError.message, status: 500 as const };
  }
  if (!document) {
    return { error: "Document not found", status: 404 as const };
  }

  if (requestedBy?.trim()) {
    if (document.employee_id !== requestedBy.trim()) {
      return { error: "Document not found", status: 404 as const };
    }
    return { document };
  }

  if (!authUserId) {
    return { error: "Not authenticated", status: 401 as const };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", authUserId)
    .maybeSingle();

  const normalizedRole = (profile?.role || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (FUND_REQUEST_DOCUMENT_VIEWER_ROLES.has(normalizedRole)) {
    return { document };
  }

  const { data: employee } = await admin
    .from("employees")
    .select("user_id")
    .eq("id", document.employee_id)
    .maybeSingle();

  if (employee?.user_id === authUserId) {
    return { document };
  }

  return { error: "Not authorized to view this document", status: 403 as const };
}
