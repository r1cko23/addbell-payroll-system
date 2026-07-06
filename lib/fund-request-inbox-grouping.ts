import {
  splitFundRequestDetails,
  type FundRequestDetailItem,
} from "@/lib/fund-request-details";
import { parseSupplierBankDetails } from "@/lib/fund-request-bank-details";
import { getFundRequestListProjectLabel } from "@/lib/fund-request-project-details";
import { isOfficeRelatedFundRequest } from "@/types/fund-request";
import type { FundRequestRow } from "@/types/fund-request";

export type FundRequestPayeeGroupableRow = Pick<FundRequestRow, "supplier_bank_details"> &
  Partial<
    Pick<
      FundRequestRow,
      "reference_mode" | "total_requested_amount" | "id" | "purpose" | "po_number" | "details"
    >
  >;

export type FundRequestInboxRow = FundRequestRow & {
  employees: {
    employee_id: string;
    first_name: string;
    last_name: string;
    full_name?: string | null;
    profile_picture_url?: string | null;
    user_id?: string | null;
  } | null;
  vendors: {
    name: string;
  } | null;
  projects: {
    name: string | null;
    code: string | null;
    clients: { name: string | null } | null;
  } | null;
};

export type FundRequestClientGroup = {
  key: string;
  clientName: string;
  requests: FundRequestInboxRow[];
  subtotalNet: number;
};

export type FundRequestPaymentSummary = {
  label: string;
  grossAmount: number;
  ewtAmount: number;
  deductionsAmount: number;
  netAmount: number;
};

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function computeItemEwt(
  baseAmount: number,
  vatMode: FundRequestDetailItem["vat_mode"],
  ewtRate: FundRequestDetailItem["ewt_rate"]
): number {
  if (!vatMode || !ewtRate || !Number.isFinite(baseAmount)) return 0;
  const rate = ewtRate / 100;
  if (vatMode === "inclusive") {
    return roundCurrency((baseAmount / 1.12) * rate);
  }
  return roundCurrency(baseAmount * rate);
}

export function summarizeFundRequestPayment(
  request: FundRequestInboxRow
): FundRequestPaymentSummary {
  const netAmount = roundCurrency(Number(request.total_requested_amount) || 0);
  const { items, deductions } = splitFundRequestDetails(
    request.details as FundRequestDetailItem[] | null | undefined
  );

  let grossAmount = 0;
  let ewtAmount = 0;

  items.forEach((item) => {
    const base =
      item.base_amount != null && Number.isFinite(Number(item.base_amount))
        ? Number(item.base_amount)
        : item.amount != null && Number.isFinite(Number(item.amount))
          ? Number(item.amount)
          : 0;
    grossAmount += base;
    ewtAmount += computeItemEwt(base, item.vat_mode, item.ewt_rate);
  });

  const deductionsTotal = roundCurrency(
    deductions.reduce((sum, item) => sum + (Number(item.amount) || 0), 0)
  );

  grossAmount = roundCurrency(grossAmount);
  ewtAmount = roundCurrency(ewtAmount);

  if (grossAmount <= 0) {
    grossAmount = netAmount;
  }

  const parts: string[] = [];
  const projectLabel = getFundRequestListProjectLabel(request);
  if (projectLabel && projectLabel !== "—") parts.push(projectLabel);
  if (request.po_number?.trim()) parts.push(request.po_number.trim());
  if (request.purpose?.trim()) parts.push(request.purpose.trim());

  const label = parts.length > 0 ? parts.join(" · ") : "Fund request";

  return {
    label,
    grossAmount,
    ewtAmount,
    deductionsAmount: deductionsTotal,
    netAmount,
  };
}

export function getFundRequestPayeeAccountName(
  request: FundRequestPayeeGroupableRow
): string | null {
  const accountName = parseSupplierBankDetails(
    request.supplier_bank_details
  ).accountName.trim();
  return accountName || null;
}

export function getFundRequestClientLabel(
  request: FundRequestPayeeGroupableRow
): string {
  const accountName = getFundRequestPayeeAccountName(request);
  if (accountName) return accountName;

  if (isOfficeRelatedFundRequest(request.reference_mode ?? null)) {
    return "Office-Related Requests";
  }

  return "Uncategorized";
}

export function groupFundRequestsByClient(
  rows: FundRequestPayeeGroupableRow[]
): FundRequestClientGroup[] {
  const groups = new Map<string, FundRequestClientGroup>();

  rows.forEach((request) => {
    const clientName = getFundRequestClientLabel(request);
    const key = clientName.toLowerCase().replace(/\s+/g, " ");
    const inboxRow = request as FundRequestInboxRow;
    const existing = groups.get(key) ?? {
      key,
      clientName,
      requests: [],
      subtotalNet: 0,
    };
    existing.requests.push(inboxRow);
    existing.subtotalNet = roundCurrency(
      existing.subtotalNet + (Number(request.total_requested_amount) || 0)
    );
    groups.set(key, existing);
  });

  return [...groups.values()].sort((a, b) => {
    if (a.clientName === "Office-Related Requests") return 1;
    if (b.clientName === "Office-Related Requests") return -1;
    if (a.clientName === "Uncategorized") return 1;
    if (b.clientName === "Uncategorized") return -1;
    return a.clientName.localeCompare(b.clientName, undefined, {
      sensitivity: "base",
    });
  });
}

export function sumFundRequestNetAmount(rows: FundRequestInboxRow[]): number {
  return roundCurrency(
    rows.reduce((sum, row) => sum + (Number(row.total_requested_amount) || 0), 0)
  );
}
