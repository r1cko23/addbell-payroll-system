"use client";

export type InitialApproverRole = "hr" | "operations_manager";

const HR_FIRST_APPROVER_POSITIONS = new Set([
  "admin staff",
  "hr assistant",
  "project coordinator",
  "industrial engineer",
]);

export function normalizePositionName(positionName?: string | null): string {
  return (positionName || "").trim().toLowerCase();
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
