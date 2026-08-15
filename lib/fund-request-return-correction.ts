import {
  FUND_REQUEST_FIELD_LABELS,
  formatFundRequestPercentage,
  getFundRequestReferenceModeLabel,
  type FundRequestRow,
} from "@/types/fund-request";
import {
  formatFundRequestPoAmount,
  parseFundRequestProjectDetails,
  type StoredFundRequestProjectDetails,
} from "@/lib/fund-request-project-details";
import { parseSupplierBankDetails } from "@/lib/fund-request-bank-details";

export const FUND_REQUEST_RETURN_FIELD_KEYS = [
  "purpose",
  "referenceBasis",
  "poNumber",
  "projectTitle",
  "projectLocation",
  "poAmount",
  "projectCompletion",
  "subcontractorName",
  "subcontractorProgress",
  "subcontractorPoAmount",
  "progressBillingMilestone",
  "billingInvoiceNumber",
  "totalRequested",
  "remarks",
  "dateNeeded",
  "urgentReason",
  "supplierBankDetails",
  "others",
] as const;

export type FundRequestReturnFieldKey =
  (typeof FUND_REQUEST_RETURN_FIELD_KEYS)[number];

export type FundRequestReturnCorrection = {
  fields: FundRequestReturnFieldKey[];
  otherReason: string | null;
  snapshot: Record<string, string>;
  corrections: Partial<
    Record<FundRequestReturnFieldKey, { from: string; to: string }>
  > | null;
  resubmittedAt: string | null;
};

export type FundRequestReturnCorrectionInput = {
  fields: FundRequestReturnFieldKey[];
  otherReason: string;
};

const FIELD_LABELS: Record<FundRequestReturnFieldKey, string> = {
  purpose: FUND_REQUEST_FIELD_LABELS.purpose,
  referenceBasis: FUND_REQUEST_FIELD_LABELS.referenceBasis,
  poNumber: FUND_REQUEST_FIELD_LABELS.poNumber,
  projectTitle: FUND_REQUEST_FIELD_LABELS.projectTitle,
  projectLocation: FUND_REQUEST_FIELD_LABELS.projectLocation,
  poAmount: FUND_REQUEST_FIELD_LABELS.poAmount,
  projectCompletion: FUND_REQUEST_FIELD_LABELS.projectCompletion,
  subcontractorName: FUND_REQUEST_FIELD_LABELS.subcontractorName,
  subcontractorProgress: FUND_REQUEST_FIELD_LABELS.subcontractorProgress,
  subcontractorPoAmount: FUND_REQUEST_FIELD_LABELS.subcontractorPoAmount,
  progressBillingMilestone: FUND_REQUEST_FIELD_LABELS.progressBillingMilestone,
  billingInvoiceNumber: FUND_REQUEST_FIELD_LABELS.billingInvoiceNumber,
  totalRequested: FUND_REQUEST_FIELD_LABELS.totalRequested,
  remarks: FUND_REQUEST_FIELD_LABELS.remarks,
  dateNeeded: FUND_REQUEST_FIELD_LABELS.dateNeeded,
  urgentReason: FUND_REQUEST_FIELD_LABELS.urgentReason,
  supplierBankDetails: FUND_REQUEST_FIELD_LABELS.supplierBankDetails,
  others: "Others",
};

const FORM_FIELD_KEYS = FUND_REQUEST_RETURN_FIELD_KEYS.filter(
  (key) => key !== "others"
);

export function getFundRequestReturnFieldLabel(
  key: FundRequestReturnFieldKey
): string {
  return FIELD_LABELS[key];
}

export function listFundRequestReturnFormFields(): {
  key: FundRequestReturnFieldKey;
  label: string;
}[] {
  return FORM_FIELD_KEYS.map((key) => ({
    key,
    label: FIELD_LABELS[key],
  }));
}

function isReturnFieldKey(value: string): value is FundRequestReturnFieldKey {
  return (FUND_REQUEST_RETURN_FIELD_KEYS as readonly string[]).includes(value);
}

