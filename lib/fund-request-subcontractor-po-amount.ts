import { normalizeUserRole } from "@/lib/user-roles";
import { isSubcontractorPaymentPurpose } from "@/types/fund-request";

export function parseSubcontractorPoAmountInput(value: string): number | null {
  const trimmed = value.trim().replace(/,/g, "");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

export function validateSubcontractorPoAmountInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Subcontract P.O. Amount is required.";
  }
  if (parseSubcontractorPoAmountInput(trimmed) == null) {
    return "Enter a valid Subcontract P.O. Amount.";
  }
  return null;
}

export function canPurchasingOfficerEditSubcontractorPoAmount(
  role: string | null | undefined,
  status: string | null | undefined,
  purpose: string | null | undefined
): boolean {
  return (
    normalizeUserRole(role) === "purchasing_officer" &&
    status === "project_manager_approved" &&
    isSubcontractorPaymentPurpose(purpose)
  );
}

export function isSubcontractorPoAmountReadyForPurchasingApproval(
  value: string
): boolean {
  return validateSubcontractorPoAmountInput(value) == null;
}

export function shouldShowSubcontractorPoAmountToPurchasingOfficer(
  role: string | null | undefined,
  purpose: string | null | undefined,
  status: string | null | undefined,
  currentAmount: number | null | undefined
): boolean {
  if (normalizeUserRole(role) !== "purchasing_officer") return false;
  if (!isSubcontractorPaymentPurpose(purpose)) return false;
  if (status === "project_manager_approved") return true;
  return currentAmount != null;
}
