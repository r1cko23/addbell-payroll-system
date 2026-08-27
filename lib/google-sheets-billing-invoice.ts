/**
 * Invoice booklet tab names in the Addbell billing workbook, e.g.:
 * INV#12, 2024 - L&K INV#5, B-INV#01, L&K B-INV#01, BINV#3, OR/INVOICE#3
 *
 * Tab list is refreshed on a short TTL cache so newly added booklet tabs are picked
 * up automatically when they follow these naming patterns.
 */

import { google } from "googleapis";
import type { SubcontractorInvoiceStatus } from "@/lib/subcontractor-progress-billing";
import {
  getCachedBillingPoLookup,
  getCachedBillingSheetTitles,
  setCachedBillingPoLookup,
  setCachedBillingSheetTitles,
} from "@/lib/billing-invoice-lookup-cache";
import {
  recordBillingPoCacheHit,
  recordBillingPoCacheMiss,
  recordBillingSheetListCacheHit,
  recordBillingSheetListCacheMiss,
  recordGoogleSpreadsheetBatchGetCall,
  recordGoogleSpreadsheetMetadataCall,
} from "@/lib/platform-runtime-metrics";

/** Non-invoice reference tabs — never searched for P.O. rows */
const EXCLUDED_BILLING_SHEET_TITLES = new Set([
  "database",
  "with retentions",
  "reference",
  "cancelled",
  "cancelled invoices 2024",
]);

/**
 * Matches invoice booklet tabs. Optional year prefix: "2024 - ".
 * Supports L&K B-INV#, B-INV#, L&K INV#, INV#, BINV#, OR/INVOICE# + digits.
 */
const DEFAULT_BILLING_SHEET_NAME_PATTERN =
  /^(?:\d{4}\s*-\s*)?(?:(?:L&K\s+)?B-INV#|(?:L&K\s+)?INV#|BINV#|OR\/INVOICE#)\d+$/i;

function getBillingSheetNamePattern(): RegExp {
  const custom = process.env.GOOGLE_SHEETS_TAB_PATTERN?.trim();
  if (!custom) return DEFAULT_BILLING_SHEET_NAME_PATTERN;
  try {
    return new RegExp(custom, "i");
  } catch {
    return DEFAULT_BILLING_SHEET_NAME_PATTERN;
  }
}

export function isBillingInvoiceSheetTitle(title: string): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (EXCLUDED_BILLING_SHEET_TITLES.has(trimmed.toLowerCase())) return false;
  return getBillingSheetNamePattern().test(trimmed);
}

export function listBillingSheetTitles(allTitles: string[]): string[] {
  return allTitles
    .map((title) => title.trim())
    .filter((title) => isBillingInvoiceSheetTitle(title));
}

export type BillingInvoiceLookupResult = {
  status: SubcontractorInvoiceStatus;
  invoiceNumber: string | null;
  poNumber: string;
  cached?: boolean;
};

let sheetsApiClient: ReturnType<typeof google.sheets> | null = null;

function getSheetsClient() {
  if (sheetsApiClient) return sheetsApiClient;

  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
    /\\n/g,
    "\n"
  );

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Google Sheets is not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY."
    );
  }

  const auth = new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  sheetsApiClient = google.sheets({ version: "v4", auth });
  return sheetsApiClient;
}

