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
  invoice_sheet?: string | null;
};

export const SUBCONTRACTOR_RETENTION_REMARKS_NOTE =
  "For subcontractor 10% retention requests, please indicate the billing invoice number in the Remarks section above. If the project has not yet been billed, kindly state the reason.";

export function isRetentionMilestone(milestone: string): boolean {
  return milestone.trim().toLowerCase().includes("retention");
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
  return selection;
}
