/** Shared labels, placeholders, and hints for employee portal request forms. */

export const requestReasonLabel = "Reason";

export const requestSupportingDocLabel =
  "Supporting Document (PDF/DOC/DOCX)";

export const requestFormCopy = {
  overtime: {
    reasonPlaceholder: "Provide reason for overtime request...",
    supportingDocHint:
      "Attach supporting document for overtime. Max 5MB.",
  },
  leave: {
    reasonPlaceholder: "Provide reason for leave request...",
    supportingDocHint:
      "Attach clinic slip or documentation for SIL. Max 5MB.",
  },
  fundRequest: {
    supportingDocHint:
      "Attach quotation, invoice, purchase order etc. as needed. Max 5MB.",
  },
  failureToLog: {
    reasonPlaceholder:
      "Explain why you missed clocking in and out for this shift...",
  },
} as const;
