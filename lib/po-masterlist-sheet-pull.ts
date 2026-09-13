import type { getAdminClient } from "@/lib/fund-request-api";
import {
  ADD_BELL_MASTERLIST_TAB,
  collectAddBellMasterlistRows,
  type ParsedAddBellMasterlistRow,
} from "@/lib/po-masterlist-sheet-import";
import { syncCatalogFromMasterlistJob } from "@/lib/po-masterlist-job-sync";
import {
  cancelPoMasterlistSheetWriteback,
  enqueuePoMasterlistSheetWriteback,
} from "@/lib/po-masterlist-sheet-writeback";
import {
  poMasterlistSheetRowFingerprint,
  poMasterlistSheetRowsEqual,
} from "@/lib/po-masterlist-sheet-row";
import type { PoMasterlistJob, PoMasterlistSheetRowSource } from "@/types/po-masterlist";

export type PoMasterlistPullDecision =
  | "insert"
  | "update"
  | "skip_app_newer"
  | "skip_in_sync"
  | "skip_header";

export type PoMasterlistPullExistingJob = {
  id?: string;
  updated_at: string;
  sheet_synced_at: string | null;
};

const HEADER_LABELS = new Set([
  "P.O. NUMBER",
  "PO NUMBER",
  "P.O. NO.",
  "P.O. NO",
  "PROJECT TITLE",
  "PROJECT STATUS",
  "PAYMENT STATUS",
  "CLIENT",
]);

export function isPoMasterlistHeaderLikeRow(row: {
  poNumber?: string | null;
  projectTitle?: string | null;
  projectStatus?: string | null;
  paymentStatus?: string | null;
}): boolean {
  const values = [
    row.poNumber,
    row.projectTitle,
    row.projectStatus,
    row.paymentStatus,
  ]
    .map((value) => (value ?? "").trim().toUpperCase())
    .filter(Boolean);

  return values.some((value) => HEADER_LABELS.has(value));
}

export function decidePoMasterlistPullAction(args: {
  existing: PoMasterlistPullExistingJob | null;
  isHeaderRow: boolean;
  sheetMatchesApp?: boolean;
  sheetMatchesLastSync?: boolean;
  appMatchesLastSync?: boolean;
}): PoMasterlistPullDecision {
  if (args.isHeaderRow) return "skip_header";
  if (!args.existing) return "insert";
  if (args.sheetMatchesApp) return "skip_in_sync";

  // Never-synced app rows stay in the app until they are written to the sheet.
  if (!args.existing.sheet_synced_at) return "skip_app_newer";

  // Google Sheet is the source of truth. Copy it into the app unless we know
  // the sheet is unchanged and only the app moved.
  if (args.sheetMatchesLastSync === true) return "skip_app_newer";
  return "update";
}

function coerceAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sheetSourceFromParsedRow(
  row: ParsedAddBellMasterlistRow
): PoMasterlistSheetRowSource {
  return {
    po_date: row.poDate,
    po_received_date: row.poReceivedDate,
    po_number: row.poNumber,
    po_amount: row.poAmount,
    project_title: row.projectTitle,
    client_name: row.clientName,
    location: row.location,
    payment_terms: row.paymentTerms,
    cari: row.cari,
    cari_expiry: row.cariExpiry,
    project_status: row.projectStatus,
    payment_status: row.paymentStatus,
    invoice_numbers: row.invoiceNumbers,
    general_remarks: row.generalRemarks,
  };
}

function sheetSourceFromExistingJob(job: {
  po_number: string;
  po_date: string | null;
  po_received_date: string | null;
  po_amount: number | string | null;
  project_title: string | null;
  client_name: string | null;
  location: string | null;
  payment_terms: string | null;
  cari: string | null;
  cari_expiry: string | null;
  project_status: string | null;
  payment_status: string | null;
  invoice_numbers: string | null;
  general_remarks: string | null;
}): PoMasterlistSheetRowSource {
  return {
    po_date: job.po_date,
    po_received_date: job.po_received_date,
    po_number: job.po_number,
    po_amount: coerceAmount(job.po_amount),
    project_title: job.project_title,
    client_name: job.client_name,
    location: job.location,
    payment_terms: job.payment_terms,
    cari: job.cari,
    cari_expiry: job.cari_expiry,
    project_status: job.project_status,
    payment_status: job.payment_status,
    invoice_numbers: job.invoice_numbers,
    general_remarks: job.general_remarks,
  };
}

function jobPayloadFromSheetRow(
  row: ParsedAddBellMasterlistRow,
  syncedAt: string
) {
  const fingerprint = poMasterlistSheetRowFingerprint(
    sheetSourceFromParsedRow(row)
  );
  return {
    po_number: row.poNumber,
    po_date: row.poDate,
    po_received_date: row.poReceivedDate,
    po_amount: row.poAmount,
    project_title: row.projectTitle,
    client_name: row.clientName,
    location: row.location,
    payment_terms: row.paymentTerms,
    cari: row.cari,
    cari_expiry: row.cariExpiry,
    project_status: row.projectStatus,
    payment_status: row.paymentStatus,
    invoice_numbers: row.invoiceNumbers,
    general_remarks: row.generalRemarks,
    sheet_tab: row.sheetTab,
    sheet_row: row.sheetRow,
    sheet_synced_at: syncedAt,
    sheet_sync_error: null,
    sheet_sync_fingerprint: fingerprint,
    updated_at: syncedAt,
  };
}

