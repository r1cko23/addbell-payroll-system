/**
 * Parse and collect rows from the ADD-BELL P.O. masterlist tab.
 * Pure parsers are unit-tested; collectAddBellMasterlistRows talks to Google (readonly).
 */

import { google } from "googleapis";
import {
  displayClientName,
  isRejectedBillingClientName,
  normalizeBillingHeader,
  normalizeClientNameKey,
} from "@/lib/billing-sheet-clients";
import {
  getPoMasterlistSpreadsheetId,
  isPoMasterlistSheetWritebackConfigured,
} from "@/lib/google-sheets-po-masterlist";
import type { ProjectStatus } from "@/types/project";

export const ADD_BELL_MASTERLIST_TAB = "ADD-BELL" as const;
export const ADD_BELL_MASTERLIST_RANGE = "A:N" as const;

const MONTH_INDEX: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

type ColumnKey =
  | "poDate"
  | "poReceivedDate"
  | "poNumber"
  | "poAmount"
  | "projectTitle"
  | "client"
  | "location"
  | "paymentTerms"
  | "cari"
  | "cariExpiry"
  | "projectStatus"
  | "paymentStatus"
  | "invoiceNumbers"
  | "generalRemarks";

const COLUMN_CANDIDATES: Record<ColumnKey, string[]> = {
  poDate: ["P.O. DATE", "PO DATE"],
  poReceivedDate: ["P.O. RECEIVED DATE", "PO RECEIVED DATE"],
  poNumber: ["P.O. NUMBER", "PO NUMBER", "P.O. NO.", "P.O. NO", "PO NO"],
  poAmount: ["P.O. AMOUNT", "PO AMOUNT"],
  projectTitle: ["PROJECT TITLE"],
  client: ["CLIENT", "CLIENT NAME"],
  location: ["LOCATION"],
  paymentTerms: ["PAYMENT TERMS"],
  cari: ["CARI"],
  cariExpiry: ["CARI EXPIRY(DATE)", "CARI EXPIRY (DATE)", "CARI EXPIRY"],
  projectStatus: ["PROJECT STATUS"],
  paymentStatus: ["PAYMENT STATUS"],
  invoiceNumbers: ["INVOICE NO.", "INVOICE NO", "INVOICE NUMBER"],
  generalRemarks: ["GENERAL REMARKS", "REMARKS"],
};

export type AddBellMasterlistColumnIndexes = Partial<Record<ColumnKey, number>> & {
  headerRowIndex: number;
  poNumber: number;
};

export type ParsedAddBellMasterlistRow = {
  sheetTab: typeof ADD_BELL_MASTERLIST_TAB;
  /** 1-based Google Sheets row index */
  sheetRow: number;
  poNumber: string;
  poDate: string | null;
  poReceivedDate: string | null;
  poAmount: number | null;
  projectTitle: string | null;
  clientName: string | null;
  location: string | null;
  paymentTerms: string | null;
  cari: string | null;
  cariExpiry: string | null;
  projectStatus: string | null;
  paymentStatus: string | null;
  invoiceNumbers: string | null;
  generalRemarks: string | null;
  appProjectStatus: ProjectStatus;
};

function normalizeHeaderCell(value: string): string {
  return normalizeBillingHeader(value.replace(/\n/g, " "));
}

function findColumnIndex(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeaderCell);
  for (const candidate of candidates) {
    const want = normalizeHeaderCell(candidate);
    const exact = normalized.indexOf(want);
    if (exact >= 0) return exact;
  }
  for (const candidate of candidates) {
    const want = normalizeHeaderCell(candidate);
    const partial = normalized.findIndex(
      (header) => header === want || header.startsWith(want)
    );
    if (partial >= 0) return partial;
  }
  return -1;
}

export function findAddBellMasterlistHeader(
  rows: string[][],
  maxScan = 12
): AddBellMasterlistColumnIndexes | null {
  const limit = Math.min(rows.length, maxScan);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const headers = (rows[rowIndex] ?? []).map((cell) => String(cell ?? ""));
    const poNumber = findColumnIndex(headers, COLUMN_CANDIDATES.poNumber);
    const projectTitle = findColumnIndex(headers, COLUMN_CANDIDATES.projectTitle);
    const client = findColumnIndex(headers, COLUMN_CANDIDATES.client);
    if (poNumber < 0 || projectTitle < 0 || client < 0) continue;

    const indexes: AddBellMasterlistColumnIndexes = {
      headerRowIndex: rowIndex,
      poNumber,
      projectTitle,
      client,
    };

    for (const key of Object.keys(COLUMN_CANDIDATES) as ColumnKey[]) {
      if (key === "poNumber") continue;
      const index = findColumnIndex(headers, COLUMN_CANDIDATES[key]);
      if (index >= 0) indexes[key] = index;
    }

    return indexes;
  }
  return null;
}

/** Parse masterlist display dates like 15-Sep-2022 into YYYY-MM-DD. */
export function parseAddBellMasterlistDate(
  value: string | null | undefined
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || /^n\/?a$/i.test(trimmed) || trimmed === "-" || trimmed === "—") {
    return null;
  }

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) {
    const year = Number(iso[1]);
    if (year < 2000 || year > 2100) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }

  const display = /^(\d{1,2})[-/\s]([A-Za-z]{3})[-/\s](\d{2,4})$/.exec(trimmed);
  if (display) {
    const day = Number(display[1]);
    const month = MONTH_INDEX[display[2].toLowerCase()];
    let year = Number(display[3]);
    if (year < 100) year += 2000;
    if (!month || day < 1 || day > 31) return null;
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  // Google Sheets sometimes returns serial-looking numbers via API as plain dates already.
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(trimmed);
  if (slash) {
    const month = Number(slash[1]);
    const day = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) year += 2000;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    if (year < 2000 || year > 2100) return null;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  return null;
}

