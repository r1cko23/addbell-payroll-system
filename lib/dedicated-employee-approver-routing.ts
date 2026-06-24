/**
 * Employee-specific first approver overrides (bypasses OT group routing).
 * Melanie Sapinoso → Gigi Leonardo only.
 */

export const MELANIE_SAPINOSO_EMPLOYEE_ID = "c74186df-5ee5-424e-aba1-aab9a2815d0f";
export const GIGI_LEONARDO_USER_ID = "f73d35f3-c79d-43e4-88da-53504477c725";

const DEDICATED_FIRST_APPROVER_BY_EMPLOYEE_ID: Record<string, string> = {
  [MELANIE_SAPINOSO_EMPLOYEE_ID]: GIGI_LEONARDO_USER_ID,
};

export function getDedicatedFirstApproverId(
  employeeId?: string | null
): string | null {
  if (!employeeId) return null;
  return DEDICATED_FIRST_APPROVER_BY_EMPLOYEE_ID[employeeId] ?? null;
}

export function hasDedicatedFirstApprover(employeeId?: string | null): boolean {
  return Boolean(getDedicatedFirstApproverId(employeeId));
}

export function isDedicatedFirstApproverUser(userId?: string | null): boolean {
  if (!userId) return false;
  return Object.values(DEDICATED_FIRST_APPROVER_BY_EMPLOYEE_ID).includes(userId);
}

export function employeeIdsForDedicatedApprover(userId?: string | null): string[] {
  if (!userId) return [];
  return Object.entries(DEDICATED_FIRST_APPROVER_BY_EMPLOYEE_ID)
    .filter(([, approverId]) => approverId === userId)
    .map(([employeeId]) => employeeId);
}

/** Who may view/act on requests for employees with a dedicated approver. */
export function passesDedicatedApproverRequestFilter(
  userId: string | null | undefined,
  isAdmin: boolean,
  employeeId: string | null | undefined
): boolean {
  if (isAdmin) return true;

  const dedicatedApproverId = getDedicatedFirstApproverId(employeeId);
  if (dedicatedApproverId) {
    return userId === dedicatedApproverId;
  }

  if (isDedicatedFirstApproverUser(userId)) {
    return employeeIdsForDedicatedApprover(userId).includes(employeeId || "");
  }

  return true;
}

export function canDedicatedApproverActOnEmployeeRequest(
  userId: string | null | undefined,
  employeeId: string | null | undefined
): boolean {
  if (!userId || !employeeId) return false;
  const dedicatedApproverId = getDedicatedFirstApproverId(employeeId);
  if (!dedicatedApproverId) return false;
  return userId === dedicatedApproverId;
}
