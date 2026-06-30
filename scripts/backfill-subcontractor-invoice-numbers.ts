/**
 * One-time backfill: replace sheet-tab names in progress_billing with column B invoice numbers.
 *
 * Usage: npx tsx scripts/backfill-subcontractor-invoice-numbers.ts
 */

import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  isGoogleSheetsBillingConfigured,
  lookupBillingInvoiceStatus,
} from "../lib/google-sheets-billing-invoice";
import { isBillingInvoiceSheetTabName } from "../lib/subcontractor-progress-billing";
import type { StoredFundRequestProjectDetails } from "../lib/fund-request-project-details";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

function resolvePoNumber(
  row: { po_number: string | null },
  projectDetails: StoredFundRequestProjectDetails
): string | null {
  const projectPo = projectDetails.projects
    .map((project) => project.po_number?.trim())
    .find(Boolean);
  if (projectPo) return projectPo;
  return row.po_number?.trim() || null;
}

function needsInvoiceBackfill(
  progressBilling: StoredFundRequestProjectDetails["progress_billing"]
): boolean {
  if (!progressBilling?.milestone) return false;
  const stored =
    progressBilling.invoice_number?.trim() ||
    progressBilling.invoice_sheet?.trim() ||
    "";
  if (!stored) return true;
  return isBillingInvoiceSheetTabName(stored);
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing Supabase environment variables in .env.local");
    process.exit(1);
  }

  if (!isGoogleSheetsBillingConfigured()) {
    console.error("Google Sheets billing lookup is not configured in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: requests, error } = await supabase
    .from("fund_requests")
    .select("id, po_number, project_details, purpose")
    .ilike("purpose", "subcontractor payment");

  if (error) {
    console.error("Failed to load fund requests:", error.message);
    process.exit(1);
  }

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of requests ?? []) {
    scanned += 1;
    const projectDetails = row.project_details as StoredFundRequestProjectDetails | null;
    if (!projectDetails || projectDetails.v !== 1) {
      skipped += 1;
      continue;
    }

    const progressBilling = projectDetails.progress_billing;
    if (!needsInvoiceBackfill(progressBilling)) {
      skipped += 1;
      continue;
    }

    const poNumber = resolvePoNumber(row, projectDetails);
    if (!poNumber || poNumber.toUpperCase() === "N/A") {
      console.warn(`Skipping ${row.id}: no P.O. number`);
      skipped += 1;
      continue;
    }

    try {
      const lookup = await lookupBillingInvoiceStatus(poNumber);
      const { invoice_sheet: _legacySheet, ...progressBillingRest } =
        progressBilling ?? {};

      const nextProjectDetails: StoredFundRequestProjectDetails = {
        ...projectDetails,
        progress_billing: {
          ...progressBillingRest,
          invoice_number: lookup.invoiceNumber,
          invoice_status: lookup.status,
        },
      };

      const { error: updateError } = await supabase
        .from("fund_requests")
        .update({ project_details: nextProjectDetails })
        .eq("id", row.id);

      if (updateError) {
        console.error(`Failed to update ${row.id}:`, updateError.message);
        continue;
      }

      updated += 1;
      console.log(
        `Updated ${row.id} (PO ${poNumber}) -> invoice ${lookup.invoiceNumber ?? "—"}, status ${lookup.status}`
      );
    } catch (lookupError) {
      console.error(
        `Lookup failed for ${row.id} (PO ${poNumber}):`,
        lookupError instanceof Error ? lookupError.message : lookupError
      );
    }
  }

  console.log(`Done. Scanned ${scanned}, updated ${updated}, skipped ${skipped}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
