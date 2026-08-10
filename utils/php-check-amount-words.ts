/**
 * Philippine peso amount in words for physical checks.
 * Example: 191812.50 → "One Hundred Ninety-One Thousand Eight Hundred Twelve and 50/100 Pesos Only"
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
] as const;

function underHundred(n: number): string {
  if (n < 20) return ONES[n] ?? "";
  const ten = Math.floor(n / 10);
  const one = n % 10;
  if (one === 0) return TENS[ten] ?? "";
  return `${TENS[ten]}-${ONES[one]}`;
}

function underThousand(n: number): string {
  if (n === 0) return "";
  if (n < 100) return underHundred(n);
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = `${ONES[hundred]} Hundred`;
  if (rest === 0) return head;
  return `${head} ${underHundred(rest)}`;
}

function integerToWords(n: number): string {
  if (n === 0) return "Zero";

  const scales = ["", "Thousand", "Million", "Billion", "Trillion"] as const;
  const parts: string[] = [];
  let remaining = n;
  let scaleIndex = 0;

  while (remaining > 0 && scaleIndex < scales.length) {
    const chunk = remaining % 1000;
    if (chunk > 0) {
      const words = underThousand(chunk);
      const scale = scales[scaleIndex];
      parts.unshift(scale ? `${words} ${scale}` : words);
    }
    remaining = Math.floor(remaining / 1000);
    scaleIndex += 1;
  }

  return parts.join(" ");
}

/**
 * Format a PHP amount the way it is written on a check.
 * Example: 191812.50 →
 * "One Hundred Ninety-One Thousand Eight Hundred Twelve Pesos and 50/100 Centavos Only"
 */
export function formatPhpCheckAmountInWords(amount: number): string {
  if (!Number.isFinite(amount)) {
    return "Zero Pesos and 00/100 Centavos Only";
  }

  const absolute = Math.abs(amount);
  // Use fixed 2dp string to avoid float artifacts (e.g. 1.015 * 100).
  const [pesosPart, centavosPart = "00"] = absolute.toFixed(2).split(".");
  const pesos = Number(pesosPart);
  const pesosWords = integerToWords(Number.isFinite(pesos) ? pesos : 0);
  const prefix = amount < 0 ? "Negative " : "";

  return `${prefix}${pesosWords} Pesos and ${centavosPart}/100 Centavos Only`;
}