export function parseFundRequestReturnCorrection(
  value: unknown
): FundRequestReturnCorrection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Partial<FundRequestReturnCorrection>;
  if (!Array.isArray(record.fields)) return null;
  const fields = record.fields.filter(isReturnFieldKey);
  if (fields.length === 0) return null;

  const snapshot: Record<string, string> = {};
  if (record.snapshot && typeof record.snapshot === "object") {
    for (const [key, entry] of Object.entries(record.snapshot)) {
      if (typeof entry === "string") snapshot[key] = entry;
    }
  }

  let corrections: FundRequestReturnCorrection["corrections"] = null;
  if (record.corrections && typeof record.corrections === "object") {
    corrections = {};
    for (const [key, entry] of Object.entries(record.corrections)) {
      if (!isReturnFieldKey(key) || !entry || typeof entry !== "object") continue;
      const from = (entry as { from?: unknown }).from;
      const to = (entry as { to?: unknown }).to;
      if (typeof from !== "string" || typeof to !== "string") continue;
      corrections[key] = { from, to };
    }
    if (Object.keys(corrections).length === 0) corrections = null;
  }

  return {
    fields,
    otherReason:
      typeof record.otherReason === "string" && record.otherReason.trim()
        ? record.otherReason.trim()
        : null,
    snapshot,
    corrections,
    resubmittedAt:
      typeof record.resubmittedAt === "string" ? record.resubmittedAt : null,
  };
}

export function validateFundRequestReturnCorrection(
  input: FundRequestReturnCorrectionInput
): { ok: true } | { ok: false; message: string } {
  const fields = [...new Set(input.fields.filter(isReturnFieldKey))];
  if (fields.length === 0) {
    return {
      ok: false,
      message: "Select the form values to correct, or choose Others and type a reason.",
    };
  }

  const hasFormFields = fields.some((key) => key !== "others");
  const hasOthers = fields.includes("others");
  if (hasOthers && !input.otherReason.trim()) {
    return {
      ok: false,
      message: "Type the reason for Others.",
    };
  }
  if (!hasFormFields && !hasOthers) {
    return {
      ok: false,
      message: "Select the form values to correct, or choose Others and type a reason.",
    };
  }
  return { ok: true };
}

export function formatFundRequestReturnReason(
  input: FundRequestReturnCorrectionInput
): string {
  const fields = [...new Set(input.fields.filter(isReturnFieldKey))];
  const formLabels = fields
    .filter((key) => key !== "others")
    .map((key) => FIELD_LABELS[key]);
  const other = input.otherReason.trim();
  const parts: string[] = [];
  if (formLabels.length > 0) {
    parts.push(`Correct: ${formLabels.join(", ")}`);
  }
  if (fields.includes("others") && other) {
    parts.push(other);
  }
  return parts.join(". ");
}

