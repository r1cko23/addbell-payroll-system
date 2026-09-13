export const PURCHASE_ORDER_PAYMENT_TERM_OPTIONS = [
  "30% DP | 60% PB | 90% PB | 10% Ret (2 weeks)",
  "50% DP | 40% PB | 10% Ret (2 weeks)",
  "50% DP | 50% Upon Completion",
  "Upon Completion",
  "30 DAYS",
  "60 DAYS",
] as const;

export const MANUAL_PAYMENT_TERMS_VALUE = "__manual__";

const PRESET_SET = new Set<string>(PURCHASE_ORDER_PAYMENT_TERM_OPTIONS);

export function paymentTermsToSelectValue(terms: string[]): string {
  const lines = terms.map((term) => term.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  if (lines.length === 1 && PRESET_SET.has(lines[0])) return lines[0];
  const joined = lines.join(" | ");
  if (PRESET_SET.has(joined)) return joined;
  return MANUAL_PAYMENT_TERMS_VALUE;
}

export function paymentTermsFromSelectValue(
  value: string,
  previousManual: string[]
): string[] {
  const trimmed = value.trim();
  if (!trimmed || trimmed === MANUAL_PAYMENT_TERMS_VALUE) {
    return previousManual;
  }
  return [trimmed];
}
