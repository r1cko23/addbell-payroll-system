/** Normalize profile/API role strings for comparisons. */
export function normalizeUserRole(role: string | null | undefined): string {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function isOperationsManagerRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "operations_manager";
}

/** Purchasing officer or admin — admin always retains access when a feature is “purchasing only”. */
export function isPurchasingOrAdminRole(role: string | null | undefined): boolean {
  const normalized = normalizeUserRole(role);
  return normalized === "purchasing_officer" || normalized === "admin";
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