export type PullPoMasterlistResult = {
  rowsRead: number;
  inserted: number;
  updated: number;
  skippedHeader: number;
  skippedAppNewer: number;
  skippedInSync: number;
  errors: number;
};

const EXISTING_JOB_COLUMNS =
  "id, sheet_tab, sheet_row, updated_at, sheet_synced_at, sheet_sync_fingerprint, po_number, po_date, po_received_date, po_amount, project_title, client_name, location, payment_terms, cari, cari_expiry, project_status, payment_status, invoice_numbers, general_remarks";

type ExistingCompareJob = {
  id: string;
  sheet_tab: string | null;
  sheet_row: number | null;
  updated_at: string;
  sheet_synced_at: string | null;
  sheet_sync_fingerprint: string | null;
  po_number: string;
  po_date: string | null;
  po_received_date: string | null;
  po_amount: number | string | null;
  project_title: string | null;
  client_name: string | null;
  location: string | null;
  payment_terms: string | null;
  cari: string | null;
  cari_expiry: string | null;
  project_status: string | null;
  payment_status: string | null;
  invoice_numbers: string | null;
  general_remarks: string | null;
};

export async function pullPoMasterlistFromSheet(
  admin: ReturnType<typeof getAdminClient>
): Promise<PullPoMasterlistResult> {
  const rows = await collectAddBellMasterlistRows();
  const result: PullPoMasterlistResult = {
    rowsRead: rows.length,
    inserted: 0,
    updated: 0,
    skippedHeader: 0,
    skippedAppNewer: 0,
    skippedInSync: 0,
    errors: 0,
  };

  const { data: existingJobs, error: loadError } = await admin
    .from("po_masterlist_jobs")
    .select(EXISTING_JOB_COLUMNS)
    .eq("sheet_tab", ADD_BELL_MASTERLIST_TAB);
  if (loadError) throw new Error(loadError.message);

  const byCoords = new Map<string, ExistingCompareJob>();
  for (const job of (existingJobs ?? []) as ExistingCompareJob[]) {
    if (job.sheet_tab && job.sheet_row != null) {
      byCoords.set(`${job.sheet_tab}:${job.sheet_row}`, job);
    }
  }

  const syncedAt = new Date().toISOString();

  for (const row of rows) {
    const isHeaderRow = isPoMasterlistHeaderLikeRow({
      poNumber: row.poNumber,
      projectTitle: row.projectTitle,
      projectStatus: row.projectStatus,
      paymentStatus: row.paymentStatus,
    });
    const existing = byCoords.get(`${row.sheetTab}:${row.sheetRow}`) ?? null;
    const sheetSource = sheetSourceFromParsedRow(row);
    const appSource = existing ? sheetSourceFromExistingJob(existing) : null;
    const sheetMatchesApp = Boolean(
      existing && appSource && poMasterlistSheetRowsEqual(sheetSource, appSource)
    );
    const sheetFingerprint = poMasterlistSheetRowFingerprint(sheetSource);
    const lastFingerprint = existing?.sheet_sync_fingerprint ?? null;
    const appFingerprint = appSource
      ? poMasterlistSheetRowFingerprint(appSource)
      : null;
    const action = decidePoMasterlistPullAction({
      existing,
      isHeaderRow,
      sheetMatchesApp,
      sheetMatchesLastSync:
        lastFingerprint != null
          ? sheetFingerprint === lastFingerprint
          : existing?.sheet_synced_at && !sheetMatchesApp
            ? false
            : undefined,
      appMatchesLastSync:
        lastFingerprint == null || appFingerprint == null
          ? undefined
          : appFingerprint === lastFingerprint,
    });

    if (action === "skip_header") {
      result.skippedHeader += 1;
      continue;
    }
    if (action === "skip_in_sync") {
      result.skippedInSync += 1;
      if (existing) {
        const patch: Record<string, string | null> = {
          sheet_sync_error: null,
          sheet_sync_fingerprint: sheetFingerprint,
        };
        if (existing.updated_at > (existing.sheet_synced_at ?? "")) {
          patch.sheet_synced_at = existing.updated_at;
        }
        await admin
          .from("po_masterlist_jobs")
          .update(patch)
          .eq("id", existing.id);
      }
      continue;
    }
    if (action === "skip_app_newer") {
      result.skippedAppNewer += 1;
      if (existing?.id) {
        await enqueuePoMasterlistSheetWriteback(existing.id, admin);
      }
      continue;
    }

    const payload = jobPayloadFromSheetRow(row, syncedAt);
    try {
      if (action === "insert") {
        const { data: created, error } = await admin
          .from("po_masterlist_jobs")
          .insert({ ...payload, created_at: syncedAt })
          .select("*")
          .single();
        if (error || !created) throw new Error(error?.message ?? "Insert failed");
        await syncCatalogFromMasterlistJob(
          admin,
          created as unknown as PoMasterlistJob
        );
        result.inserted += 1;
        continue;
      }

      if (!existing) continue;
      await cancelPoMasterlistSheetWriteback(existing.id, admin);
      const { data: updated, error } = await admin
        .from("po_masterlist_jobs")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error || !updated) throw new Error(error?.message ?? "Update failed");
      await syncCatalogFromMasterlistJob(
        admin,
        updated as unknown as PoMasterlistJob
      );
      result.updated += 1;
    } catch (err) {
      result.errors += 1;
      console.error(
        "[po-masterlist-sheet-pull] row failed",
        row.sheetRow,
        row.poNumber,
        err instanceof Error ? err.message : err
      );
    }
  }

  return result;
}
