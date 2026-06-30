export const SUBCONTRACTOR_PAYMENT_SCHEMES = {
  option_1: {
    label: "Payment Option 1",
    milestones: [
      "30% Down Payment",
      "60% Progress Billing",
      "90% Progress Billing",
      "10% Retention",
    ],
  },
  option_2: {
    label: "Payment Option 2",
    milestones: ["50% Down Payment", "40% Progress Billing", "10% Retention"],
  },
} as const;

export type SubcontractorPaymentScheme = keyof typeof SUBCONTRACTOR_PAYMENT_SCHEMES;

export type SubcontractorInvoiceStatus =
  | "COPY RECEIVED"
  | "COPY NOT YET RECEIVED"
  | "NOT FOUND";

export type ProgressBillingSelection = {
  payment_scheme: SubcontractorPaymentScheme;
  milestone: string;
  invoice_status?: SubcontractorInvoiceStatus | null;
  invoice_number?: string | null;
  /** @deprecated Stored on older requests — use invoice_number */
  invoice_sheet?: string | null;
};

export const SUBCONTRACTOR_RETENTION_REMARKS_NOTE =
  "If the project has not yet been billed, kindly state the reason in the Remarks section above.";

export function isRetentionMilestone(milestone: string): boolean {
  return milestone.trim().toLowerCase().includes("retention");
}

/** Matches billing workbook tab names — not row invoice booklet numbers. */
const BILLING_SHEET_TAB_NAME_PATTERN =
  /^(?:\d{4}\s*-\s*)?(?:(?:L&K\s+)?B-INV#|(?:L&K\s+)?INV#|BINV#|OR\/INVOICE#)\d+$/i;

export function isBillingInvoiceSheetTabName(value: string): boolean {
  return BILLING_SHEET_TAB_NAME_PATTERN.test(value.trim());
}

export function resolveProgressBillingInvoiceNumber(
  selection: ProgressBillingSelection | null | undefined
): string | null {
  const candidates = [selection?.invoice_number, selection?.invoice_sheet]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const value of candidates) {
    if (!isBillingInvoiceSheetTabName(value)) return value;
  }
  return null;
}

export function formatSubcontractorInvoiceStatusLabel(
  status: SubcontractorInvoiceStatus | null | undefined
): string {
  if (status === "COPY RECEIVED") return "COPY RECEIVED";
  if (status === "COPY NOT YET RECEIVED") return "COPY NOT YET RECEIVED";
  if (status === "NOT FOUND") return "NO MATCHING INVOICE ROW FOUND IN BILLING SHEETS";
  return "—";
}

export function subcontractorInvoiceStatusToneClass(
  status: SubcontractorInvoiceStatus | null | undefined
): string {
  if (status === "COPY RECEIVED") {
    return "text-emerald-700 bg-emerald-50 border-emerald-200";
  }
  if (status === "COPY NOT YET RECEIVED") {
    return "text-amber-900 bg-amber-50 border-amber-200";
  }
  if (status === "NOT FOUND") {
    return "text-muted-foreground bg-muted/40 border-border";
  }
  return "";
}

export function parseProgressBillingFromProjectDetails(
  projectDetails: unknown
): ProgressBillingSelection | null {
  if (!projectDetails || typeof projectDetails !== "object") return null;
  const raw = projectDetails as {
    progress_billing?: ProgressBillingSelection | null;
  };
  const selection = raw.progress_billing;
  if (!selection?.payment_scheme || !selection.milestone) return null;
  if (
    selection.payment_scheme !== "option_1" &&
    selection.payment_scheme !== "option_2"
  ) {
    return null;
  }
  return {
    ...selection,
    invoice_number: resolveProgressBillingInvoiceNumber(selection),
  };
}
