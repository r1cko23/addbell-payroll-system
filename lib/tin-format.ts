/** Philippine TIN display groups (matches vendor/client form placeholder). */
const TIN_DIGIT_GROUPS = [3, 3, 3, 6] as const;

export const TIN_MAX_DIGITS = TIN_DIGIT_GROUPS.reduce((sum, n) => sum + n, 0);

export const TIN_PLACEHOLDER = "000-000-000-000000";

/** Keep digits only, capped at the supported TIN length. */
export function stripTinDigits(value: string): string {
  return value.replace(/\D/g, "").slice(0, TIN_MAX_DIGITS);
}

/** Auto-format TIN as XXX-XXX-XXX-XXXXXX while typing or displaying. */
export function formatTinWithDashes(value: string): string {
  const digits = stripTinDigits(value);
  if (!digits) return "";

  const parts: string[] = [];
  let offset = 0;
  for (const groupLength of TIN_DIGIT_GROUPS) {
    if (offset >= digits.length) break;
    parts.push(digits.slice(offset, offset + groupLength));
    offset += groupLength;
  }
  return parts.join("-");
}
