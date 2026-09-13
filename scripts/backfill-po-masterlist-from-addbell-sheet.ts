/**
 * Import the ADD-BELL P.O. masterlist tab into clients and po_masterlist_jobs.
 * Does not touch vendor purchase_orders. Re-runs update by (sheet_tab, sheet_row).
 *
 * Usage: npx tsx scripts/backfill-po-masterlist-from-addbell-sheet.ts
 */
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  deriveClientCode,
  splitClientBusinessUnit,
} from "../lib/billing-sheet-clients";
import {
  ADD_BELL_MASTERLIST_TAB,
  collectAddBellMasterlistRows,
  isAddBellMasterlistImportConfigured,
  normalizeClientNameKey,
} from "../lib/po-masterlist-sheet-import";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

type Counts = {
  rowsRead: number;
  skippedNoPo: number;
  clientsInserted: number;
  clientsUpdated: number;
  jobsInserted: number;
  jobsUpdated: number;
  jobErrors: number;
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables in .env.local");
    process.exit(1);
  }
  if (!isAddBellMasterlistImportConfigured()) {
    console.error(
      "P.O. masterlist sheet is not configured. Set GOOGLE_SHEETS_PO_MASTERLIST_SPREADSHEET_ID and service account env."
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rows = await collectAddBellMasterlistRows();
  const counts: Counts = {
    rowsRead: rows.length,
    skippedNoPo: 0,
    clientsInserted: 0,
    clientsUpdated: 0,
    jobsInserted: 0,
    jobsUpdated: 0,
    jobErrors: 0,
  };

  console.log(`ADD-BELL rows with P.O. number: ${rows.length}`);

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .order("created_at")
    .limit(1)
    .maybeSingle();
  const companyId = (company?.id as string | undefined) ?? null;

  const { data: existingClients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name, client_code, company_id, business_unit_sub_company");
  if (clientsError) {
    console.error("Failed to load clients:", clientsError.message);
    process.exit(1);
  }

  const clientIdByNameKey = new Map<string, string>();
  const usedClientCodes = new Set<string>();
  for (const client of existingClients ?? []) {
    clientIdByNameKey.set(normalizeClientNameKey(client.name), client.id);
    if (client.client_code?.trim()) {
      usedClientCodes.add(client.client_code.trim().toUpperCase());
    }
  }

  const uniqueClientNames = new Map<string, string>();
  for (const row of rows) {
    if (!row.clientName) continue;
    const key = normalizeClientNameKey(row.clientName);
    if (!uniqueClientNames.has(key)) uniqueClientNames.set(key, row.clientName);
  }

  for (const [key, name] of uniqueClientNames) {
    const existingId = clientIdByNameKey.get(key);
    const { businessUnit } = splitClientBusinessUnit(name);
    if (existingId) {
      const existing = (existingClients ?? []).find((c) => c.id === existingId);
      const updates: Record<string, string | null> = {};
      if (!existing?.company_id && companyId) updates.company_id = companyId;
      if (!existing?.business_unit_sub_company && businessUnit) {
        updates.business_unit_sub_company = businessUnit;
      }
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from("clients")
          .update(updates)
          .eq("id", existingId);
        if (error) {
          console.error(`Failed to update client ${name}:`, error.message);
        } else {
          counts.clientsUpdated += 1;
        }
      }
      continue;
    }

    const { data: created, error } = await supabase
      .from("clients")
      .insert({
        company_id: companyId,
        name,
        client_code: deriveClientCode(name, usedClientCodes),
        business_unit_sub_company: businessUnit,
        is_active: true,
      })
      .select("id, name")
      .single();
    if (error || !created) {
      console.error(`Failed to insert client ${name}:`, error?.message);
      continue;
    }
    clientIdByNameKey.set(key, created.id);
    counts.clientsInserted += 1;
  }

  const { data: existingJobs, error: jobsError } = await supabase
    .from("po_masterlist_jobs")
    .select("id, sheet_tab, sheet_row")
    .eq("sheet_tab", ADD_BELL_MASTERLIST_TAB);
  if (jobsError) {
    console.error("Failed to load po_masterlist_jobs:", jobsError.message);
    process.exit(1);
  }

  const jobIdByCoords = new Map<string, string>();
  for (const job of existingJobs ?? []) {
    if (job.sheet_tab && job.sheet_row != null) {
      jobIdByCoords.set(`${job.sheet_tab}:${job.sheet_row}`, job.id);
    }
  }

  const syncedAt = new Date().toISOString();

  for (const row of rows) {
    const clientId = row.clientName
      ? clientIdByNameKey.get(normalizeClientNameKey(row.clientName)) ?? null
      : null;

    const payload = {
      company_id: companyId,
      client_id: clientId,
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
      updated_at: syncedAt,
    };

    const coordsKey = `${row.sheetTab}:${row.sheetRow}`;
    const existingJobId = jobIdByCoords.get(coordsKey);
    if (existingJobId) {
      const { error } = await supabase
        .from("po_masterlist_jobs")
        .update(payload)
        .eq("id", existingJobId);
      if (error) {
        counts.jobErrors += 1;
        console.error(
          `Failed to update job row ${row.sheetRow} (${row.poNumber}):`,
          error.message
        );
        continue;
      }
      counts.jobsUpdated += 1;
      continue;
    }

    const { data: created, error } = await supabase
      .from("po_masterlist_jobs")
      .insert({ ...payload, created_at: syncedAt })
      .select("id")
      .single();
    if (error || !created) {
      counts.jobErrors += 1;
      console.error(
        `Failed to insert job row ${row.sheetRow} (${row.poNumber}):`,
        error?.message
      );
      continue;
    }
    jobIdByCoords.set(coordsKey, created.id);
    counts.jobsInserted += 1;
  }

  console.log(
    [
      `Done.`,
      `rows=${counts.rowsRead}`,
      `clients +${counts.clientsInserted}/~${counts.clientsUpdated}`,
      `jobs +${counts.jobsInserted}/~${counts.jobsUpdated}`,
      `jobErrors=${counts.jobErrors}`,
    ].join(" ")
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
