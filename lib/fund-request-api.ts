import { createClient } from "@supabase/supabase-js";
import { canRequesterEditFundRequest } from "@/lib/fund-request-approval";

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
    .select("id, requested_by, status")
    .eq("id", requestId)
    .maybeSingle();

  if (loadError) {
    return { error: loadError.message, status: 500 as const };
  }
  if (!existing || existing.requested_by !== requesterEmployeeId) {
    return { error: "Request not found", status: 404 as const };
  }
  if (!canRequesterEditFundRequest(existing.status)) {
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
