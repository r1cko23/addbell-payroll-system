import type { SupabaseClient } from "@supabase/supabase-js";
import type { FundRequestRow } from "@/types/fund-request";
import { isOperationsManagerRole, normalizeUserRole } from "@/lib/user-roles";

export type FundRequestRequesterRouting = {
  overtimeGroupId: string | null;
  overtimeGroupName: string | null;
  groupApproverUserId: string | null;
  groupApproverRole: string | null;
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
    .select("overtime_group_id, overtime_groups:overtime_group_id ( id, name, approver_id )")
    .eq("id", requesterEmployeeId)
    .maybeSingle();

  const group = Array.isArray(employee?.overtime_groups)
    ? employee?.overtime_groups[0]
    : employee?.overtime_groups;

  const overtimeGroupId =
    (group as { id?: string } | null | undefined)?.id ??
    employee?.overtime_group_id ??
    null;
  const overtimeGroupName =
    (group as { name?: string } | null | undefined)?.name?.trim() || null;
  const groupApproverUserId =
    (group as { approver_id?: string } | null | undefined)?.approver_id ?? null;

  let groupApproverRole: string | null = null;
  if (groupApproverUserId) {
    const { data: approverProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", groupApproverUserId)
      .maybeSingle();
    groupApproverRole = approverProfile?.role ?? null;
  }

  const routing = {
    overtimeGroupId,
    overtimeGroupName,
    groupApproverUserId,
    groupApproverRole,
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

export function fundRequestInOperationsManagerQueue(
  request: Pick<FundRequestRow, "status" | "requested_by">,
  managedRequesterIds: ReadonlySet<string> | string[]
): boolean {
  if (request.status !== "pending") return false;
  const managedIds =
    managedRequesterIds instanceof Set
      ? managedRequesterIds
      : new Set(managedRequesterIds);
  return managedIds.has(request.requested_by);
}

export function canOperationsManagerActOnFundRequest(
  request: Pick<FundRequestRow, "status" | "requested_by">,
  managedRequesterIds: ReadonlySet<string> | string[]
): boolean {
  return fundRequestInOperationsManagerQueue(request, managedRequesterIds);
}
