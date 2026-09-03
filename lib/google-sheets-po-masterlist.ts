/**
 * Write-only Google Sheets client for the client P.O. masterlist workbook.
 * Kept separate from billing invoice lookup (which stays spreadsheets.readonly).
 */

import { google } from "googleapis";
import {
  PO_MASTERLIST_SHEET_RANGE_COLUMNS,
  quotePoMasterlistSheetRowRange,
} from "@/lib/po-masterlist-sheet-row";
import { recordGoogleSpreadsheetValuesUpdateCall } from "@/lib/platform-runtime-metrics";

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

let masterlistSheetsClient: ReturnType<typeof google.sheets> | null = null;

function getMasterlistSheetsClient() {
  if (masterlistSheetsClient) return masterlistSheetsClient;

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
    scopes: [WRITE_SCOPE],
  });

  masterlistSheetsClient = google.sheets({ version: "v4", auth });
  return masterlistSheetsClient;
}

export function getPoMasterlistSpreadsheetId(): string | null {
  return process.env.GOOGLE_SHEETS_PO_MASTERLIST_SPREADSHEET_ID?.trim() || null;
}

export function isPoMasterlistSheetWritebackConfigured(): boolean {
  return Boolean(
    getPoMasterlistSpreadsheetId() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() &&
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()
  );
}

/**
 * Push one full masterlist row (A:N) to a known sheet_tab + sheet_row.
 * Caller must already have committed the job in Postgres.
 */
export async function updatePoMasterlistSheetRow(params: {
  sheetTab: string;
  sheetRow: number;
  values: string[];
}): Promise<void> {
  const spreadsheetId = getPoMasterlistSpreadsheetId();
  if (!spreadsheetId) {
    throw new Error(
      "Google Sheets P.O. masterlist is not configured. Set GOOGLE_SHEETS_PO_MASTERLIST_SPREADSHEET_ID."
    );
  }

  const sheetTab = params.sheetTab.trim();
  if (!sheetTab) {
    throw new Error("sheetTab is required for masterlist writeback.");
  }
  if (!Number.isFinite(params.sheetRow) || params.sheetRow < 1) {
    throw new Error("sheetRow must be a 1-based row index.");
  }
  if (params.values.length === 0) {
    throw new Error("values must include at least one cell.");
  }

  const sheets = getMasterlistSheetsClient();
  const range = quotePoMasterlistSheetRowRange(sheetTab, params.sheetRow);

  recordGoogleSpreadsheetValuesUpdateCall();
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      range,
      majorDimension: "ROWS",
      values: [params.values],
    },
  });
}

export function getPoMasterlistSheetValueRangeLabel(): string {
  return PO_MASTERLIST_SHEET_RANGE_COLUMNS;
}
