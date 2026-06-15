export type FundRequestBankDetailsForm = {
  accountName: string;
  accountNumber: string;
  bank: string;
};

type StoredFundRequestBankDetails = {
  v: 1;
  account_name: string;
  account_number: string;
  bank: string;
};

export function emptyFundRequestBankDetails(): FundRequestBankDetailsForm {
  return { accountName: "", accountNumber: "", bank: "" };
}

export function parseSupplierBankDetails(
  raw: string | null | undefined
): FundRequestBankDetailsForm {
  if (!raw?.trim()) return emptyFundRequestBankDetails();

  try {
    const parsed = JSON.parse(raw) as Partial<StoredFundRequestBankDetails>;
    if (parsed && typeof parsed === "object" && parsed.v === 1) {
      return {
        accountName: parsed.account_name ?? "",
        accountNumber: parsed.account_number ?? "",
        bank: parsed.bank ?? "",
      };
    }
  } catch {
    // Legacy free-text value.
  }

  return { accountName: raw.trim(), accountNumber: "", bank: "" };
}

export function serializeSupplierBankDetails(
  form: FundRequestBankDetailsForm
): string | null {
  const accountName = form.accountName.trim();
  const accountNumber = form.accountNumber.trim();
  const bank = form.bank.trim();

  if (!accountName && !accountNumber && !bank) return null;

  const payload: StoredFundRequestBankDetails = {
    v: 1,
    account_name: accountName,
    account_number: accountNumber,
    bank: bank,
  };

  return JSON.stringify(payload);
}

export function validateFundRequestBankDetails(
  form: FundRequestBankDetailsForm
): string | null {
  if (!form.accountName.trim()) {
    return "Account name is required.";
  }
  return null;
}

export function hasFundRequestBankDetails(
  raw: string | null | undefined
): boolean {
  const parsed = parseSupplierBankDetails(raw);
  return Boolean(
    parsed.accountName.trim() ||
      parsed.accountNumber.trim() ||
      parsed.bank.trim()
  );
}