function formatMoney(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `₱${Number(value).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatText(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "—";
}

function formatBank(raw: string | null | undefined): string {
  const parsed = parseSupplierBankDetails(raw);
  const parts = [parsed.accountName, parsed.bank, parsed.accountNumber]
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "—";
}

export type FundRequestReturnSnapshotSource = Pick<
  FundRequestRow,
  | "purpose"
  | "reference_mode"
  | "po_number"
  | "project_title"
  | "project_location"
  | "po_amount"
  | "current_project_percentage"
  | "subcontractor_progress_completion_percentage"
  | "subcontractor_po_amount"
  | "project_details"
  | "total_requested_amount"
  | "remarks"
  | "date_needed"
  | "urgent_reason"
  | "supplier_bank_details"
> & {
  vendorName?: string | null;
};

function getProgressBilling(request: FundRequestReturnSnapshotSource) {
  const raw = request.project_details as StoredFundRequestProjectDetails | null;
  if (raw && typeof raw === "object" && raw.v === 1) {
    return raw.progress_billing ?? null;
  }
  return null;
}

export function snapshotFundRequestReturnValues(
  request: FundRequestReturnSnapshotSource
): Record<string, string> {
  const projects = parseFundRequestProjectDetails(request);
  const firstProject = projects[0];
  const billing = getProgressBilling(request);

  return {
    purpose: formatText(request.purpose),
    referenceBasis: getFundRequestReferenceModeLabel(request.reference_mode),
    poNumber: formatText(request.po_number || firstProject?.po_number),
    projectTitle: formatText(request.project_title || firstProject?.title),
    projectLocation: formatText(
      request.project_location || firstProject?.location
    ),
    poAmount: formatFundRequestPoAmount(
      request.po_amount ?? firstProject?.po_amount ?? null
    ),
    projectCompletion: formatFundRequestPercentage(
      request.current_project_percentage ?? firstProject?.completion_percentage
    ),
    subcontractorName: formatText(request.vendorName),
    subcontractorProgress: formatFundRequestPercentage(
      request.subcontractor_progress_completion_percentage
    ),
    subcontractorPoAmount: formatMoney(request.subcontractor_po_amount),
    progressBillingMilestone: formatText(billing?.milestone),
    billingInvoiceNumber: formatText(
      billing?.invoice_number || billing?.invoice_sheet
    ),
    totalRequested: formatMoney(request.total_requested_amount),
    remarks: formatText(request.remarks),
    dateNeeded: formatText(request.date_needed),
    urgentReason: formatText(request.urgent_reason),
    supplierBankDetails: formatBank(request.supplier_bank_details),
  };
}

export function buildFundRequestReturnCorrection(
  input: FundRequestReturnCorrectionInput,
  request: FundRequestReturnSnapshotSource
): FundRequestReturnCorrection {
  const fields = [...new Set(input.fields.filter(isReturnFieldKey))];
  return {
    fields,
    otherReason: fields.includes("others") ? input.otherReason.trim() || null : null,
    snapshot: snapshotFundRequestReturnValues(request),
    corrections: null,
    resubmittedAt: null,
  };
}

export function diffFundRequestReturnCorrections(
  correction: FundRequestReturnCorrection,
  request: FundRequestReturnSnapshotSource
): NonNullable<FundRequestReturnCorrection["corrections"]> {
  const current = snapshotFundRequestReturnValues(request);
  const diffs: NonNullable<FundRequestReturnCorrection["corrections"]> = {};
  for (const key of correction.fields) {
    if (key === "others") continue;
    const from = correction.snapshot[key] ?? "—";
    const to = current[key] ?? "—";
    if (from !== to) {
      diffs[key] = { from, to };
    }
  }
  return diffs;
}

export function applyFundRequestReturnResubmit(
  correction: FundRequestReturnCorrection | null,
  request: FundRequestReturnSnapshotSource,
  resubmittedAt: string
): FundRequestReturnCorrection | null {
  if (!correction) return null;
  const diffs = diffFundRequestReturnCorrections(correction, request);
  return {
    ...correction,
    corrections: Object.keys(diffs).length > 0 ? diffs : null,
    resubmittedAt,
  };
}

export function isFundRequestReturnFieldFlagged(
  correction: FundRequestReturnCorrection | null | undefined,
  field: FundRequestReturnFieldKey
): boolean {
  if (!correction) return false;
  if (field === "others") return false;
  return correction.fields.includes(field);
}

export function getFundRequestReturnFieldChange(
  correction: FundRequestReturnCorrection | null | undefined,
  field: FundRequestReturnFieldKey
): { from: string; to: string } | null {
  if (!correction?.corrections) return null;
  return correction.corrections[field] ?? null;
}

export function formatFundRequestReturnChange(change: {
  from: string;
  to: string;
}): string {
  return `${change.from} → ${change.to}`;
}

const COLUMN_BY_FIELD: Partial<Record<FundRequestReturnFieldKey, string>> = {
  purpose: "purpose",
  poNumber: "po_number",
  projectTitle: "project_title",
  projectLocation: "project_location",
  poAmount: "po_amount",
  projectCompletion: "current_project_percentage",
  subcontractorProgress: "subcontractor_progress_completion_percentage",
  remarks: "remarks",
  dateNeeded: "date_needed",
  urgentReason: "urgent_reason",
};

export function isFundRequestReturnFieldEditable(
  field: FundRequestReturnFieldKey
): boolean {
  return Boolean(COLUMN_BY_FIELD[field]);
}

export function buildFundRequestCorrectionFieldColumnUpdates(
  edits: Partial<Record<FundRequestReturnFieldKey, string>>
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(edits) as [
    FundRequestReturnFieldKey,
    string,
  ][]) {
    const column = COLUMN_BY_FIELD[field];
    if (!column) continue;
    const value = raw.trim();
    if (
      field === "poAmount" ||
      field === "projectCompletion" ||
      field === "subcontractorProgress"
    ) {
      const numeric = Number(value.replace(/,/g, ""));
      updates[column] = value && Number.isFinite(numeric) ? numeric : null;
      continue;
    }
    updates[column] = value || null;
  }
  return updates;
}
