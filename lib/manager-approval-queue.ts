import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getFirstApproverIdForGroup,
  normalizeGroupName,
} from "@/lib/requestApprovalRouting";

export type ManagerQueueType = "leave" | "overtime" | "ftl";

const QUEUE_PATHS: Record<ManagerQueueType, string> = {
  leave: "/leave-approval",
  overtime: "/overtime-approval",
  ftl: "/failure-to-log-approval",
};

/** Deep-link into an approval queue (pending filter + optional request modal). */
export function buildManagerQueueUrl(
  type: ManagerQueueType,
  options?: { status?: "pending"; requestId?: string }
): string {
  const params = new URLSearchParams();
  if (options?.status) params.set("status", options.status);
  if (options?.requestId) {
    params.set("requestId", options.requestId);
  } else if (options?.status === "pending") {
    params.set("focus", "1");
  }
  const qs = params.toString();
  const base = QUEUE_PATHS[type];
  return qs ? `${base}?${qs}` : base;
}

/** OT group ids where this profile is the designated approver. */
export async function fetchApproverOvertimeGroupIds(
  supabase: SupabaseClient,
  approverUserId: string
): Promise<string[]> {
  const { data: managedGroups } = await supabase
    .from("overtime_groups")
    .select("id")
    .eq("is_active", true)
    .eq("approver_id", approverUserId);

  return (managedGroups || []).map((g) => g.id).filter(Boolean);
}

/** Employee ids (UUID + company code) in OT groups this user approves. */
export async function fetchManagedEmployeeIdsForApprover(
  supabase: SupabaseClient,
  approverUserId: string
): Promise<string[]> {
  const groupIds = await fetchApproverOvertimeGroupIds(supabase, approverUserId);
  if (groupIds.length === 0) return [];

  const { data: groupEmployees } = await supabase
    .from("employees")
    .select("id, employee_id")
    .in("overtime_group_id", groupIds);

  return Array.from(
    new Set(
      (groupEmployees || []).flatMap((emp) =>
        [emp.id, emp.employee_id].filter(
          (id): id is string => typeof id === "string" && id.length > 0
        )
      )
    )
  );
}

/**
 * True when `userId` is the first approver for an OT group (DB `overtime_groups.approver_id` wins).
 */
export function isUserApproverForOvertimeGroup(
  userId: string | null | undefined,
  groupName: string | null | undefined,
  approverIdByGroupName: Record<string, string>
): boolean {
  if (!userId || !groupName) return false;
  const trimmed = groupName.trim();
  const lower = trimmed.toLowerCase();
  const normalized = normalizeGroupName(groupName);
  const assignedApproverId =
    approverIdByGroupName[groupName] ||
    approverIdByGroupName[trimmed] ||
    approverIdByGroupName[lower] ||
    approverIdByGroupName[normalized] ||
    null;
  if (assignedApproverId) return assignedApproverId === userId;
  const legacyId = getFirstApproverIdForGroup(groupName);
  return legacyId === userId;
}
