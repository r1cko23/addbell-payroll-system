/**
 * Philippine check print helpers for BDO / BPI stock (PCHC new design).
 *
 * Text format follows official filled BDO/BPI blanks: uppercase payee,
 * MM-DD-YYYY date digits, figures without ₱, amount in words ALL CAPS.
 *
 * Coordinates are millimetres — calibrate per printer + checkbook.
 */

import { formatPhpCheckAmountInWords } from "@/utils/php-check-amount-words";

export type CheckBank = "bdo" | "bpi";

export type CheckFieldBox = {
  topMm: number;
  leftMm: number;
  widthMm: number;
  fontSizePt: number;
  /** Extra letter-spacing for date character boxes */
  letterSpacingEm?: number;
  textAlign?: "left" | "right" | "center";
  whiteSpace?: "nowrap" | "normal";
};

export type CheckTemplate = {
  label: string;
  /** Physical check width */
  pageWidthMm: number;
  /** Physical check height */
  pageHeightMm: number;
  date: CheckFieldBox;
  payee: CheckFieldBox;
  amountFigures: CheckFieldBox;
  amountWords: CheckFieldBox;
};

export type CheckPrintOffset = {
  offsetXMm: number;
  offsetYMm: number;
};

export type CheckPrintFields = {
  bank: CheckBank;
  payee: string;
  amount: number;
  /** Issue date — will be formatted as MM-DD-YYYY */
  date: Date;
};

export const CHECK_BANKS: { value: CheckBank; label: string }[] = [
  { value: "bdo", label: "BDO" },
  { value: "bpi", label: "BPI" },
];

/** Account name printed on Addbell check stock (from payment-check samples). */
export const ADDBELL_CHECK_ACCOUNT_NAME = "ADD-BELL TECHNICAL SERVICES INC";

/**
 * Print @page uses Epson-safe minimum height (127 mm).
 * Check fields stay in the top ~77 mm band; bottom of the page is blank.
 */
export const CHECK_PRINT_PAGE_WIDTH_MM = 203.2;
export const CHECK_PRINT_PAGE_HEIGHT_MM = 127;
/** Small top nudge so content isn't clipped by printer top margin. */
export const CHECK_PRINT_TOP_INSET_MM = 0;

/**
 * Layouts from official BDO new-check blank (PCHC).
 * BPI reuses the same field positions — only label/branding differs.
 * Physical aspect ≈ 203mm × 76mm (official BDO blank 1024×387 ≈ 2.65).
 */
const SHARED_CHECK_LAYOUT = {
  pageWidthMm: 203.2,
  pageHeightMm: 76.8, // 203.2 / 2.646
  date: {
    topMm: 14.8,
    leftMm: 148.5,
    widthMm: 45,
    fontSizePt: 9,
    letterSpacingEm: 0,
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
  },
  payee: {
    topMm: 22.8,
    leftMm: 42,
    widthMm: 95,
    fontSizePt: 10,
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
  },
  amountFigures: {
    topMm: 21.2,
    leftMm: 154.5,
    widthMm: 39,
    fontSizePt: 11,
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
  },
  amountWords: {
    topMm: 29.2,
    leftMm: 34,
    widthMm: 160,
    fontSizePt: 8,
    textAlign: "left" as const,
    whiteSpace: "nowrap" as const,
  },
};

export const CHECK_TEMPLATES: Record<CheckBank, CheckTemplate> = {
  bdo: {
    label: "BDO",
    ...SHARED_CHECK_LAYOUT,
  },
  bpi: {
    label: "BPI",
    ...SHARED_CHECK_LAYOUT,
  },
};

export type CheckDateDigitSlot = { left: number; width: number };

export type CheckDateDigitLayout = {
  /** Eight digit boxes as % of check width (dashes are skipped). */
  slots: CheckDateDigitSlot[];
  /** Top of digit boxes as % of check height. */
  topPct: number;
  /** Digit-box height as % of check height. */
  heightPct: number;
};

/**
 * Date digit boxes — shared BDO layout for both banks (digits centered in each slot).
 */
const SHARED_DATE_DIGIT_LAYOUT: CheckDateDigitLayout = {
  slots: [
    { left: 73.44, width: 2.15 },
    { left: 75.78, width: 2.15 },
    { left: 79.3, width: 2.25 },
    { left: 81.84, width: 2.15 },
    { left: 85.35, width: 2.15 },
    { left: 87.79, width: 2.15 },
    { left: 90.23, width: 2.15 },
    { left: 92.68, width: 2.15 },
  ],
  topPct: 16.8,
  heightPct: 4.65,
};

export const CHECK_DATE_DIGIT_LAYOUT: Record<CheckBank, CheckDateDigitLayout> = {
  bdo: SHARED_DATE_DIGIT_LAYOUT,
  bpi: SHARED_DATE_DIGIT_LAYOUT,
};

