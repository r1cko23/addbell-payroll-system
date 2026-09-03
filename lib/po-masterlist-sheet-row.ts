import type { PoMasterlistSheetRowSource } from "@/types/po-masterlist";

/** Masterlist columns A–N (header row is typically row 3). */
export const PO_MASTERLIST_SHEET_RANGE_COLUMNS = "A:N" as const;

export const PO_MASTERLIST_SHEET_HEADERS = [
  "P.O. DATE",
  "P.O. RECEIVED DATE",
  "P.O. NUMBER",
  "P.O. AMOUNT",
  "PROJECT TITLE",
  "CLIENT",
  "LOCATION",
  "PAYMENT TERMS",
  "CARI",
  "CARI EXPIRY(DATE)",
  "PROJECT STATUS",
  "PAYMENT STATUS",
  "INVOICE NO.",
  "GENERAL REMARKS",
] as const;

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Format ISO date (YYYY-MM-DD) as masterlist display e.g. 15-Sep-2022. */
export function formatPoMasterlistSheetDate(
  value: string | null | undefined
): string {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return value.trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12
  ) {
    return value.trim();
  }
  return `${day}-${MONTH_ABBR[month - 1]}-${year}`;
}

/** Currency-style amount matching the existing masterlist display. */
export function formatPoMasterlistSheetAmount(
  value: number | null | undefined
): string {
  if (value == null || !Number.isFinite(value)) return "";
  return `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function cell(value: string | null | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Build one full sheet row (A–N) for a single values.update.
 * Never call Google once per cell — always push the whole row.
 */
export function buildPoMasterlistSheetRowValues(
  source: PoMasterlistSheetRowSource
): string[] {
  return [
    formatPoMasterlistSheetDate(source.po_date),
    formatPoMasterlistSheetDate(source.po_received_date),
    cell(source.po_number),
    formatPoMasterlistSheetAmount(source.po_amount),
    cell(source.project_title),
    cell(source.client_name),
    cell(source.location),
    cell(source.payment_terms),
    cell(source.cari),
    formatPoMasterlistSheetDate(source.cari_expiry),
    cell(source.project_status),
    cell(source.payment_status),
    cell(source.invoice_numbers),
    cell(source.general_remarks),
  ];
}

export function quotePoMasterlistSheetRowRange(
  sheetTab: string,
  sheetRow: number
): string {
  const safeTab = sheetTab.replace(/'/g, "''");
  return `'${safeTab}'!A${sheetRow}:N${sheetRow}`;
}

export function canMirrorPoMasterlistJob(job: {
  sheet_tab: string | null;
  sheet_row: number | null;
}): job is { sheet_tab: string; sheet_row: number } {
  return Boolean(
    job.sheet_tab?.trim() &&
      job.sheet_row != null &&
      Number.isFinite(job.sheet_row) &&
      job.sheet_row >= 1
  );
}
