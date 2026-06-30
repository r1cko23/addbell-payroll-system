import type { FundRequestBankDetailsForm } from "@/lib/fund-request-bank-details";

export function applySubcontractorAccountNameToBankDetails(
  bankDetails: FundRequestBankDetailsForm,
  vendorAccountName: string | null | undefined,
  options?: { onlyWhenAccountNameEmpty?: boolean }
): FundRequestBankDetailsForm {
  const accountName = vendorAccountName?.trim();
  if (!accountName) return bankDetails;
  if (
    options?.onlyWhenAccountNameEmpty !== false &&
    bankDetails.accountName.trim()
  ) {
    return bankDetails;
  }
  return { ...bankDetails, accountName };
}
