import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundRequestRow } from "@/types/fund-request";
import { isOperationsManagerRole, normalizeUserRole } from "@/lib/user-roles";

export type FundRequestRequesterRouting = {
  overtimeGroupId: string | null;
  overtimeGroupName: string | null;
  groupApproverUserId: string | null;
  groupApproverRole: string | null;
  groupApproverName: string | null;
  requiresOperationsManagerApproval: boolean;
};

export type FundRequestSubmissionWorkflow = Pick<
  FundRequestRow,
  | "status"
  | "project_manager_approved_by"
  | "project_manager_approved_at"
  | "purchasing_officer_approved_by"
  | "purchasing_officer_approved_at"
  | "management_approved_by"
  | "management_approved_at"
>;

export function requesterRequiresOperationsManagerApproval(
  routing: Pick<FundRequestRequesterRouting, "overtimeGroupId" | "groupApproverRole">
): boolean {
  return (
    Boolean(routing.overtimeGroupId) &&
    isOperationsManagerRole(routing.groupApproverRole)
  );
}

export async function resolveFundRequestRequesterRouting(
  supabase: SupabaseClient,
  requesterEmployeeId: string
): Promise<FundRequestRequesterRouting> {
  const { data: employee } = await supabase
    .from("employees")
    .select("overtime_group_id")
    .eq("id", requesterEmployeeId)
    .maybeSingle();

  const overtimeGroupId = employee?.overtime_group_id ?? null;

  let overtimeGroupName: string | null = null;
  let groupApproverUserId: string | null = null;
  if (overtimeGroupId) {
    const { data: group } = await supabase
      .from("overtime_groups")
      .select("id, name, approver_id")
      .eq("id", overtimeGroupId)
      .maybeSingle();

    overtimeGroupName = group?.name?.trim() || null;
    groupApproverUserId = group?.approver_id ?? null;
  }

  let groupApproverRole: string | null = null;
  let groupApproverName: string | null = null;
  if (groupApproverUserId) {
    const { data: approverProfile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", groupApproverUserId)
      .maybeSingle();
    groupApproverRole = approverProfile?.role ?? null;
    groupApproverName = approverProfile?.full_name?.trim() || null;
  }

  const routing = {
    overtimeGroupId,
    overtimeGroupName,
    groupApproverUserId,
    groupApproverRole,
    groupApproverName,
    requiresOperationsManagerApproval: false,
  };

  return {
    ...routing,
    requiresOperationsManagerApproval:
      requesterRequiresOperationsManagerApproval(routing),
  };
}

/** Purchasing officers filing from the dashboard skip OM/PO approval and need bank details on the form. */
export function isPurchasingOfficerSelfSubmitPath(options: {
  submitterRole: string | null | undefined;
  isPortal: boolean;
  submitterUserId: string | null;
}): boolean {
  return (
    !options.isPortal &&
    normalizeUserRole(options.submitterRole) === "purchasing_officer" &&
    Boolean(options.submitterUserId)
  );
}

export function getFundRequestSubmissionWorkflow(options: {
  submitterRole: string | null | undefined;
  isPortal: boolean;
  submitterUserId: string | null;
  requiresOperationsManagerApproval: boolean;
}): FundRequestSubmissionWorkflow {
  const timestamp = new Date().toISOString();
  const submitterRole = normalizeUserRole(options.submitterRole);

  if (!options.isPortal && submitterRole === "operations_manager" && options.submitterUserId) {
    return {
      status: "project_manager_approved",
      project_manager_approved_by: null,
      project_manager_approved_at: null,
      purchasing_officer_approved_by: null,
      purchasing_officer_approved_at: null,
      management_approved_by: null,
      management_approved_at: null,
    };
  }

  if (
    isPurchasingOfficerSelfSubmitPath({
      submitterRole: options.submitterRole,
      isPortal: options.isPortal,
      submitterUserId: options.submitterUserId,
    })
  ) {
    return {
      status: "purchasing_officer_approved",
      project_manager_approved_by: null,
      project_manager_approved_at: null,
      purchasing_officer_approved_by: options.submitterUserId,
      purchasing_officer_approved_at: timestamp,
      management_approved_by: null,
      management_approved_at: null,
    };
  }

  if (options.requiresOperationsManagerApproval) {
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

  return {
    status: "project_manager_approved",
    project_manager_approved_by: null,
    project_manager_approved_at: null,
    purchasing_officer_approved_by: null,
    purchasing_officer_approved_at: null,
    management_approved_by: null,
    management_approved_at: null,
  };
}

export function fundRequestSkippedOperationsManagerApproval(
  request: Pick<FundRequestRow, "status" | "project_manager_approved_by">,
  requiresOperationsManagerApproval: boolean
): boolean {
  if (!requiresOperationsManagerApproval) return false;
  if (request.project_manager_approved_by) return false;
  return (
    request.status === "project_manager_approved" ||
    request.status === "purchasing_officer_approved"
  );
}

export function shouldReturnFundRequestToOperationsManager(
  request: Pick<
    FundRequestRow,
    "status" | "project_manager_approved_by" | "purchasing_officer_approved_at"
  >,
  requiresOperationsManagerApproval: boolean
): boolean {
  return (
    request.status === "purchasing_officer_approved" &&
    Boolean(request.purchasing_officer_approved_at) &&
    fundRequestSkippedOperationsManagerApproval(request, requiresOperationsManagerApproval)
  );
}

export async function resolveFundRequestRequesterRoutingMap(
  supabase: SupabaseClient,
  requesterEmployeeIds: readonly string[]
): Promise<Map<string, FundRequestRequesterRouting>> {
  const uniqueIds = [...new Set(requesterEmployeeIds.filter(Boolean))];
  const entries = await Promise.all(
    uniqueIds.map(async (employeeId) => [
      employeeId,
      await resolveFundRequestRequesterRouting(supabase, employeeId),
    ] as const)
  );
  return new Map(entries);
}

export function fundRequestInOperationsManagerQueue(
  request: Pick<
    FundRequestRow,
    "status" | "requested_by" | "project_manager_approved_by"
  >,
  managedRequesterIds: ReadonlySet<string> | string[]
): boolean {
  if (request.status === "rejected" || request.status === "management_approved") {
    return false;
  }
  const managedIds =
    managedRequesterIds instanceof Set
      ? managedRequesterIds
      : new Set(managedRequesterIds);
  if (!managedIds.has(request.requested_by)) return false;
  if (request.status === "pending") return true;
  if (
    !request.project_manager_approved_by &&
    (request.status === "project_manager_approved" ||
      request.status === "purchasing_officer_approved")
  ) {
    return true;
  }
  return false;
}

export function canOperationsManagerActOnFundRequest(
  request: Pick<
    FundRequestRow,
    "status" | "requested_by" | "project_manager_approved_by"
  >,
  managedRequesterIds: ReadonlySet<string> | string[]
): boolean {
  return fundRequestInOperationsManagerQueue(request, managedRequesterIds);
}