/** @deprecated Prefer CHECK_DATE_DIGIT_LAYOUT.bdo */
export const BDO_DATE_DIGIT_SLOTS_PCT = CHECK_DATE_DIGIT_LAYOUT.bdo.slots;
/** @deprecated Prefer CHECK_DATE_DIGIT_LAYOUT.bdo */
export const BDO_DATE_TOP_PCT = CHECK_DATE_DIGIT_LAYOUT.bdo.topPct;
/** @deprecated Prefer CHECK_DATE_DIGIT_LAYOUT.bdo */
export const BDO_DATE_HEIGHT_PCT = CHECK_DATE_DIGIT_LAYOUT.bdo.heightPct;

/** Split MM-DD-YYYY into the 8 digit characters for boxed printing. */
export function getCheckDateDigits(dateText: string): string[] {
  const digits = dateText.replace(/\D/g, "").slice(0, 8).split("");
  while (digits.length < 8) digits.push("");
  return digits;
}

const OFFSET_STORAGE_KEY = "addbell-check-print-offsets-v8";

/** Official corporate stock uses two signature boxes (BDO + BPI blanks). */
export function getCheckSignatureBoxCount(_bank: CheckBank): 1 | 2 {
  return 2;
}

export function formatCheckDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "01-01-1970";
  }
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${mm}-${dd}-${yyyy}`;
}

/** Amount box: commas + period, no peso sign (pre-printed on stock). */
export function formatCheckAmountFigures(amount: number): string {
  if (!Number.isFinite(amount)) return "0.00";
  return Math.abs(amount).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Official filled BDO/BPI style: uppercase payee, no asterisk padding.
 * Example: ALEJA BLOWER CORPORATION
 */
export function formatCheckPayee(name: string): string {
  return name.replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Official filled BDO/BPI amount-in-words (ALL CAPS on the PESOS line).
 * Whole: THIRTY SEVEN THOUSAND … PESOS ONLY
 * With centavos: … PESOS & 18/100 CENTAVOS ONLY
 */
export function formatCheckAmountInWordsPrint(amount: number): string {
  const base = formatPhpCheckAmountInWords(amount);
  let printed: string;
  if (/Pesos and 00\/100 Centavos Only$/i.test(base)) {
    printed = base.replace(/ Pesos and 00\/100 Centavos Only$/i, " PESOS ONLY");
  } else {
    printed = base.replace(
      / Pesos and (\d{2})\/100 Centavos Only$/i,
      " PESOS & $1/100 CENTAVOS ONLY"
    );
  }
  return printed.replace(/-/g, " ").toUpperCase();
}

export function buildCheckPrintContent(fields: CheckPrintFields): {
  date: string;
  payee: string;
  amountFigures: string;
  amountWords: string;
} {
  return {
    date: formatCheckDate(fields.date),
    payee: formatCheckPayee(fields.payee),
    amountFigures: formatCheckAmountFigures(fields.amount),
    amountWords: formatCheckAmountInWordsPrint(fields.amount),
  };
}

export function getDefaultCheckPrintOffset(): CheckPrintOffset {
  return { offsetXMm: 0, offsetYMm: 0 };
}

export function loadCheckPrintOffsets(): Record<CheckBank, CheckPrintOffset> {
  const empty: Record<CheckBank, CheckPrintOffset> = {
    bdo: getDefaultCheckPrintOffset(),
    bpi: getDefaultCheckPrintOffset(),
  };
  if (typeof window === "undefined") return empty;
  try {
    const raw = window.localStorage.getItem(OFFSET_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<
      Record<CheckBank, Partial<CheckPrintOffset>>
    >;
    for (const bank of ["bdo", "bpi"] as const) {
      const entry = parsed[bank];
      if (!entry) continue;
      empty[bank] = {
        offsetXMm: Number.isFinite(entry.offsetXMm) ? Number(entry.offsetXMm) : 0,
        offsetYMm: Number.isFinite(entry.offsetYMm) ? Number(entry.offsetYMm) : 0,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return empty;
}

export function saveCheckPrintOffset(
  bank: CheckBank,
  offset: CheckPrintOffset
): void {
  if (typeof window === "undefined") return;
  const all = loadCheckPrintOffsets();
  all[bank] = {
    offsetXMm: offset.offsetXMm,
    offsetYMm: offset.offsetYMm,
  };
  window.localStorage.setItem(OFFSET_STORAGE_KEY, JSON.stringify(all));
}

export function applyCheckPrintOffset(
  template: CheckTemplate,
  offset: CheckPrintOffset
): CheckTemplate {
  const shift = (box: CheckFieldBox): CheckFieldBox => ({
    ...box,
    topMm: box.topMm + offset.offsetYMm,
    leftMm: box.leftMm + offset.offsetXMm,
  });
  return {
    ...template,
    date: shift(template.date),
    payee: shift(template.payee),
    amountFigures: shift(template.amountFigures),
    amountWords: shift(template.amountWords),
  };
}

/**
 * Official blank image for preview.
 * BDO uses the calibrated blank photo. BPI uses the same layout as drawn chrome
 * (BDO positions) with BPI colors — see preview component.
 */
export function getOfficialBlankSampleSrc(bank: CheckBank): string | null {
  if (bank === "bdo") return "/check-samples/bdo-official-layout.png";
  return null;
}