async function getBillingSheetTitles(
  sheets: ReturnType<typeof google.sheets>,
  spreadsheetId: string
): Promise<string[]> {
  const cached = getCachedBillingSheetTitles();
  if (cached) {
    recordBillingSheetListCacheHit();
    return cached;
  }

  recordBillingSheetListCacheMiss();
  recordGoogleSpreadsheetMetadataCall();

  const metadata = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties.title",
  });

  const titles = listBillingSheetTitles(
    metadata.data.sheets
      ?.map((sheet) => sheet.properties?.title ?? "")
      .filter(Boolean) ?? []
  );

  setCachedBillingSheetTitles(titles);
  return titles;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizePo(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

function parseInvoiceStatus(raw: string): SubcontractorInvoiceStatus | null {
  const normalized = raw.trim().toUpperCase();
  if (normalized === "COPY RECEIVED") return "COPY RECEIVED";
  if (normalized === "COPY NOT YET RECEIVED") return "COPY NOT YET RECEIVED";
  return null;
}

/** Columns within A:G — A=STATUS, B=INVOICE BOOKLET NO., G=P.O. NO. */
const BILLING_STATUS_COL_INDEX = 0;
const BILLING_INVOICE_NUMBER_COL_INDEX = 1;
const BILLING_PO_COL_INDEX = 6;
const BILLING_SHEET_VALUE_RANGE = "A:G";

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const candidate of candidates) {
    const index = normalizedHeaders.indexOf(normalizeHeader(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function headerMatchesInvoiceNumberColumn(header: string): boolean {
  const normalized = normalizeHeader(header);
  return (
    normalized.startsWith("invoice booklet no") ||
    normalized === "invoice number" ||
    normalized.includes("invoice booklet")
  );
}

function findInvoiceNumberColumnIndex(
  headers: string[],
  candidates: string[]
): number {
  const index = findColumnIndex(headers, candidates);
  if (index >= 0) return index;

  for (let i = 0; i < headers.length; i += 1) {
    if (headerMatchesInvoiceNumberColumn(headers[i] ?? "")) return i;
  }

  return -1;
}

function findHeaderRowIndex(
  rows: string[][],
  poColumnCandidates: string[],
  statusColumnCandidates: string[],
  invoiceNumberColumnCandidates: string[],
  maxScan = 12
): {
  headerRowIndex: number;
  poIndex: number;
  statusIndex: number;
  invoiceNumberIndex: number;
} | null {
  const limit = Math.min(rows.length, maxScan);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const statusHeader = normalizeHeader(String(row[BILLING_STATUS_COL_INDEX] ?? ""));
    const poHeader = normalizeHeader(String(row[BILLING_PO_COL_INDEX] ?? ""));
    const statusMatch = statusColumnCandidates.some(
      (candidate) => normalizeHeader(candidate) === statusHeader
    );
    const poMatch = poColumnCandidates.some(
      (candidate) => normalizeHeader(candidate) === poHeader
    );
    if (statusMatch && poMatch) {
      return {
        headerRowIndex: rowIndex,
        poIndex: BILLING_PO_COL_INDEX,
        statusIndex: BILLING_STATUS_COL_INDEX,
        invoiceNumberIndex: BILLING_INVOICE_NUMBER_COL_INDEX,
      };
    }
  }

  // Fallback: scan full header row if columns were shifted (should not happen on A/G tabs).
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = (rows[rowIndex] ?? []).map((cell) => String(cell ?? ""));
    const poIndex = findColumnIndex(headers, poColumnCandidates);
    const statusIndex = findColumnIndex(headers, statusColumnCandidates);
    const invoiceNumberIndex = findInvoiceNumberColumnIndex(
      headers,
      invoiceNumberColumnCandidates
    );
    if (poIndex >= 0 && statusIndex >= 0) {
      return {
        headerRowIndex: rowIndex,
        poIndex,
        statusIndex,
        invoiceNumberIndex:
          invoiceNumberIndex >= 0 ? invoiceNumberIndex : BILLING_INVOICE_NUMBER_COL_INDEX,
      };
    }
  }

  return null;
}

function formatInvoiceNumber(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed;
}

function searchSheetForPo(
  rows: string[][],
  normalizedPo: string,
  poNumberTrimmed: string,
  poColumnCandidates: string[],
  statusColumnCandidates: string[],
  invoiceNumberColumnCandidates: string[]
): BillingInvoiceLookupResult | null {
  if (rows.length === 0) return null;

  const header = findHeaderRowIndex(
    rows,
    poColumnCandidates,
    statusColumnCandidates,
    invoiceNumberColumnCandidates
  );
  if (!header) return null;

  const { headerRowIndex, poIndex, statusIndex, invoiceNumberIndex } = header;

  for (let rowIndex = headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const rowPo = normalizePo(String(row[poIndex] ?? ""));
    if (rowPo !== normalizedPo) continue;

    const parsedStatus = parseInvoiceStatus(String(row[statusIndex] ?? ""));
    if (parsedStatus) {
      return {
        status: parsedStatus,
        invoiceNumber: formatInvoiceNumber(String(row[invoiceNumberIndex] ?? "")),
        poNumber: poNumberTrimmed,
      };
    }
  }

  return null;
}

function quoteSheetRange(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'!${BILLING_SHEET_VALUE_RANGE}`;
}

const BILLING_SHEET_BATCH_SIZE = 30;

export async function lookupBillingInvoiceStatus(
  poNumber: string
): Promise<BillingInvoiceLookupResult> {
  const cached = getCachedBillingPoLookup(poNumber);
  if (cached) {
    recordBillingPoCacheHit();
    return { ...cached, cached: true };
  }

  recordBillingPoCacheMiss();

  const spreadsheetId = process.env.GOOGLE_SHEETS_BILLING_SPREADSHEET_ID?.trim();
  if (!spreadsheetId) {
    throw new Error(
      "Google Sheets billing spreadsheet is not configured. Set GOOGLE_SHEETS_BILLING_SPREADSHEET_ID."
    );
  }

  const normalizedPo = normalizePo(poNumber);
  if (!normalizedPo || normalizedPo === "N/A") {
    return { status: "NOT FOUND", invoiceNumber: null, poNumber };
  }

  const poColumnCandidates = (
    process.env.GOOGLE_SHEETS_PO_COLUMN ||
    "P.O. NO.,P.O. NO,PO Number,P.O. Number,PO No,PO#,Client PO"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const statusColumnCandidates = (
    process.env.GOOGLE_SHEETS_STATUS_COLUMN ||
    "STATUS,Status,Invoice Status,Billing Status"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const invoiceNumberColumnCandidates = (
    process.env.GOOGLE_SHEETS_INVOICE_NUMBER_COLUMN ||
    "INVOICE BOOKLET NO.,INVOICE BOOKLET NO,Invoice Booklet No,Invoice Number"
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const sheets = getSheetsClient();
  const billingSheetTitles = await getBillingSheetTitles(sheets, spreadsheetId);

  const poNumberTrimmed = poNumber.trim();
  // Newer booklet tabs are usually at the end — search those first.
  const sheetsToSearch = [...billingSheetTitles].reverse();

  for (let i = 0; i < sheetsToSearch.length; i += BILLING_SHEET_BATCH_SIZE) {
    const chunk = sheetsToSearch.slice(i, i + BILLING_SHEET_BATCH_SIZE);
    recordGoogleSpreadsheetBatchGetCall(chunk.length);
    const batch = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: chunk.map(quoteSheetRange),
    });
    const valueRanges = batch.data.valueRanges ?? [];

    for (let j = 0; j < chunk.length; j += 1) {
      const rows = (valueRanges[j]?.values ?? []) as string[][];
      const hit = searchSheetForPo(
        rows,
        normalizedPo,
        poNumberTrimmed,
        poColumnCandidates,
        statusColumnCandidates,
        invoiceNumberColumnCandidates
      );
      if (hit) {
        setCachedBillingPoLookup(poNumberTrimmed, hit);
        return hit;
      }
    }
  }

  const notFound: BillingInvoiceLookupResult = {
    status: "NOT FOUND",
    invoiceNumber: null,
    poNumber: poNumberTrimmed,
  };
  setCachedBillingPoLookup(poNumberTrimmed, notFound);
  return notFound;
}

export function isGoogleSheetsBillingConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_SHEETS_BILLING_SPREADSHEET_ID?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  );
}
