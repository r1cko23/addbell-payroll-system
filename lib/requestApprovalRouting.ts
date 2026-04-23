"use client";

export type InitialApproverRole = "hr" | "operations_manager";

export const FINAL_HR_APPROVER_ID = "d8c2de99-1d65-432d-928f-5efaad8c1a55";
export const LOCATION_FIRST_APPROVER_BY_GROUP: Record<string, string> = {
  // Legacy names (kept for backward compatibility)
  laguna: "bf70e9c8-aa43-4468-878f-1cddc90d12f6",
  manila: "bc93a339-6a61-45fe-98d8-b51bf16cd889",
  "manila-hr": "d8c2de99-1d65-432d-928f-5efaad8c1a55",
  // Current official group names
  "operations-laguna": "bf70e9c8-aa43-4468-878f-1cddc90d12f6",
  "operations-manila i": "bc93a339-6a61-45fe-98d8-b51bf16cd889",
  "operations-manila ii": "4ed5c668-bef6-4373-8e9f-1af55ef10f09",
  "hr-laguna": "d8c2de99-1d65-432d-928f-5efaad8c1a55",
  "purchasing-laguna": "b7069605-1126-448b-b96f-f944e86e8e13",
  "upper management group": "f73d35f3-c79d-43e4-88da-53504477c725",
};

const HR_FIRST_APPROVER_POSITIONS = new Set([
  "admin staff",
  "hr assistant",
  "project coordinator",
  "industrial engineer",
]);

export function normalizePositionName(positionName?: string | null): string {
  return (positionName || "").trim().toLowerCase();
}

export function normalizeGroupName(groupName?: string | null): string {
  return (groupName || "").trim().toLowerCase();
}

export function isHrFirstApproverPosition(positionName?: string | null): boolean {
  return HR_FIRST_APPROVER_POSITIONS.has(normalizePositionName(positionName));
}

export function getInitialApproverRole(
  positionName?: string | null
): InitialApproverRole {
  return isHrFirstApproverPosition(positionName) ? "hr" : "operations_manager";
}

export function isPendingRequestForRole(
  userRole: string | null | undefined,
  positionName?: string | null
): boolean {
  const normalizedRole = (userRole || "").trim().toLowerCase();
  return normalizedRole === getInitialApproverRole(positionName);
}

export function getFirstApproverIdForGroup(groupName?: string | null): string | null {
  const normalized = normalizeGroupName(groupName);
  return LOCATION_FIRST_APPROVER_BY_GROUP[normalized] || null;
}

export function isFirstApproverForGroup(
  userId?: string | null,
  groupName?: string | null
): boolean {
  if (!userId) return false;
  return getFirstApproverIdForGroup(groupName) === userId;
}

export function isFinalHrApprover(userId?: string | null): boolean {
  return Boolean(userId && userId === FINAL_HR_APPROVER_ID);
}