/** Parse amounts like ₱83,000.00 or 83000. */
export function parseAddBellMasterlistAmount(
  value: string | null | undefined
): number | null {
  if (!value) return null;
  const cleaned = value
    .trim()
    .replace(/₱/g, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!cleaned || /^n\/?a$/i.test(cleaned)) return null;
  const amount = Number(cleaned);
  if (!Number.isFinite(amount)) return null;
  return amount;
}

export function mapAddBellProjectStatusToApp(
  sheetStatus: string | null | undefined
): ProjectStatus {
  const normalized = (sheetStatus ?? "").trim().toUpperCase();
  if (normalized === "COMPLETED" || normalized === "COMPLETE") return "completed";
  if (normalized === "CANCELLED" || normalized === "CANCELED") return "on_hold";
  if (normalized === "PENDING") return "pending";
  if (!normalized) return "active";
  return "active";
}

function cellAt(
  row: string[],
  indexes: AddBellMasterlistColumnIndexes,
  key: ColumnKey
): string {
  const index = indexes[key];
  if (index == null || index < 0) return "";
  return String(row[index] ?? "").trim();
}

export function parseAddBellMasterlistRows(
  rows: string[][]
): ParsedAddBellMasterlistRow[] {
  const header = findAddBellMasterlistHeader(rows);
  if (!header) return [];

  const parsed: ParsedAddBellMasterlistRow[] = [];
  for (let rowIndex = header.headerRowIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const poNumber = cellAt(row, header, "poNumber").replace(/\s+/g, " ").trim();
    if (!poNumber || /^n\/?a$/i.test(poNumber)) continue;

    const clientRaw = cellAt(row, header, "client");
    const clientName = isRejectedBillingClientName(clientRaw)
      ? null
      : displayClientName(clientRaw) || null;

    const projectStatusRaw = cellAt(row, header, "projectStatus") || null;
    const projectTitle = cellAt(row, header, "projectTitle") || null;
    const location = cellAt(row, header, "location") || null;

    parsed.push({
      sheetTab: ADD_BELL_MASTERLIST_TAB,
      sheetRow: rowIndex + 1,
      poNumber,
      poDate: parseAddBellMasterlistDate(cellAt(row, header, "poDate")),
      poReceivedDate: parseAddBellMasterlistDate(
        cellAt(row, header, "poReceivedDate")
      ),
      poAmount: parseAddBellMasterlistAmount(cellAt(row, header, "poAmount")),
      projectTitle,
      clientName,
      location,
      paymentTerms: cellAt(row, header, "paymentTerms") || null,
      cari: cellAt(row, header, "cari") || null,
      cariExpiry: parseAddBellMasterlistDate(cellAt(row, header, "cariExpiry")),
      projectStatus: projectStatusRaw,
      paymentStatus: cellAt(row, header, "paymentStatus") || null,
      invoiceNumbers: cellAt(row, header, "invoiceNumbers") || null,
      generalRemarks: cellAt(row, header, "generalRemarks") || null,
      appProjectStatus: mapAddBellProjectStatusToApp(projectStatusRaw),
    });
  }

  return parsed;
}

export function projectKeyFromTitleLocation(
  title: string | null | undefined,
  location: string | null | undefined
): string {
  const nameKey = (title ?? "").trim().toLowerCase();
  const locKey = (location ?? "").trim().toLowerCase();
  return `${nameKey}\u001f${locKey}`;
}

export function deriveMasterlistProjectCode(
  title: string,
  location: string | null,
  used: Set<string>
): string {
  const seed = `${title}|${location ?? ""}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  let base = `ML-${hash.toString(16).toUpperCase().slice(0, 10)}`;
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) suffix += 1;
  const code = `${base}-${suffix}`;
  used.add(code);
  return code;
}

let readonlyMasterlistClient: ReturnType<typeof google.sheets> | null = null;

function getReadonlyMasterlistSheetsClient() {
  if (readonlyMasterlistClient) return readonlyMasterlistClient;

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
  readonlyMasterlistClient = google.sheets({ version: "v4", auth });
  return readonlyMasterlistClient;
}

export function isAddBellMasterlistImportConfigured(): boolean {
  return isPoMasterlistSheetWritebackConfigured();
}

/** Fetch and parse the ADD-BELL tab only. */
export async function collectAddBellMasterlistRows(): Promise<
  ParsedAddBellMasterlistRow[]
> {
  const spreadsheetId = getPoMasterlistSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error(
      "Google Sheets P.O. masterlist is not configured. Set GOOGLE_SHEETS_PO_MASTERLIST_SPREADSHEET_ID."
    );
  }

  const sheets = getReadonlyMasterlistSheetsClient();
  const range = `'${ADD_BELL_MASTERLIST_TAB.replace(/'/g, "''")}'!${ADD_BELL_MASTERLIST_RANGE}`;
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS",
  });

  const values = (response.data.values ?? []) as string[][];
  return parseAddBellMasterlistRows(values);
}

export { normalizeClientNameKey };
