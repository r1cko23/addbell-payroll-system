/** Normalize profile/API role strings for comparisons. */
export function normalizeUserRole(role: string | null | undefined): string {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function isOperationsManagerRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "operations_manager";
}

/** First-approver OT/leave/FTL queues (scoped by overtime group). */
export function isOvertimeGroupQueueApproverRole(
  role: string | null | undefined
): boolean {
  const normalized = normalizeUserRole(role);
  return (
    normalized === "operations_manager" || normalized === "purchasing_officer"
  );
}

/** Admin assistant: reads the Upper Management fund request queue and uploads/downloads cheques. Nothing else. */
export function isAdminAssistantRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "admin_assistant";
}

/**
 * Role whose fund request queue this user sees (an admin assistant sees Upper Management's).
 * For listing and filtering only: approve, reject, return and cutoff checks must use the real role.
 */
export function fundRequestQueueViewRole(role: string | null | undefined): string {
  return isAdminAssistantRole(role) ? "upper_management" : normalizeUserRole(role);
}

/** Staff roles an admin can give in Settings; must stay within profiles_role_check. */
export const ASSIGNABLE_STAFF_ROLES = [
  "hr",
  "upper_management",
  "purchasing_officer",
  "operations_manager",
  "admin_assistant",
  "admin",
] as const;

export function isAssignableStaffRole(role: unknown): role is (typeof ASSIGNABLE_STAFF_ROLES)[number] {
  return typeof role === "string" && (ASSIGNABLE_STAFF_ROLES as readonly string[]).includes(role);
}
