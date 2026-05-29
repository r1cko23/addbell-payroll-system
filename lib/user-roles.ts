/** Normalize profile/API role strings for comparisons. */
export function normalizeUserRole(role: string | null | undefined): string {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

export function isOperationsManagerRole(role: string | null | undefined): boolean {
  return normalizeUserRole(role) === "operations_manager";
}
