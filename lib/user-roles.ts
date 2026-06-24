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
