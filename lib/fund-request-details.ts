import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeUserRole } from "@/lib/user-roles";

export type FundRequestVatMode = "inclusive" | "exclusive";
export type FundRequestEwtRate = 1 | 2;
export type FundRequestDetailKind = "item" | "deduction";

export type FundRequestDetailItem = {
  kind?: FundRequestDetailKind;
  description?: string;
  amount?: number;
  base_amount?: number;
  vat_mode?: FundRequestVatMode | null;
  ewt_rate?: FundRequestEwtRate | null;
};

export type EditableFundRequestDetail = {
  description: string;
  baseAmount: string;
  amount: string;
  vatMode: FundRequestVatMode | null;
  ewtRate: FundRequestEwtRate | null;
};

export type EditableFundRequestDeduction = {
  description: string;
  amount: string;
};

export type EditableFundRequestDetailsForm = {
  items: EditableFundRequestDetail[];
  deductions: EditableFundRequestDeduction[];
};

export function createEmptyFundRequestDetail(): EditableFundRequestDetail {
  return {
    description: "",
    baseAmount: "",
    amount: "",
    vatMode: null,
    ewtRate: null,
  };
}

export function createEmptyFundRequestDeduction(): EditableFundRequestDeduction {
  return {
    description: "",
    amount: "",
  };
}

export function splitFundRequestDetails(
  details: FundRequestDetailItem[] | null | undefined
): { items: FundRequestDetailItem[]; deductions: FundRequestDetailItem[] } {
  const all = details ?? [];
  return {
    items: all.filter((item) => item.kind !== "deduction"),
    deductions: all.filter((item) => item.kind === "deduction"),
  };
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

export function calculateFundRequestDetailAmount(
  baseAmount: number,
  vatMode: FundRequestVatMode | null,
  ewtRate: FundRequestEwtRate | null
): number {
  if (!Number.isFinite(baseAmount)) return 0;
  if (!vatMode || !ewtRate) return roundCurrency(baseAmount);

  const rate = ewtRate / 100;

  if (vatMode === "inclusive") {
    return roundCurrency(baseAmount - (baseAmount / 1.12) * rate);
  }

  return roundCurrency(baseAmount * 1.12 - baseAmount * rate);
}

export function applyFundRequestDetailAdjustments(
  row: EditableFundRequestDetail
): EditableFundRequestDetail {
  const baseAmount = Number(row.baseAmount || 0);
  if (!row.baseAmount.trim() || !Number.isFinite(baseAmount)) {
    return { ...row, amount: row.baseAmount };
  }

  const adjusted = calculateFundRequestDetailAmount(
    baseAmount,
    row.vatMode,
    row.ewtRate
  );

  return {
    ...row,
    amount: adjusted.toFixed(2),
  };
}

export function toEditableFundRequestDetails(
  details: FundRequestDetailItem[] | null | undefined
): EditableFundRequestDetail[] {
  const { items } = splitFundRequestDetails(details);
  const mapped = items.map((item) => {
    const baseAmount =
      item.base_amount != null && Number.isFinite(Number(item.base_amount))
        ? Number(item.base_amount)
        : item.amount != null && Number.isFinite(Number(item.amount))
          ? Number(item.amount)
          : null;

    const vatMode = item.vat_mode ?? null;
    const ewtRate = item.ewt_rate ?? null;
    const baseAmountString = baseAmount != null ? String(baseAmount) : "";
    const amount =
      baseAmount != null
        ? calculateFundRequestDetailAmount(baseAmount, vatMode, ewtRate).toFixed(2)
        : "";

    return {
      description: item.description ?? "",
      baseAmount: baseAmountString,
      amount,
      vatMode,
      ewtRate,
    };
  });

  return mapped.length > 0 ? mapped : [createEmptyFundRequestDetail()];
}

export function toEditableFundRequestDeductions(
  details: FundRequestDetailItem[] | null | undefined
): EditableFundRequestDeduction[] {
  const { deductions } = splitFundRequestDetails(details);
  return deductions.map((item) => ({
    description: item.description ?? "",
    amount:
      item.amount != null && Number.isFinite(Number(item.amount))
        ? String(item.amount)
        : "",
  }));
}

export function toEditableFundRequestDetailsForm(
  details: FundRequestDetailItem[] | null | undefined
): EditableFundRequestDetailsForm {
  return {
    items: toEditableFundRequestDetails(details),
    deductions: toEditableFundRequestDeductions(details),
  };
}

export function formatFundRequestDetailAdjustment(
  vatMode: FundRequestVatMode | null | undefined,
  ewtRate: FundRequestEwtRate | null | undefined
): string | null {
  if (!vatMode || !ewtRate) return null;
  const vatLabel = vatMode === "inclusive" ? "VAT Inc" : "VAT Ex";
  return `${vatLabel}, EWT ${ewtRate}%`;
}

export function canPurchasingOfficerEditDetails(
  role: string | null | undefined,
  status: string | null | undefined
): boolean {
  return (
    normalizeUserRole(role) === "purchasing_officer" &&
    status === "project_manager_approved"
  );
}

export function cleanFundRequestDetails(
  items: EditableFundRequestDetail[],
  deductions: EditableFundRequestDeduction[] = []
): { details: FundRequestDetailItem[]; total: number } | null {
  const cleanedItems = items
    .filter((item) => item.description.trim() || item.baseAmount.trim())
    .map((item) => {
      const adjusted = applyFundRequestDetailAdjustments(item);
      const baseAmount = Number(adjusted.baseAmount || 0);
      const amount = Number(adjusted.amount || 0);

      return {
        kind: "item" as const,
        description: adjusted.description.trim() || "—",
        base_amount: Number.isFinite(baseAmount) ? baseAmount : 0,
        amount: Number.isFinite(amount) ? amount : 0,
        vat_mode: adjusted.vatMode,
        ewt_rate: adjusted.ewtRate,
      };
    });

  if (cleanedItems.length === 0) {
    return null;
  }

  if (
    cleanedItems.some((item) => !Number.isFinite(item.amount) || item.amount < 0)
  ) {
    return null;
  }

  const cleanedDeductions = deductions
    .filter((item) => item.description.trim() || item.amount.trim())
    .map((item) => {
      const amount = Number(item.amount || 0);
      return {
        kind: "deduction" as const,
        description: item.description.trim() || "—",
        amount: Number.isFinite(amount) ? amount : 0,
      };
    });

  if (
    cleanedDeductions.some(
      (item) => !Number.isFinite(item.amount) || item.amount < 0
    )
  ) {
    return null;
  }

  const itemsTotal = cleanedItems.reduce((sum, item) => sum + item.amount, 0);
  const deductionsTotal = cleanedDeductions.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  if (deductionsTotal > itemsTotal) {
    return null;
  }

  const total = roundCurrency(itemsTotal - deductionsTotal);

  return {
    details: [...cleanedItems, ...cleanedDeductions],
    total,
  };
}

export async function saveFundRequestDetails(
  supabase: SupabaseClient,
  fundRequestId: string,
  items: EditableFundRequestDetail[],
  deductions: EditableFundRequestDeduction[] = []
) {
  const cleaned = cleanFundRequestDetails(items, deductions);
  if (!cleaned) {
    throw new Error(
      "Add at least one valid line item before saving. Deductions must be less than the line item total."
    );
  }

  const { error } = await supabase
    .from("fund_requests")
    .update({
      details: cleaned.details,
      total_requested_amount: cleaned.total,
      updated_at: new Date().toISOString(),
    } as never)
    .eq("id", fundRequestId);

  if (error) {
    throw error;
  }

  return cleaned;
}
